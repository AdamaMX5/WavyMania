# TicketService

> Base URL: `https://ticket.<wavy-domain>` · Phase 2 · 🔐 **auth-relevant → Planfreigabe vor Implementierung**

**WavyTickets:** Events, Ticketverkauf, offline-verifizierbare QR-Tickets, Einlass-Scan,
regulierter Zweitmarkt (Preisdeckel + Identitätsbindung). Zahlungen laufen komplett über den
**PaymentService**; der Ticketkauf ist gleichzeitig der Onboarding-Kanal
(Gast-Checkout legt automatisch einen AuthService-Account an).

**Datenmodell `Event`:**

| Feld | Typ | Description |
|------|-----|-------------|
| `id` | String | Dokument-ID |
| `organizerId` | String | JWT `sub` (Rolle `organizer`) |
| `waveId` | String | optional — verknüpfte Wave |
| `title` / `description` | String | max. 120 / 10.000 Zeichen |
| `venue` | Object | `{ name, address, lat, lng }` |
| `startsAt` / `doorsAt` | Date | Beginn / Einlass |
| `tiers` | Object[] | `[{ tierId, name, priceCents, capacity, sold }]` — `sold` atomar hochzählen |
| `resalePolicy` | Object | `{ allowed: Boolean, maxMarkupBps: Number }` — default `{ true, 0 }` = Weiterverkauf max. zum Originalpreis |
| `state` | String | Enum: `draft`, `published`, `cancelled`, `completed` |
| `mediaIds` | String[] | MediaService |
| `createdAt` / `updatedAt` | Date | Auto |

**Datenmodell `Ticket`:**

| Feld | Typ | Description |
|------|-----|-------------|
| `id` | String | Dokument-ID |
| `eventId` / `tierId` | String | Referenzen |
| `ownerId` | String | JWT `sub` des aktuellen Inhabers (Identitätsbindung) |
| `state` | String | Enum: `reserved`, `paid`, `cancelled`, `checkedIn`, `listed` (Zweitmarkt), `resold` |
| `priceCents` | Number | tatsächlich gezahlter Preis |
| `paymentRef` | String | PaymentService-Session-ID |
| `resale` | Object | bei `listed`: `{ priceCents, listedAt }` |
| `reservedUntil` | Date | TTL der Reservierung (10 min); Cron storniert abgelaufene `reserved` und gibt `sold` frei |
| `createdAt` / `updatedAt` | Date | Auto |

**Kauf-Flow:**

```
POST /events/:id/tickets  →  Ticket state=reserved, tier.sold++ (atomar, ausverkauft → 409)
  → PaymentService /internal/sessions  →  { checkoutUrl } an den Client
  → Stripe-Zahlung  →  Webhook  →  Callback POST /internal/payment-events { event: "paid" }
  → Ticket state=paid  →  E-Mail mit Ticket via EmailService
"expired"-Callback oder reservedUntil-Cron  →  state=cancelled, tier.sold--
```

**Ticket-QR (offline-verifizierbar):** Payload = kompaktes JWT, signiert mit dem
**Service-eigenen RS256-Private-Key** (gleiches Muster wie AuthService):
`{ tid, eid, oid, iat }`. Der Scanner (WavyBusiness-PWA) lädt den Public Key beim Start
(`GET /jwt/public-key`) und kann Signaturen **ohne Netz** prüfen; der Doppel-Einlass-Check
läuft online (bei Funkloch: Scanner-App puffert gescannte `tid`s lokal und synchronisiert —
Client-Logik, hier nur der Endpunkt). Nach jedem Weiterverkauf wird der QR **neu ausgestellt**
(alter Payload zeigt falschen `oid` → ungültig).

**Gast-Checkout (Onboarding über Tickets):** `POST /events/:id/tickets` ohne JWT, aber mit
`{ email }` → TicketService ruft AuthService `POST /internal/users/provision` (`X-API-Key`)
auf: existiert die E-Mail, wird das bestehende Konto verwendet (`isNewUser: false`), sonst ein
neues mit Rolle `consumer` angelegt (`isNewUser: true`). Das Ticket gehört dann diesem `sub`.

