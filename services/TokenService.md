# TokenService

> Base URL: `https://token.<wavy-domain>` · Phase 4 · ⛔ **NICHT implementieren, bis Phasen 1–3 live sind und die anwaltliche MiCA-Prüfung vorliegt**

> **Abgrenzung:** Dieser Service betrifft ausschließlich den $WAVY-Token (Solana) des
> WavyMania-Projekts. Er hat **nichts** mit der FlussMark oder deren Blockchain zu tun und
> teilt mit ihr keinen Code.

Diese Datei ist bewusst nur eine **Rahmen-Spezifikation**: Sie hält die Architektur-Entscheidungen
fest, damit Phasen 1–3 die richtigen Schnittstellen vorbereiten — sie ist **keine**
Implementierungsvorlage. Vor der Umsetzung wird sie zu einer vollständigen Spec ausgebaut
(Planfreigabe + Security-Audit zwingend).

## Zweck

Einziger Ort im System mit Blockchain-Kontakt. Übersetzt **B2B-Umsatzereignisse**
(Kampagnenbuchungen, Ticket-/Marktplatzgebühren) in On-Chain-Aktionen:

1. **Burn** — prozentualer Anteil wird unwiderruflich verbrannt (deflationärer Supply)
2. **Global Impact Pool** — Anteil fließt in den Spenden-Pool
3. **Buyback** — fester Teil der operativen Fiat-Einnahmen kauft Token am freien Markt zurück

**Keine Token-Auszahlung an Endnutzer** (MiCA-Design des Whitepapers) — der Service hat
daher **keine** Consumer-Endpunkte.

## Architektur-Entscheidungen (bereits fixiert)

| Thema | Entscheidung |
|-------|--------------|
| Chain / Token | Solana, SPL-Token |
| SDK | `@solana/web3.js`; eigene On-Chain-Programme (Burn/Pool) mit **Anchor** |
| Governance | **Realms** (Solana-Standard) — nicht selbst bauen |
| Key-Handling | Signing-Keys nie im Service-Env; HSM oder dedizierte Signer-Infrastruktur (Entscheidung bei Ausbau der Spec) |
| Eingangsdaten | Konsumiert die bereits signierten Ereignisse der Phasen 1–3: Check-ins (`ActivationService /internal/checkins`, HMAC-signiert), PaymentService-Sessions (`paid`) |
| Idempotenz | Jede On-Chain-Aktion referenziert die Quell-Event-ID; doppelte Verarbeitung ausgeschlossen (Ledger-Collection mit Unique-Index) |

## Vorbereitung in Phasen 1–3 (das Einzige, was jetzt zählt)

- ActivationService signiert Check-ins (✅ in dessen Spec enthalten) → spätere Burn-Basis ist manipulationssicher
- PaymentService führt `feeCents` pro Session (✅ enthalten) → Bemessungsgrundlage für Buyback/Pool
- Beide bieten `/internal/`-Abfragen mit Zeitraumfilter (✅ enthalten) → der TokenService kann später batchen, ohne dass Phasen 1–3 angefasst werden müssen

## Geplante Schnittstellen (Skizze, nicht final)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/internal/revenue-events` | X-API-Key | B2B-Umsatzereignis einliefern (alternativ Pull-Batch per Cron) |
| `GET` | `/stats/supply` | — | Öffentlich: zirkulierender Supply, kumulierte Burns, Pool-Stand |
| `GET` | `/admin/ledger` | JWT Admin | Abgleich Off-Chain-Ereignis ↔ On-Chain-Transaktion |

## Offene Punkte vor Implementierung

1. Anwaltliche MiCA-Einstufung (Utility-/Governance-Token-These bestätigen)
2. Custody-/Signer-Konzept (HSM vs. MPC-Anbieter)
3. Tokenomics-Parameter final (Burn-Quote, Pool-Quote, Buyback-Anteil)
4. Audit der Anchor-Programme durch externe Security-Firma
