# PaymentService

> Base URL: `https://payment.<wavy-domain>` · Phase 2 · 🔐 **auth-relevant → Planfreigabe vor Implementierung**

Gemeinsame Zahlungsschicht für **TicketService und MarketService**. Kapselt Stripe vollständig —
kein anderer Service spricht je direkt mit Stripe. Auszahlungen an Händler/Veranstalter laufen
über **Stripe Connect** (Destination Charges mit `application_fee_amount` als Plattformgebühr);
ohne Connect würde die Plattform regulatorisch selbst zum Zahlungsdienstleister.

**Grundregeln:**

- **Keine Kartendaten** berühren: ausschließlich Stripe Checkout (hosted) bzw. Payment Element →
  PCI-Scope SAQ-A
- Sessions werden **nur intern** erzeugt (`X-API-Key`) — Endnutzer reden mit Ticket-/MarketService,
  nie direkt mit diesem Service (Ausnahme: Redirect-Rückkehr und Merchant-Onboarding)
- Alles Geld in **Integer-Cent**, niemals Float
- Jede Zustandsänderung kommt **ausschließlich aus Stripe-Webhooks** (signaturgeprüft) —
  niemals aus dem Redirect-Callback des Browsers (manipulierbar)

**Datenmodell `MerchantAccount`:**

| Feld | Typ | Description |
|------|-----|-------------|
| `merchantId` | String | JWT `sub` (Rolle `merchant`/`organizer`); unique |
| `stripeAccountId` | String | Connect-Account (`acct_…`) |
| `onboardingState` | String | Enum: `pending`, `complete`, `restricted` — via Webhook `account.updated` aktualisiert |
| `createdAt` | Date | Auto |

**Datenmodell `CheckoutSession`:**

| Feld | Typ | Description |
|------|-----|-------------|
| `id` | String | Dokument-ID = interne Referenz (`sourceService` nutzt sie als `paymentRef`) |
| `sourceService` | String | Enum: `ticket`, `market` |
| `sourceId` | String | z. B. Order-ID oder Ticket-Reservierungs-ID beim Quell-Service |
| `merchantId` | String | Empfänger der Auszahlung |
| `amountCents` / `currency` | Number/String | Gesamtbetrag; currency ISO-4217, vorerst nur `eur` |
| `feeCents` | Number | Plattformgebühr (`application_fee_amount`) |
| `stripeSessionId` | String | `cs_…` |
| `state` | String | Enum: `created`, `paid`, `expired`, `refunded`, `failed` |
| `createdAt` / `updatedAt` | Date | Auto |

**Callback-Vertrag (PaymentService → Quell-Service):** Nach relevanten Webhooks ruft der
PaymentService den Quell-Service auf (`X-API-Key`, Retry 5× exponentiell, bei endgültigem
Scheitern → ExceptionService):

```
POST {TICKET|MARKET}_SERVICE_URL/internal/payment-events
{ "sessionId": "...", "sourceId": "...", "event": "paid" | "expired" | "refunded" }
```

Der Quell-Service muss den Empfang **idempotent** verarbeiten (gleiches Event doppelt = no-op).

---

## Merchant (Bearer JWT, Rolle `merchant`/`organizer`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/accounts` | Connect-Account anlegen (idempotent) → `{ onboardingUrl }` (Stripe-hosted Onboarding-Link) |
| `GET` | `/accounts/me` | `{ onboardingState, payoutsEnabled }` |
| `POST` | `/accounts/me/onboarding-link` | Neuen Onboarding-/Update-Link erzeugen |

## Internal (X-API-Key)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/internal/sessions` | `{ sourceService*, sourceId*, merchantId*, lineItems*: [{ name, amountCents, quantity }], feeCents*, successUrl*, cancelUrl* }` | Checkout-Session erzeugen → `{ sessionId, checkoutUrl }`. Merchant ohne `onboardingState: complete` → `409` |
| `POST` | `/internal/refunds` | `{ sessionId*, amountCents? }` | (Teil-)Erstattung → `202`; Ergebnis kommt per Webhook/Callback |
| `GET` | `/internal/sessions/:id` | — | Session-Zustand nachschlagen |

## Webhooks (Stripe, signaturgeprüft mit `STRIPE_WEBHOOK_SECRET`)

| Method | Endpoint | Events | Description |
|--------|----------|--------|-------------|
| `POST` | `/webhooks/stripe` | `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `account.updated` | Signatur prüfen (ungültig → `400`, **keine** Details im Fehler), Session-State setzen, Quell-Service-Callback feuern. Idempotent über Stripe-Event-ID (Redis-Set, TTL 72 h) |

## Admin (JWT Rolle `admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/sessions` | Filter `?state&sourceService&merchantId&from&to` |
| `GET` | `/admin/reconciliation` | Sessions `paid` ohne bestätigten Quell-Service-Callback (Alarmliste) |

---

## Env (zusätzlich zur Basis)

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
REDIS_URL                   # Webhook-Idempotenz
PLATFORM_FEE_DEFAULT_BPS=500   # 5 % Default, Quell-Service kann feeCents explizit setzen
TICKET_SERVICE_URL / TICKET_SERVICE_API_KEY
MARKET_SERVICE_URL / MARKET_SERVICE_API_KEY
```

## Akzeptanzkriterien (Test-Experte — Stripe via `stripe-mock` bzw. Test-Mode)

1. Session-Erzeugung für Merchant mit unfertigem Onboarding → `409`
2. Webhook mit ungültiger Signatur → `400`, kein State-Change
3. Gleicher `checkout.session.completed`-Event zweimal → genau **ein** Callback an den Quell-Service
4. Quell-Service down: Callback wird 5× mit Backoff versucht, danach ExceptionService-Meldung; Session-State bleibt korrekt `paid`
5. Refund über `amountCents > Betrag` → `400`
6. Kein Endpunkt außer `/webhooks/stripe`, `/accounts*` und den Standard-Endpunkten ist ohne `X-API-Key` erreichbar