> ⚠️ **Kein JWT/Refresh-Token für den Client an dieser Stelle.** Provisionierung beweist nur,
> dass irgendjemand diese E-Mail-Adresse eingetippt hat — nicht, dass er sie besitzt. Bei
> `isNewUser: false` (E-Mail gehört bereits einem Bestandsaccount) würde ein automatisch
> ausgestelltes Token dem Käufer eine authentifizierte Session für einen **fremden** Account
> geben. Der Client bleibt nach dem Kauf ausgeloggt; Login erfolgt erst nach bewiesenem
> E-Mail-Besitz über den bestehenden AuthService-Flow.

**Konto-Aktivierung (nur bei `isNewUser: true`):** TicketService löst automatisch
AuthService `POST /user/password-reset-request?email=...` aus (bestehender Endpoint —
kein neuer Auth-Endpoint nötig; in der App als „Konto aktivieren" statt „Passwort vergessen"
gelabelt). Erst nach `POST /user/reset-password` mit dem Mail-Token bekommt der Client über
den regulären Login-Endpoint sein JWT + Refresh-Token. Bei `isNewUser: false` wird **kein**
Reset ausgelöst — sonst bekäme ein fremder Bestandsaccount unaufgefordert eine Reset-Mail,
nur weil jemand seine Adresse beim Checkout eingetippt hat.

**Claim-Token / E-Mail-Korrektur (nur bei `isNewUser: true`):** Tippfehler in der E-Mail
dürfen den Kunden nicht aussperren — er kann die Bestätigungsmail dann naturgemäß nie
bekommen (Henne-Ei-Problem), der Identitätsnachweis muss also aus dem Kaufkontext selbst
kommen, nicht aus der E-Mail.

- Bei `isNewUser: true` erzeugt TicketService zusätzlich einen **Claim-Token**: HMAC-SHA256
  über `{ uid, exp }` mit `CLAIM_TOKEN_SECRET`, Gültigkeit `CLAIM_TOKEN_TTL_H` (default 48 h)
- Der Claim-Token wird **direkt auf der Kauf-Erfolgsseite** angezeigt/übergeben und zusätzlich
  in den Bestätigungslink der Ticket-Mail eingebettet — **nicht** als alleiniger Mail-Inhalt,
  da genau die Mail bei einem Tippfehler nie ankommt
- `POST /guest/correct-email` (siehe unten) validiert den Token, ruft dann AuthService
  `PATCH /internal/users/:id/email` auf (`X-API-Key`) — AuthService sperrt diesen Aufruf
  serverseitig zusätzlich auf `is_email_verify: false` (Defense-in-Depth, siehe AuthService-Issue)
- Bei `isNewUser: false` wird **kein** Claim-Token ausgestellt — sonst könnte jemand die
  E-Mail eines fremden, zufällig noch unverifizierten Bestandsaccounts eintippen und über
  die „Korrektur" dessen Account übernehmen
- Ein Claim-Token ist einmalig verwendbar (Redis-Key `claim:{uid}` wird nach erfolgreicher
  Korrektur gelöscht) und wird ungültig, sobald der Account verifiziert ist

**Zweitmarkt:** `POST /tickets/:id/list` mit `priceCents ≤ originalPrice × (1 + maxMarkupBps/10000)`,
sonst `400`. Kauf durch Dritte erzeugt eine PaymentService-Session (Auszahlung an den
Verkäufer, Plattformgebühr einbehalten); nach `paid`: `ownerId` wechselt, altes Ticket
`resold`, neues QR-JWT. Stornierte Events: alle `paid`-Tickets automatisch refunden
(PaymentService `/internal/refunds`).

---

## Public

| Method | Endpoint | Query | Description |
|--------|----------|-------|-------------|
| `GET` | `/events` | `?state=published&organizerId&from&page&limit` | Event-Liste |
| `GET` | `/events/:id` | — | Event-Detail inkl. Tier-Verfügbarkeit (`capacity - sold`) |
| `GET` | `/jwt/public-key` | — | Public Key für Offline-QR-Verifikation |
| `POST` | `/events/:id/tickets` | `{ tierId*, email? }` | Kauf starten (JWT **oder** `email` für Gast-Checkout) → `{ ticketId, checkoutUrl, claimToken? }` — `claimToken` nur bei `isNewUser: true`. Ausverkauft → `409` |
| `POST` | `/guest/correct-email` | `{ claimToken*, newEmail* }` | E-Mail-Adresse eines frisch provisionierten, noch unverifizierten Accounts korrigieren. Ungültiger/abgelaufener/bereits verwendeter Token → `403`; `newEmail` bereits vergeben → `409` |

