# GeoService

> Base URL: `https://geo.<wavy-domain>` · Phase 1 (MVP)

Aggregiert anonyme Standort-Pings zu einer **Live-Heatmap** auf H3-Hexagonen und liefert die
Daten für die Live-Action-Map. **Datenschutz ist hier Architektur, nicht Feature:** Der Service
speichert niemals Roh-Koordinaten oder Bewegungsprofile — nur Zähler pro Hexagon-Zelle.

**Grundprinzip:**

1. Der Client rechnet die eigene Position **auf dem Gerät** in eine H3-Zelle um
   (`h3-js`, Auflösung 9 ≈ 100 m Kantenlänge) und sendet **nur die Zell-ID**
2. Der Service inkrementiert einen Minuten-Bucket-Zähler in **Redis** —
   MongoDB wird hier nicht benötigt
3. Die „Aktivitätsenergie" einer Zelle = gewichtete Summe der letzten Buckets
   (jüngere Minuten zählen mehr → natürliches Abklingen)
4. Map-Deltas werden über den **PresenceService** (SSE) an Clients gepusht

**Redis-Datenlayout (kein Mongoose-Modell):**

| Key | Typ | TTL | Inhalt |
|-----|-----|-----|--------|
| `ping:{h3}:{minuteBucket}` | Counter | 30 min | Pings dieser Zelle in dieser Minute |
| `lastping:{userId}` | String | `PING_MIN_INTERVAL_S` | Rate-Limit-Marker |
| `dedup:{userId}:{minuteBucket}` | String | 90 s | verhindert Mehrfachzählung desselben Users pro Minute |

**Aktivitätsberechnung** (bei Lesezugriff, Ergebnis 10 s gecacht):

```
activity(cell) = Σ über Buckets b (jetzt − 0…29 min):
                 count(cell, b) × decay^ageMinutes(b)      // decay default 0.9
```

**k-Anonymität:** Zellen mit `uniqueUsers < K_MIN` (default 5) werden **nicht ausgeliefert**
(weder Wert noch Existenz). Für die Dedup-/Unique-Zählung pro Zelle ein HyperLogLog
(`PFADD users:{h3}:{minuteBucket}`) verwenden — auch das speichert keine auflösbaren User-IDs
dauerhaft. In der MVP-Testphase darf `K_MIN` per Env auf 1 gesenkt werden.

**Validierung der Zell-IDs:** `h3-js.isValidCell()` + Auflösung muss exakt 9 sein, sonst `400`.
Plausibilität: pro Ping wird die Distanz zur letzten Zelle des Users **nicht** geprüft
(dafür müsste man die letzte Zelle speichern = Bewegungsprofil) — Schutz erfolgt allein über
Rate-Limit + Dedup. Diese bewusste Entscheidung nicht „optimieren".

**Wave-Overlay:** `GET /map` liefert zusätzlich die Live-Waves im Ausschnitt. Dazu ruft der
GeoService den WaveService (`GET /waves?state=live&h3Cells=…`) auf und cacht das Ergebnis 30 s.
Venue-Zellen von Waves unterliegen **nicht** der k-Anonymität (Geschäftsdaten, kein Nutzer-Standort).

**Push-Integration:** Alle 10 s berechnet ein Loop die geänderten Zellen seit dem letzten
Tick und sendet sie an den PresenceService (`POST /internal/broadcast` mit `X-API-Key`,
Topic `map:{h3res5}` — ein grobes Eltern-Hexagon als Kanal, damit Clients nur ihre Region
abonnieren). Payload: `{ cells: [{ h3, activity }] }`. Entfallene Zellen (unter k) mit
`activity: 0` senden.

---

## User (Bearer JWT)

| Method | Endpoint | Body / Query | Description |
|--------|----------|--------------|-------------|
| `POST` | `/pings` | `{ h3* }` | Standort-Ping; Rate-Limit 1 pro `PING_MIN_INTERVAL_S` (default 30 s) pro User → `202` (leerer Body). Zu häufig → `429` |
| `GET` | `/map` | `?cells=<csv bis 200 H3-Zellen>` | `{ cells: [{ h3, activity }], waves: [{ id, title, category, venue }] }` — nur Zellen ≥ `K_MIN` |

> `GET /map` bewusst mit expliziter Zell-Liste statt BBox: Der Client berechnet die sichtbaren
> Zellen selbst (`h3-js.polygonToCells` auf den Viewport) — hält den Service dumm und cachebar.

## Internal (X-API-Key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/internal/activity/:h3` | Roh-Aktivität einer Zelle ohne k-Filter — für ActivationService-Plausibilität und Admin-Statistik |

## Admin (JWT Rolle `admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/stats` | `{ totalPingsLastHour, activeCells, topCells: [...] }` |

---

## Env (zusätzlich zur Basis)

```
REDIS_URL
K_MIN=5                     # k-Anonymität; Testphase: 1
DECAY=0.9
PING_MIN_INTERVAL_S=30
WAVE_SERVICE_URL
PRESENCE_SERVICE_URL
PRESENCE_SERVICE_API_KEY
```

## Akzeptanzkriterien (Test-Experte)

1. Ungültige oder falsch aufgelöste H3-Zelle → `400`
2. Zwei Pings desselben Users < 30 s → zweiter erhält `429` und zählt nicht
3. Derselbe User pingt 5× in einer Minute (nach Rate-Limit-Reset via TTL-Manipulation im Test):
   Zelle zählt ihn nur **einmal** pro Minute (Dedup)
4. Zelle mit 4 Unique-Usern (bei K_MIN=5) erscheint **nicht** in `/map`; mit 5 erscheint sie
5. Activity fällt ohne neue Pings monoton ab und erreicht nach 30 min 0
6. Kein Key in Redis enthält Koordinaten; kein Log enthält `lat`/`lng`
