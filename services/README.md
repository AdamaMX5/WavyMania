# WavyMania — Service-Spezifikationen

Diese Specs sind **Implementierungsvorlagen für Claude Code (Sonnet)**. Jede Datei beschreibt
einen Microservice vollständig genug, um ihn eigenständig zu bauen. Reihenfolge nach Phasen
aus [../übersichtPlan.md](../übersichtPlan.md):

| Phase | Service | Spec |
|-------|---------|------|
| 1 | WaveService | [WaveService.md](./WaveService.md) |
| 1 | GeoService | [GeoService.md](./GeoService.md) |
| 1 | ActivationService | [ActivationService.md](./ActivationService.md) |
| 2 | PaymentService | [PaymentService.md](./PaymentService.md) |
| 2 | TicketService | [TicketService.md](./TicketService.md) |
| 3 | MarketService | [MarketService.md](./MarketService.md) |
| 4 | TokenService | [TokenService.md](./TokenService.md) — ⛔ noch **nicht** implementieren |

> **Abgrenzung:** Nichts hiervon berührt die FlussMark oder deren Blockchain.

---

## Gemeinsame Konventionen (gelten für JEDEN Service)

Diese Regeln entsprechen der bestehenden Microservice-Architektur (siehe
`~/.claude/MSArchitecture/Architecture.md`) und werden in den einzelnen Specs
**nicht wiederholt**:

### Stack & Struktur

- **Node.js + Express**, MongoDB via Mongoose (außer GeoService: primär Redis)
- Code, Kommentare, Commits auf **Englisch**; Conventional Commits
- Projektstruktur: `src/routes/`, `src/models/`, `src/middleware/`, `src/services/`,
  `tests/` (Jest + Supertest, **≥ 80 % Coverage auf geänderten Dateien**)

### Auth

- **JWT (RS256)**: Public Key einmalig beim Start von
  `https://auth.freischule.info/jwt/public-key` holen und cachen; kein Round-Trip pro Request
- JWT-Payload: `sub` (userId), `email`, `roles[]`, `permissions{}`
- Neue Rollen für WavyMania: `consumer` (implizit: jeder eingeloggte User), `merchant`,
  `organizer`, `creator`, `admin`
- **X-API-Key** Header für interne Service-zu-Service-Aufrufe (Endpunkte unter `/internal/`)
- CORS wird auf NGINX-Ebene gehandhabt — **nicht** im Service

### Standard-Endpunkte (jeder Service)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | — | Hello World |
| `GET` | `/health` | — | `{ status: "ok", service: "<Name>" }` |
| `POST` | `/refresh-key` | JWT Admin | Gecachten JWT Public Key force-refreshen |

### Fehler & Logging

- Fehlerformat: `{ error: "<message>" }` mit passendem HTTP-Status
- Alle unbehandelten Fehler an den **ExceptionService** melden
- Standardcodes: `400` Validierung, `401` fehlendes/ungültiges JWT, `403` fehlende
  Rolle/Berechtigung, `404` nicht gefunden, `409` Konflikt, `429` Rate-Limit

### Env-Variablen (Basis, pro Service ergänzt)

```
PORT
MONGO_URI
AUTH_PUBLIC_KEY_URL=https://auth.freischule.info/jwt/public-key
INTERNAL_API_KEY            # eingehende /internal/-Calls
EXCEPTION_SERVICE_URL
```

- `.env` niemals committen; Keys/Secrets nur über Env-Variablen

### Sicherheits-Workflow (aus der Team-Konfiguration)

- Änderungen an Auth-Logik, Token-Handling und API-Endpunkten werden vom
  Sicherheits-Experten auditiert; **PaymentService, ActivationService und TicketService
  gelten komplett als auth-relevant** → Planfreigabe vor Implementierung
- Base URLs: Muster `https://<service>.<wavy-domain>` — finale Domain ist noch festzulegen,
  in den Specs steht der Platzhalter `<wavy-domain>`