## User (Bearer JWT)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/me/tickets` | — | Eigene Tickets inkl. QR-Payload (nur bei `state=paid`) |
| `GET` | `/tickets/:id/qr` | — | Aktuelles QR-JWT (nur Owner, nur `paid`) |
| `POST` | `/tickets/:id/list` | `{ priceCents* }` | Zweitmarkt-Listing (Policy-Check) |
| `DELETE` | `/tickets/:id/list` | — | Listing zurückziehen |
| `POST` | `/tickets/:id/buy` | — | Gelistetes Ticket kaufen → `{ checkoutUrl }` |

## Organizer (Bearer JWT, Rolle `organizer`; nur eigene Events, sonst `403`)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/events` | Event-Felder | Anlegen als `draft` → `201` |
| `PATCH` | `/events/:id` | änderbare Felder | `draft`: alles; `published`: nur `description`, `mediaIds`, Kapazität erhöhen |
| `POST` | `/events/:id/publish` | — | `draft → published` (Merchant-Onboarding beim PaymentService muss `complete` sein, sonst `409`) |
| `POST` | `/events/:id/cancel` | — | Storno + Auto-Refunds |
| `POST` | `/events/:id/scan` | `{ qrPayload* }` | Einlass: Signatur + `state=paid` + Owner-Match prüfen → `checkedIn`. Bereits eingelassen → `409` `{ error, checkedInAt }` |
| `GET` | `/events/:id/stats` | — | `{ sold, checkedIn, revenueCents }` pro Tier |

## Internal (X-API-Key)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/internal/payment-events` | `{ sessionId, sourceId, event }` | Callback vom PaymentService (idempotent) |
| `GET` | `/internal/events/:id` | — | Für WaveService/MarketService |

---

## Env (zusätzlich zur Basis)

```
TICKET_JWT_PRIVATE_KEY / TICKET_JWT_PUBLIC_KEY   # RS256, via Env (PEM), nie hardcoded
PAYMENT_SERVICE_URL / PAYMENT_SERVICE_API_KEY
AUTH_SERVICE_URL / AUTH_SERVICE_API_KEY          # Gast-Provisioning + E-Mail-Korrektur
EMAIL_SERVICE_URL / EMAIL_SERVICE_API_KEY
RESERVATION_TTL_MIN=10
CLAIM_TOKEN_SECRET                               # HMAC-Secret für Gast-Claim-Tokens
CLAIM_TOKEN_TTL_H=48
REDIS_URL                                        # Claim-Token-Einmalverwendung (claim:{uid})
```

## Akzeptanzkriterien (Test-Experte)

1. Paralleler Kauf der letzten beiden Tickets durch 5 Requests → genau 2 × `reserved`, 3 × `409`; `sold` nie > `capacity`
2. Abgelaufene Reservierung wird vom Cron storniert und die Kapazität wieder frei
3. `paid`-Callback doppelt → ein Ticket, eine E-Mail (idempotent)
4. Scan: gültiges QR → `checkedIn`; zweiter Scan → `409` mit `checkedInAt`; QR mit manipulierter Signatur → `403`; QR eines weiterverkauften Tickets (alter `oid`) → `403`
5. Zweitmarkt-Listing über Preisdeckel → `400`; nach Resale funktioniert nur das neue QR
6. Gast-Checkout mit neuer E-Mail legt genau einen AuthService-Account an (idempotent bei Retry)
7. Event-Storno refundiert alle `paid`-Tickets genau einmal
8. Gast-Checkout mit `isNewUser: true` liefert einen `claimToken`; mit `isNewUser: false` (bestehende E-Mail) **keinen** — und löst auch keinen Passwort-Reset für den fremden Account aus
9. `POST /guest/correct-email` mit gültigem, unbenutztem Token korrigiert die Adresse; derselbe Token ein zweites Mal → `403`; abgelaufener Token → `403`
10. `POST /guest/correct-email` für einen Account, der zwischenzeitlich bereits verifiziert wurde (z. B. Kunde hat doch noch die alte Mail bekommen und den Account aktiviert) → `403`, da AuthService die `is_email_verify`-Sperre serverseitig durchsetzt
11. Client erhält zu keinem Zeitpunkt im Gast-Checkout-Flow ein JWT/Refresh-Token — Login ist ausschließlich nach `POST /user/reset-password` über den regulären Login-Endpoint möglich
