# WaveService

> Base URL: `https://wave.<wavy-domain>` · Phase 1 (MVP)

Verwaltet den kompletten **Kampagnen-Lifecycle** („Waves"): anlegen, terminieren, live schalten,
beitreten, teilen, mit Beiträgen anreichern. Herzstück des Ökosystems — GeoService,
ActivationService, TicketService und MarketService referenzieren Waves per `waveId`.

**Zustandsmaschine:**

```
draft ──publish──▶ live ──(endsAt erreicht / manuell)──▶ completed
  │                  │
  └────cancel────────┴──▶ cancelled
```

- Übergänge nur durch Ersteller oder Admin; ungültige Übergänge → `409`
- Ein Cron-Job (alle 60 s) setzt `live → completed`, wenn `endsAt` überschritten ist,
  und `draft → live` bei erreichtem `startsAt`, falls `autoPublish: true`

**Datenmodell `Wave`:**

| Feld | Typ | Description |
|------|-----|-------------|
| `id` | String | Dokument-ID |
| `title` | String | max. 120 Zeichen |
| `description` | String | max. 5.000 Zeichen |
| `category` | String | Enum: `event`, `commerce`, `help`, `nature`, `recruiting`, `culture` |
| `type` | String | Enum: `adhoc` (sofort live, kurze Dauer) \| `scheduled` (festes Zeitfenster) |
| `state` | String | Enum: `draft`, `live`, `completed`, `cancelled` |
| `creatorId` | String | JWT `sub` des Erstellers (Rolle `merchant`, `organizer` oder `creator`) |
| `startsAt` / `endsAt` | Date | Zeitfenster; `endsAt > startsAt`, max. Dauer 30 Tage |
| `autoPublish` | Boolean | Bei `scheduled`: automatisch live schalten |
| `venue` | Object | `{ name, lat, lng, h3Cell }` — Geschäftsdaten des Veranstaltungsorts (kein Nutzer-Standort). `h3Cell` (Res 9) serverseitig aus lat/lng berechnen (`h3-js`) |
| `mediaIds` | String[] | MediaService-Referenzen |
| `linkedTicketEventId` | String | optional, TicketService-Event |
| `linkedProductIds` | String[] | optional, MarketService-Drops |
| `maxParticipants` | Number | optional; `0` = unbegrenzt |
| `stats` | Object | `{ joins, shares, contributions, checkins }` — denormalisierte Zähler |
| `createdAt` / `updatedAt` | Date | Auto |

**Datenmodell `WaveMembership`:**

| Feld | Typ | Description |
|------|-----|-------------|
| `waveId` | String | Referenz |
| `userId` | String | JWT `sub` |
| `referredBy` | String | userId aus dem Referral-Code, `null` bei organischem Beitritt |
| `joinedAt` | Date | Auto |

Unique-Index auf `(waveId, userId)` — doppelter Beitritt → `409`.

**Datenmodell `WaveContribution`:**

| Feld | Typ | Description |
|------|-----|-------------|
| `waveId` / `userId` | String | Referenzen; nur Mitglieder dürfen beitragen |
| `body` | String | max. 2.000 Zeichen |
| `mediaId` | String | optional, MediaService |
| `createdAt` | Date | Auto |

**Referral-Codes (Share-to-Earn-Basis):** `POST /waves/:id/share` erzeugt
`<userId>.<waveId>.<hmac>` (HMAC-SHA256 mit `REFERRAL_SECRET`, Base64url). Der Code wird als
Query-Parameter in den Share-Link eingebettet (`https://app.<wavy-domain>/w/:id?ref=<code>`).
Beim Join mit `ref` wird der HMAC validiert; ungültige Codes werden **ignoriert** (Join klappt
trotzdem, `referredBy: null`) — nie den Beitritt an einem kaputten Ref-Code scheitern lassen.

**Reputation-Events:** Nach Join/Contribution/Share feuert der Service ein Event an den
ProfileService (`POST /internal/xp-events` mit `X-API-Key`): `{ userId, type: "wave.join" |
"wave.share" | "wave.contribution", waveId, timestamp }`. Fire-and-forget mit Retry (3×,
exponentiell) — Fehler dürfen den Nutzer-Request nie blockieren.

---

## Public (ohne Auth — Discovery muss ohne Login funktionieren)

| Method | Endpoint | Query | Description |
|--------|----------|-------|-------------|
| `GET` | `/waves` | `?state=live&category&h3Cells=<csv>&page&limit` | Wave-Liste; `h3Cells` filtert auf Map-Ausschnitt (Venue-Zelle ∈ Liste). Default `state=live`, limit 20, max 100 |
| `GET` | `/waves/:id` | — | Einzelne Wave (nur `live`/`completed`; `draft` nur für Ersteller/Admin) |
| `GET` | `/waves/:id/contributions` | `?page&limit` | Beiträge, neueste zuerst |

## User (Bearer JWT)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/waves` | Wave-Felder (ohne `state`, `stats`) | Anlegen als `draft`; Rolle `merchant`/`organizer`/`creator` erforderlich → `201` |
| `PATCH` | `/waves/:id` | änderbare Felder | Nur Ersteller/Admin; im `draft` alles, ab `live` nur `description`, `mediaIds`, `endsAt` |
| `POST` | `/waves/:id/publish` | — | `draft → live` |
| `POST` | `/waves/:id/complete` | — | `live → completed` |
| `POST` | `/waves/:id/cancel` | — | `draft`/`live` → `cancelled` |
| `POST` | `/waves/:id/join` | `{ ref? }` | Beitreten (nur `live`); prüft `maxParticipants` (voll → `409`) |
| `DELETE` | `/waves/:id/join` | — | Wave verlassen |
| `POST` | `/waves/:id/share` | — | `{ shareUrl, ref }` — signierten Share-Link erzeugen; zählt `stats.shares` |
| `POST` | `/waves/:id/contributions` | `{ body*, mediaId? }` | Beitrag (nur Mitglieder, nur `live`) → `201` |
| `GET` | `/me/waves` | `?role=member\|creator&page&limit` | Eigene Waves |

## Internal (X-API-Key)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/internal/waves/:id` | — | Wave inkl. `draft` — für ActivationService/TicketService/MarketService |
| `POST` | `/internal/waves/:id/stats` | `{ field: "checkins", delta: 1 }` | Zähler erhöhen (vom ActivationService bei verifiziertem Check-in) |
| `GET` | `/internal/waves/:id/members` | `?page&limit` | Mitgliederliste für Attribution/Abrechnung |

## Admin (JWT Rolle `admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/waves` | Alle Waves inkl. `draft`/`cancelled`, Filter `?creatorId&state` |
| `DELETE` | `/admin/waves/:id` | Wave hart löschen (inkl. Memberships/Contributions) |

---

## Env (zusätzlich zur Basis)

```
REFERRAL_SECRET             # HMAC-Secret für Share-Codes
PROFILE_SERVICE_URL         # XP-Events
PROFILE_SERVICE_API_KEY
APP_BASE_URL                # für Share-Link-Aufbau
```

## Akzeptanzkriterien (Test-Experte)

1. Zustandsmaschine: jeder ungültige Übergang → `409`; Cron schaltet abgelaufene Waves um
2. Doppel-Join → `409`; Join auf `draft`/`completed` → `409`
3. Referral: gültiger Code setzt `referredBy`; manipulierter HMAC wird ignoriert (Join ok, `referredBy: null`)
4. `maxParticipants` wird unter parallelen Joins nicht überschritten (atomarer Counter-Check)
5. XP-Event-Ausfall (ProfileService down) blockiert keinen Request
