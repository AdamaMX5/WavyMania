# WavyMania — Frontend-Plan

> Ergänzt den [übersichtPlan.md](./übersichtPlan.md). Stack-Vorgabe aus der bestehenden
> Architektur: **React 18, TypeScript 5, Vite 5, TailwindCSS 3, react-router-dom 6**,
> Auth über JWT (AuthService), Nginx als Reverse Proxy.

---

## 1. Plattform-Entscheidung: PWA, Android-App oder beides?

### 1.1 Was ist eine PWA?

Eine **Progressive Web App** ist eine normale Website (unser React-Stack, unverändert),
die durch zwei Zusätze app-ähnlich wird:

1. **Web App Manifest** (`manifest.json`) — Name, Icon, Farben, Startbildschirm.
   Damit lässt sich die Seite „installieren": Sie bekommt ein Icon auf dem Homescreen
   und startet im Vollbild ohne Browser-Leiste.
2. **Service Worker** — ein Skript, das zwischen App und Netzwerk sitzt. Ermöglicht
   Offline-Caching, schnelle Ladezeiten und Push-Benachrichtigungen.

**Vorteile:** Kein App-Store nötig (kein Review, keine 15–30 % Store-Gebühr auf digitale
Käufe), sofortige Updates für alle Nutzer, ein einziger Codebase, Verteilung per Link/QR —
ideal für virale Kampagnen („Wave teilen" = Link öffnen, sofort dabei, keine Installationshürde).

**Grenzen einer PWA** (Stand heute, relevant für WavyMania):

| Fähigkeit | Android (Chrome) | iOS (Safari) |
|-----------|------------------|--------------|
| Installation auf Homescreen | ✅ | ✅ (umständlicher, kein Install-Prompt) |
| Push-Benachrichtigungen | ✅ | ⚠️ nur wenn als PWA installiert (seit iOS 16.4), unzuverlässiger als nativ |
| Kamera (QR-Scan) | ✅ `getUserMedia` | ✅ |
| GPS im Vordergrund | ✅ | ✅ |
| **GPS im Hintergrund** | ❌ | ❌ |
| **Bluetooth (BLE-Beacons)** | ✅ Web Bluetooth | ❌ |
| Sichtbarkeit im App Store / Play Store | ❌ | ❌ |

### 1.2 Empfehlung: PWA zuerst, dann Capacitor — keine separate Android-Entwicklung

**Ja, es soll eine Android-App (und iOS-App) geben — aber nicht nativ neu geschrieben.**

Der Weg heißt **Capacitor**: ein Open-Source-Werkzeug, das die fertige React-PWA in eine
echte native App verpackt (eine WebView plus native Plugins). Ergebnis:

- **Ein Codebase** (React/Vite) für Web, PWA, Android und iOS
- Native Plugins schließen genau die PWA-Lücken: zuverlässiger Push (FCM/APNs),
  Hintergrund-GPS (für das Peer-Radar), BLE-Beacons (spätere Check-in-Ausbaustufe),
  sicherer Token-Speicher (Keystore/Keychain)
- Store-Präsenz (Play Store + App Store) für Sichtbarkeit und Vertrauen

**Phasen:**

| Phase | Auslieferung | Begründung |
|-------|--------------|------------|
| MVP (Phase 1) | **Nur PWA** | Schnellster Weg zum Test der Kern-These; QR-Check-in + Vordergrund-GPS + Map funktionieren komplett im Browser |
| Phase 2 | **Capacitor-Build für Android** (Play Store) | Zuverlässiger Push für Wave-Benachrichtigungen; Android zuerst, weil Review lockerer und Zielgruppe größer |
| Phase 2/3 | **Capacitor-Build für iOS** (App Store) | ⚠️ Apple-Regel beachten: digitale Käufe in der iOS-App unterliegen ggf. der In-App-Purchase-Pflicht (30 %). Physische Waren, Tickets für reale Events und Merch sind davon **ausgenommen** — das deckt unseren Markt ab, muss aber beim Store-Review sauber argumentiert werden |
| Später | React Native / nativ | Nur falls die WebView-Performance auf der Live-Map nachweislich nicht reicht — nicht vorauseilend |

---

## 2. Eine App für alle — oder getrennte Apps?

### 2.1 Wie macht Amazon das?

Amazon trennt strikt nach Persona — **eigene Apps pro Rolle**:

- **Amazon Shopping** — Konsumenten-App (kaufen, suchen, Bestellungen)
- **Amazon Seller** — separate Händler-App (Angebote verwalten, Preise, Umsätze,
  Kundenkommunikation, Produktfoto-Scan); dazu **Seller Central** als Web-Dashboard
  für die eigentliche Verwaltungsarbeit am Desktop
- Weitere Rollen-Apps (Amazon Flex für Fahrer, Amazon Delivery usw.)

Die Gründe sind auf WavyMania übertragbar: Konsumenten- und Händler-Workflows haben
**nichts gemeinsame UI**, unterschiedliche Release-Zyklen, unterschiedliche
Sicherheitsanforderungen — und eine vollgestopfte App mit verstecktem „Business-Modus"
verwirrt beide Gruppen.

### 2.2 Empfehlung für WavyMania: zwei Frontends, ein Backend, eine Komponentenbibliothek

| Frontend | Zielgruppe | Form | Inhalt |
|----------|-----------|------|--------|
| **WavyApp** | Konsumenten | Mobile-first PWA → Capacitor | Live-Map, Waves entdecken/teilen, Check-in-Scanner, Tickets kaufen & vorzeigen, Drops kaufen, Profil/Level |
| **WavyBusiness** | Händler & Veranstalter | Desktop-first Web-Dashboard (AdminClient-Muster) **+ als PWA aufs Tablet/Handy installierbar** | Kampagnen anlegen (KI-Wave-Generator), Statistiken/CPA-Abrechnung, Produktkatalog, **rotierender Check-in-QR-Code** (Tablet an der Theke), **Ticket-Einlass-Scan** (Handy des Einlasspersonals) |

Warum die Business-Seite trotzdem *ein* Frontend bleibt (nicht Dashboard + Extra-Scan-App):
Der Einlass-Scan und der QR-Display-Modus sind je eine einzige Ansicht — dafür lohnt keine
eigene App. Die WavyBusiness-PWA auf dem Handy des Einlasspersonals reicht; Kamera-Scan
funktioniert im Browser.

**Gemeinsame Basis** (Monorepo, z. B. pnpm workspaces):

```
wavymania-frontend/
├── apps/
│   ├── wavy-app/          # Konsumenten (PWA + Capacitor)
│   └── wavy-business/     # Händler/Veranstalter (Web + PWA)
└── packages/
    ├── ui/                # Tailwind-Komponentenbibliothek (Buttons, Cards, Modals)
    ├── api-client/        # Typisierte Clients für alle Microservices
    └── auth/              # JWT-Handling, Refresh-Logik, Rollen-Guards
```

Die Rollentrennung selbst kommt aus dem **AuthService** (`roles[]`: `consumer`, `merchant`,
`organizer`, …) — beide Frontends sprechen dieselben APIs, sehen aber nur ihre Endpunkte.

---

## 3. Was eine moderne App können muss (Anforderungskatalog)

### 3.1 Kernfunktionen (WavyMania-spezifisch)

- **Live-Map** mit MapLibre GL: Heatmap-Hexagone, Wave-Pins, flüssiges Zoomen/Schwenken;
  Deltas per SSE (PresenceService), kein Polling
- **QR-Scanner** in der App (Check-in beim Händler, Einlass beim Event)
- **QR-Anzeige** (eigenes Ticket, mit Helligkeits-Boost beim Vorzeigen)
- **Geolocation** opt-in mit klarer Erklärung *warum* (Map-Beitrag), jederzeit abschaltbar
- **Share-Flows**: Wave teilen über Web Share API → nativer Share-Dialog des Systems;
  eingehende Share-Links mit Referral-Code öffnen direkt die Wave (**Deep Links /
  App Links**, auch aus Instagram/WhatsApp heraus)
- **Checkout in unter 60 Sekunden**: Apple Pay / Google Pay über Stripe Payment Element —
  der „Point of Emotion" verzeiht keine Formulare

### 3.2 Grundausstattung jeder modernen App

**Identität & Sicherheit**
- Login: E-Mail + Passwort, dazu Social Login (Google/Apple — Apple Sign-In ist im
  App Store Pflicht, sobald andere Social Logins angeboten werden)
- JWT-Handling: Access-Token nur im Speicher, Refresh-Token httpOnly-Cookie (Web) bzw.
  Keystore/Keychain (Capacitor); automatischer, unsichtbarer Refresh
- Biometrie-Entsperrung (Face ID / Fingerabdruck) in der Capacitor-App
- Session-Übersicht + Remote-Logout im Profil

**Zuverlässigkeit & Performance**
- **Offline-Verhalten**: Gekaufte Tickets müssen **ohne Netz** vorzeigbar sein
  (Festival-Funkloch!) — Ticket-QRs lokal cachen; Map zeigt letzten Stand + Hinweis
- Skeleton-Screens statt Spinner, Optimistic Updates (z. B. „Wave beigetreten" sofort anzeigen)
- Code-Splitting pro Route (Vite macht das fast von selbst), Bilder lazy + in modernen
  Formaten über den MediaService
- Ziel: interaktiv < 3 s auf einem Mittelklasse-Android im Mobilfunknetz

**Kommunikation**
- **Push-Benachrichtigungen** mit granularen Opt-ins pro Kategorie (Wave startet, Freunde
  in der Nähe, Drop live, Ticket-Erinnerung) — nie „alles oder nichts"
- In-App-Inbox als Fallback für Nutzer ohne Push-Erlaubnis
- E-Mail-Fallback über den EmailService (Kaufbelege, Tickets)

**UX-Standards**
- Dark Mode (Systemeinstellung folgen), responsive vom kleinen Android bis Desktop
- **i18n von Tag eins** (mind. de/en) — nachträglich einbauen ist teuer
- **Barrierefreiheit**: Tastatur-Bedienbarkeit, Screenreader-Labels, Kontraste (WCAG AA) —
  ab Juni 2025 für Consumer-Apps in der EU gesetzlich Pflicht
  (Barrierefreiheitsstärkungsgesetz / European Accessibility Act)
- Onboarding: erst App zeigen, **dann** Berechtigungen im Kontext erfragen
  (GPS-Prompt erst beim Öffnen der Map, Push-Prompt erst nach erstem Wave-Beitritt)
- Leere Zustände, Fehlerzustände und Ladezustände für **jede** Ansicht gestalten

**Recht & Datenschutz (DSGVO)**
- Consent-Management vor jedem Tracking; Analytics selbst gehostet oder cookielos
- Datenauskunft und Konto-Löschung **in der App** (Apple/Google verlangen die
  Lösch-Funktion inzwischen für den Store-Review)
- Standortdaten: nur H3-Zellen ans Backend (siehe übersichtPlan), Roh-GPS verlässt
  das Gerät nicht

**Betrieb**
- Fehler-Reporting an den **ExceptionService** (Source Maps hochladen, damit
  Stacktraces lesbar sind)
- Feature-Flags (einfacher eigener Endpoint reicht anfangs) für schrittweises Ausrollen
- Versionierte API-Clients; die App muss mit einer **älteren** Backend-Version nicht
  brechen und zeigt bei Pflicht-Updates einen freundlichen Update-Screen
- E2E-Smoke-Tests der kritischen Pfade (Login → Wave beitreten → Check-in → Ticketkauf);
  Frontend-Validierung sonst per PLAUSIBLE-Analyse gemäß Team-Workflow

---

## 4. Entscheidungs-Zusammenfassung

1. **Keine native Android-Entwicklung** (kein Kotlin) — React-PWA zuerst, dann derselbe
   Code via **Capacitor** in den Play Store (Phase 2) und App Store (Phase 2/3)
2. **Zwei Frontends nach Amazon-Vorbild**: WavyApp (Konsumenten, mobile-first) und
   WavyBusiness (Händler/Veranstalter, Dashboard + PWA für QR-Display und Einlass-Scan) —
   ein Monorepo, gemeinsame UI-/API-Pakete, Rollen aus dem AuthService
3. **PWA-Grenzen bewusst einpreisen**: Hintergrund-GPS und BLE gibt es erst mit Capacitor;
   der MVP braucht beides nicht
4. **Offline-Tickets, Push mit Opt-in-Granularität, Barrierefreiheit und In-App-Kontolöschung**
   sind keine Kür, sondern Store-/Gesetzes-Pflicht

---

## 5. Bottom-Navigation (WavyApp)

Fünf Tabs, angelehnt an Instagram/TikTok/YouTube/Amazon, aber um den Kern-Loop von WavyMania
herum gebaut („digitale Energie → physischer Besuch"), nicht um einen Feed. **Waves ist die
Default-/Home-Ansicht beim App-Start** (wie ein Feed); die Karte wird aktiv angeklickt, um Waves
& Co. auf einer echten Karte zu finden:

| # | Tab | Inhalt | Service(s) |
|---|-----|--------|------------|
| 1 | **Waves** (Home/Default) | Feed zum Entdecken, Beitreten, Teilen, Beiträge anreichern | WaveService |
| 2 | **Karte** | Live-Action-Map (Heatmap-Hexagone), aktive Waves in der Nähe; Check-in-QR-Scan erscheint kontextuell, wenn man an einem Venue ist | GeoService, PresenceService, ActivationService |
| 3 | **Erstellen** | Vereinfachter Wave-Ersteller für Privatpersonen (Rolle `creator`, self-service) | WaveService |
| 4 | **Marktplatz** | D2C-Drops, an Waves gekoppelte Produkte, Kauf am „Point of Emotion" | MarketService |
| 5 | **Profil** | Level/Reputation, Tickets (aktiv + abgelaufen), Käufe-Historie, Settings, Kontakt-QR (generieren + scannen) | ProfileService, TicketService, AuthService |

**Kein eigener Scan-Tab.** QR-Scan ist bewusst eine kontextuelle Aktion statt ein Tab:
- Check-in-QR scannen → in **Karte**, wenn man sich an einem Venue befindet
- Ticket-QR anzeigen (nicht scannen — Einlasskontrolle ist Personal-/WavyBusiness-Sache) →
  in **Profil → Tickets**
- Kontakt-QR generieren/scannen → in **Profil** (siehe 5.3)

**Mock-Implementierung:** ein erster klickbarer Prototyp liegt unter `apps/wavy-app/` (React 18 +
TypeScript + Vite + Tailwind 3 + react-router-dom 6). Karte nutzt MapLibre GL mit
OpenStreetMap-Raster-Tiles statt eines Platzhalters. Login läuft bereits gegen den echten,
produktiven AuthService (Email-first-Flow, siehe `AuthService.md`); alle anderen Backend-Services
sind dort noch als statische Mock-Daten im Frontend simuliert, da sie nur als Spezifikation
existieren.

### 5.1 Vereinfachter Creator-Flow (Tab „Erstellen")

Nutzt das bestehende `Wave`-Datenmodell aus `services/WaveService.md` unverändert — die Rolle
`creator` ist dort bereits als eigenständig von `merchant`/`organizer` vorgesehen
(`services/README.md`) und kann self-service vergeben werden, ohne Business-Verifizierung.
Das Frontend blendet gezielt Felder aus:

**Sichtbare Felder:**
- Titel, Beschreibung, 1 Foto/Video (MediaService)
- Kategorie (`event`, `commerce`, `help`, `nature`, `recruiting`, `culture`)
- Datum/Uhrzeit: Toggle „Jetzt" (→ `type: adhoc`, kurze Default-Dauer) vs. „Datum wählen"
  (→ `type: scheduled`, `startsAt`/`endsAt`) — deckt sowohl Spontan-Treffen als auch geplante
  Events ab (LAN-Party, Geburtstag, Nachbarschaftsgrillen, Demo)
- Ort (Adress-/Karten-Picker → `venue.lat/lng`, `h3Cell` serverseitig berechnet)
- Max. Teilnehmer (optional)

**Ausgeblendet** (bleibt WavyBusiness vorbehalten): `linkedTicketEventId`/`linkedProductIds`
(Ticket-/Produkt-Verknüpfung), Payment/Preisdeckelung, KI-Wave-Generator, CPA-Statistiken.

**Upsell-Hinweis:** dezenter Banner im Ersteller-Formular („Tickets verkaufen, Produkte
verknüpfen, KI-Werbemittel nutzen → Business-Konto beantragen"), führt in den
WavyBusiness-Onboarding-Flow (Rollen-Upgrade auf `merchant`/`organizer`, mit Verifizierung).

### 5.2 Kein Messaging-Tab — Kontakt-QR stattdessen

Ein voller Chat-Tab würde dem „echte Treffen statt zuhause chatten"-Ethos des Whitepapers
widersprechen. Stattdessen: ein **gegenseitiger Kontakt-QR-Code** in **Profil**.

- Jeder Nutzer kann einen persönlichen QR-Code anzeigen; empfohlen **rotierend** (TOTP-Muster
  wie beim Check-in-QR, z. B. alle 60 s), damit ein Screenshot nicht dauerhaft weitergegeben
  werden kann und eine Begegnung vortäuscht — finale Bestätigung bei der Detailplanung offen
- Scannt Person B den QR von Person A, entsteht ein **gegenseitiger** Kontakt-Eintrag bei
  A **und** B
- Kein neuer Microservice nötig: Erweiterung des bestehenden **ProfileService** nach dem
  gleichen signierten-Event-Muster wie `services/ActivationService.md`, nur User↔User statt
  User↔Location. Eigene Spezifikation folgt bei Detailplanung.
