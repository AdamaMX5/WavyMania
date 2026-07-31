# WavyMania — Technischer Übersichtsplan

> **Abgrenzung:** Dieser Plan betrifft ausschließlich das WavyMania-Projekt (Whitepaper von Holger).
> Die **FlussMark** (eigene Kryptowährung mit Fließzins, Darlehensverträgen und Markt) und deren
> Blockchain sind ein **separates Projekt** und werden hier bewusst **nicht** vermischt — weder
> technisch (kein gemeinsamer Token-Unterbau) noch planerisch. Der im Whitepaper genannte
> $WAVY-Token läuft auf Solana und hat mit der FlussMark nichts zu tun.

---

## 1. Was das Whitepaper technisch tatsächlich fordert

Hinter dem Marketing-Text („Real-Life-Metaverse") stecken sechs konkrete technische Bausteine:

| # | Baustein | Kern |
|---|----------|------|
| 1 | **Waves** | Zeitlich/örtlich begrenzte Kampagnen (Ad-hoc oder terminiert), die Unternehmen/Creator anlegen und Nutzer teilen und „anreichern" |
| 2 | **Live-Action-Map** | Echtzeit-Karte, die physische Aktivität einer Region aggregiert anzeigt |
| 3 | **Verifizierte physische Präsenz** | Das Cost-per-Activation-Modell steht und fällt damit, dass ein Ladenbesuch fälschungssicher nachweisbar ist |
| 4 | **Reputations-/Level-System** | Statt Token-Auszahlung an Endnutzer (bewusst wegen MiCA) |
| 5 | **WavyTickets** | Ticketing mit App-Einlasskontrolle, Preisdeckelung, KI-generierten Werbemitteln |
| 6 | **Marktplatz (D2C)** | Produkt-Drops/Merchandise an Waves gekoppelt, Kauf „am Point of Emotion", Zweitmarkt mit Royalties |
| 7 | **$WAVY-Token auf Solana** | Burn-Mechanik, Buyback, Governance, Global Impact Pool — aber nur im B2B-Kreislauf |

> **Wichtigste Erkenntnis: Der Token ist vom Produkt entkoppelbar.**
> Das Whitepaper selbst sagt, Endnutzer bekommen keine Token. Die gesamte App (Waves, Map,
> Check-in, Reputation, Tickets, Markt) funktioniert ohne Blockchain — der Token ist ein
> B2B-Abrechnungs- und Tokenomics-Layer, der als letzte Phase draufgesetzt wird. Das verwandelt
> das Projekt von „Krypto-Projekt mit MiCA-Risiko" in „normale Plattform + späteres Token-Modul".

---

## 2. Mapping auf die bestehende Microservice-Architektur

Viel existiert schon:

| Baustein aus dem Whitepaper | Bestehender Service | Anmerkung |
|-----------------------------|---------------------|-----------|
| WavySocial ID | **AuthService** | JWT, Rollen, Permissions — passt direkt. „Verifizierte Unterstützerrollen" = `roles[]` / `permissions{}` |
| Nutzerprofile, Status-Ränge | **ProfileService** | Mehrere Profile pro User gibt es schon; Level/Badges als Profilerweiterung |
| Echtzeit-Push für die Live-Map | **PresenceService** | SSE-Infrastruktur existiert — Map-Deltas sind dieselbe Push-Semantik wie Online-Status |
| Bilder/Videos in Waves | **MediaService** | Unverändert nutzbar |
| Wave-Chat / Gruppenkoordination | **MessageService** + LiveKit | DMs vorhanden; LiveKit für Event-Streams |
| KI-Wave-Generator | **GitKiService-Muster** | Frontend-integrierbarer KI-Service existiert bereits — gleiches Muster, neuer Anwendungsfall (Claude API für Kampagnentexte/Werbemittel) |
| Schneller Prototyp der Wave-Datenhaltung | **ObjectService** | Waves sind anfangs nur JSON-Objekte — für den MVP reicht der generische Speicher, bevor ein eigener WaveService entsteht |
| Fehler-Reporting, E-Mail | **ExceptionService**, **EmailService** | Standard |

---

## 3. Neue Services

> 📁 **Detaillierte, implementierbare Spezifikationen** für jeden Service liegen unter
> [services/](./services/README.md) — inkl. Datenmodellen, Endpunkten, Env-Variablen und
> Akzeptanzkriterien für den Test-Experten.

Sechs neue Services, in dieser Reihenfolge:

### 3.1 WaveService

Kampagnen-Lifecycle (URL-Muster: `wave.freischule.info`):

- Anlegen, terminieren, teilen, beitreten, Beiträge anreichern
- Zustandsmaschine: **Draft → Live → Abgeschlossen**
- Node.js wie der Rest, REST + evtl. GraphQL
- Share-Links mit **signierten Referral-Codes** im Query-Parameter, damit später die Attribution
  („wer hat den Sale/Besuch gebracht") daran hängen kann

### 3.2 GeoService (Live-Map)

Der technisch interessanteste Teil:

- Clients senden **opt-in** Standort-Pings; der Service rastert sofort auf **H3-Zellen**
  (Ubers Hex-Grid, gute JS-Library) und speichert **nie Roh-Koordinaten** von Nutzern —
  das löst gleichzeitig das DSGVO-Problem und das Skalierungsproblem
- Aggregation pro Zelle in **Redis** (Counter mit TTL); die „Aktivitätsenergie" ist ein
  zeitlich abklingender Zähler pro Hexagon
- Auslieferung als Heatmap-Deltas über den bestehenden **PresenceService-SSE-Kanal**;
  Frontend rendert mit **MapLibre GL** (Open Source, kein Google-Maps-Lizenzrisiko)
- Zellen erst ab **k Nutzern** anzeigen (k-Anonymität), sonst wird das „Peer-Radar"
  zum Stalking-Werkzeug

### 3.3 ActivationService (Check-in / CPA)

Das Herzstück des Geschäftsmodells und der schwierigste Teil, weil GPS trivial fälschbar ist:

- **Rotierender QR-Code beim Händler** (Display oder Ausdruck mit TOTP-artigem Code,
  den die Händler-App alle 60 s erneuert), gescannt von der Nutzer-App
- Plus GPS-Plausibilitätscheck, plus Rate-Limits pro Gerät
- Nicht perfekt, aber verifizierbar genug für die Abrechnung; später durch **BLE-Beacons** ergänzbar
- Jeder verifizierte Check-in ist ein **signiertes Event** — daran hängen später
  CPA-Abrechnung, Reputation und Token-Burn

### 3.4 TicketService (WavyTickets)

- Ticketkauf, personalisierte QR-Tickets (signiert mit dem vorhandenen RS256-Key-Muster)
- Einlass-Scan über eine Veranstalter-Ansicht der App
- Zweitmarkt mit **Preisdeckel + Identitätsbindung** als Plattform-Feature (Modul im Service)
- Der Ticketkauf legt automatisch einen AuthService-Account an
  (das „Onboarding über Tickets" aus dem Whitepaper)

### 3.5 MarketService (D2C-Marktplatz)

Katalog, Bestand, Bestellungen:

- Produktkatalog der Brands/Creator; Kopplung eines Drops an eine Wave (Referenz auf WaveService)
- **Bestandsführung mit Reservierung** — deshalb gehört das nicht in den ObjectService:
  Ein limitierter Flash-Drop ist ein Race-Condition-Problem (500 Stück, 20.000 Interessenten
  im selben Moment). Braucht atomare Stock-Reservierung (Redis `DECR` mit Hold-TTL:
  Artikel wird beim Checkout-Start 5 Minuten reserviert, verfällt bei Nichtkauf)
  und ggf. eine Warteschlange
- Bestellungen und Fulfillment-Status (Merch muss versendet werden — Tickets nicht,
  deshalb ein anderer Lebenszyklus als im TicketService)
- Zweitmarkt für Merch als Modul: **Royalty-Prozentsatz an den Creator**

**Warum kein gemeinsamer „CommerceService" mit Tickets?** Für den MVP bei knappem Personal
legitim (ein Service, intern `items` mit Typ `ticket | product`). Empfohlen ist trotzdem die
Trennung, weil die Domänen auseinanderlaufen: Einlass-Scan, Saalpläne und Eventbindung auf der
einen Seite — Versand, Retouren und Bestand auf der anderen. Die Grenze Ticket/Produkt ist
stabil und offensichtlich — genau die Sorte Schnitt, an der Microservices funktionieren.

### 3.6 PaymentService (gemeinsame Zahlungsschicht)

- Stripe/Mollie-Integration, Checkout-Sessions, Webhooks
- Auszahlungen an Verkäufer über **Stripe Connect** (weil fremde Händler ausgezahlt werden —
  ohne das würde die Plattform regulatorisch selbst zum Zahlungsdienstleister)
- Wird von **TicketService und MarketService** genutzt: Geld-Logik an genau einer Stelle —
  das vereinfacht auch den Security-Audit-Workflow
- Zunächst klassisch (Fiat) — **nicht** mit Krypto-Payment anfangen

### Reputation: kein eigener Service

Das Reputations-/Level-System wird **nicht** als eigener Service gebaut, sondern als
Event-Konsument im **ProfileService**: Check-ins und Wave-Beiträge erzeugen Events,
Profile akkumulieren XP/Badges. Ein eigener Service lohnt erst, wenn die Regeln komplex werden.

---

## 4. Der $WAVY-Token — bewusst letzte Phase

*(Gehört zu WavyMania/Solana — hat nichts mit der FlussMark oder deren Blockchain zu tun.)*

- **SPL-Token auf Solana**; ein **TokenService** als einziger Ort mit Blockchain-Kontakt
  (`@solana/web3.js`, Anchor für die Burn-/Pool-Programme)
- Übersetzt B2B-Transaktionen (Kampagnenbuchung, Ticketgebühren) in Burn- und
  Impact-Pool-Anteile
- Governance nicht selbst bauen — **Realms** (Solana-Standard) nutzen
- ⚠️ **Warnung:** Die MiCA-Argumentation im Whitepaper („Utility-Token, keine Auszahlung an
  Konsumenten") ist eine juristische These, keine technische — vor dem Token-Launch braucht
  das anwaltliche Prüfung, egal wie sauber die Architektur ist

---

## 5. Phasenplan

| Phase | Inhalt | Services |
|-------|--------|----------|
| **1 — MVP** | Ohne Blockchain, ohne Payment. Kern-These („digitale Energie → physische Treffen") testbar machen | WaveService, GeoService, Live-Map im Frontend, Check-in per QR (ActivationService), Reputation im ProfileService |
| **2 — Ticketing + Payment** | Onboarding-Flow über Ticketkauf, Einlass-Scan | TicketService, PaymentService (Stripe) |
| **3 — B2B, Markt + Attribution** | Händler-Dashboard (AdminClient-Muster wiederverwenden), CPA-Abrechnung auf Basis der Check-in-Events, Server-to-Server-Attribution für Shop-Links, KI-Wave-Generator, Wave-gekoppelte Produkt-Drops | MarketService, AI-Service (GitKiService-Muster) |
| **4 — Token-Layer** | Burn/Impact-Pool, Governance (Realms) | TokenService |

---

## 6. Frontend & Zielplattform

- Stack bleibt: **React 18, TypeScript, Vite, Tailwind, react-router**
- Zielplattform ist klar **Mobile**: Live-Map + Kamera (QR-Scan) + Geolocation
- Empfehlung: mit einer **PWA** starten und **Capacitor** als App-Store-Weg einplanen,
  statt sofort React Native zu lernen

---

## 7. Fazit & Risiken

- Etwa die **Hälfte des Whitepapers** ist mit bestehenden Services abdeckbar
- Der echte Neubau konzentriert sich auf sechs Services (Kern: Wave, Geo, Activation)
- Das größte Risiko ist **nicht die Blockchain**, sondern die **fälschungssichere
  Anwesenheitsverifikation** — dort zuerst einen Prototyp bauen
- Nächste mögliche Schritte: API-Verträge für WaveService und ActivationService skizzieren
  oder eine `WaveService.md` im Stil der MSArchitecture-Doku anlegen
