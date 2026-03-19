# PAIX → PAIONE Migration Prompt

> **Diesen Prompt in die PAIX Claude Code Session einfügen.**

---

## Der Prompt:

```
Wir bauen PAIX um zu PAIONE (Personal AI · ONE).

PAIONE ist dasselbe System wie PAIX, aber mit fundamentalen Unterschieden:

## 1. REBRANDING: PAIX → PAIONE

Überall im gesamten Projekt:
- "PAIX" → "PAIONE" (Code, Kommentare, Variablen, Strings)
- "PAI-X" → "PAIONE"
- "paix" → "paione" (package.json name, Docker service names, DB name, etc.)
- "Personal AI Assistant" → "Personal AI · ONE — The personal AI that evolves with you."
- Logo/Branding: Primary Color bleibt Orange (#f97316)
- Subtitle: "The personal AI that evolves with you."
- Seitentitel, Browser-Tab, Meta-Tags: alles "PAIONE"
- Docker Images: paix-api → paione-api, paix-web → paione-web
- Datenbank: paix → paione
- Environment-Variablen mit PAIX-Prefix → PAIONE-Prefix

## 2. MULTI-USER → SINGLE-USER

PAIONE läuft IMMER nur für EINEN User auf einer eigenen Instanz. Kein SaaS, kein Multi-Tenant.

Was zu tun ist:
- Auth-System (JWT, Login, Register) KOMPLETT ENTFERNEN
- Kein Login-Screen, kein Register-Screen
- Kein auth Middleware auf API-Routen
- Stattdessen: Ein fester Default-User der beim ersten Start automatisch erstellt wird
- Alle `get_current_user` Dependency Injections ersetzen durch den festen User
- Die `users` Tabelle bleibt, aber es gibt immer nur EINEN Eintrag
- OAuth (Google, Claude) ENTFERNEN — nicht nötig für Single-User
- JWT Token-Handling ENTFERNEN
- Session Management VEREINFACHEN — keine Token-Rotation nötig
- Die (auth) Route-Group im Frontend entfernen (kein /login, /register)
- Das Dashboard ist direkt nach dem Start ohne Login erreichbar
- Setup-Wizard beim ersten Start: Name, API-Key, Sprache — dann fertig

## 3. S3 OBJECT STORAGE → LOKALER SPEICHER

PAIONE nutzt den lokalen Festplattenspeicher statt S3:
- S3/Boto3 komplett entfernen
- Neuer Storage-Service: Dateien werden in `DATA/storage/` auf der Festplatte gespeichert
- Upload/Download über lokales Filesystem
- S3-Config aus .env.example entfernen
- Hetzner Object Storage Referenzen entfernen
- Der File-Manager im Frontend bleibt, zeigt aber lokale Dateien

## 4. PAIONE-SPEZIFISCHE FEATURES HINZUFÜGEN

Diese Features aus dem PAIONE-Projekt übernehmen:

### 4.1 Token Budget System
PAIONE hat ein hartes Token-Budget für jeden Context-Layer:
```
Temporal Context    →      50 tokens  (Datum/Uhrzeit)
Persona Files       →   1,500 tokens  (5 Dateien: identity, rules, skills, preferences, pinned)
TELOS Snapshot      →   1,000 tokens  (keyword-scored per message)
Graphiti Retrieval  →   3,000 tokens  (semantisch abgerufen)
Working Space       →  20,000 tokens  (Agent Tools + Response)
────────────────────────────────────
Fixed overhead:        5,550 tokens   (konstant)
```

Das muss in den Chat-Engine integriert werden:
- Token-Estimator: Schnelle Heuristik (~4 chars/token EN, ~3.5 DE)
- Jeder Layer wird auf sein Budget begrenzt
- Budget-Anzeige im Chat Info-Panel (schon im Frontend vorgesehen)

### 4.2 Persona Loader (5 Dateien)
Statt Persona in der Datenbank → 5 Markdown-Dateien:
- `USER/groups/persona/identity.md`
- `USER/groups/persona/rules.md`
- `USER/groups/persona/skills.md`
- `USER/groups/persona/preferences.md`
- `USER/groups/persona/pinned.md`

Fallback-Kette: Group-spezifisch → Global → Defaults (SYSTEM/defaults/persona/{locale}/)
Jede Datei max ~300 Tokens (proportional vom 1,500 Budget)

### 4.3 Keyword-basiertes TELOS Scoring
Statt alle TELOS-Dimensionen zu laden:
- Keywords aus jeder Dimension extrahieren
- Message gegen Keywords matchen
- Top-N Dimensionen laden bis 1,000 Token Budget voll
- Fallback: mission + goals wenn kein Match
- Stop-Words für EN + DE

### 4.4 Echtzeit-Monitoring (Logs + Tasks)
- WebSocket Event System für Live-Updates (log, task_update, status, etc.)
- Human-Readable Log Translation — technische Logs → "PAIONE denkt nach..."
- Status-Badges an allen Sidebar-Items (grün/gelb/rot/grau)
- Kanban Task Board (Backlog → In Progress → Done)
- Overview Dashboard mit Health-Stats

### 4.5 Nextra Dokumentation
Das Nextra Docs-Portal (docs/) aus dem PAIONE-Repo übernehmen:
- Next.js 16 + Nextra 4 mit bilingual (EN/DE)
- Docs unter docs.paione.ai deploybar

## 5. VERZEICHNISSTRUKTUR

PAIONE folgt dieser Struktur:
```
paione/
├── SYSTEM/                    # Infrastruktur (git-tracked)
│   ├── defaults/              # Default Persona + TELOS Templates (en/ + de/)
│   └── migrations/            # Datenbank-Migrationen
├── USER/                      # User-Customizations (nie überschrieben)
│   ├── groups/
│   │   ├── persona/           # 5 Persona-Dateien
│   │   └── telos/             # 10 TELOS-Dimensionen
│   └── .env                   # API Keys (GITIGNORED!)
├── DATA/                      # Runtime-Daten (GITIGNORED!)
│   ├── store/                 # Datenbank
│   ├── storage/               # Lokaler File Storage (statt S3)
│   ├── sessions/              # Session-Logs
│   └── logs/                  # Runtime-Logs
├── api/                       # FastAPI Backend (von PAIX)
├── web/                       # Next.js Frontend (von PAIX)
├── docs/                      # Nextra Dokumentation
├── docker-compose.yml
└── CLAUDE.md
```

## 6. WAS BLEIBEN KANN WIE ES IST

Folgendes aus PAIX muss NICHT geändert werden:
- Chat-Engine (funktioniert, nur Token-Budget hinzufügen)
- Skills System (funktioniert)
- Werkzeuge/MCP System (funktioniert)
- Routinen/Scheduler mit Celery (funktioniert)
- Reminders (funktioniert)
- Marketplace (funktioniert)
- TELOS Editor Frontend (funktioniert, nur Scoring-Logic anpassen)
- Settings Frontend (funktioniert, nur Auth-Settings entfernen)
- Sidebar + Layout (funktioniert)
- Docker Compose Grundstruktur (funktioniert)
- PostgreSQL + Redis + FalkorDB (funktioniert)
- Graphiti Integration (funktioniert)
- Telegram Bot Integration (funktioniert)

## 7. WAS ENTFERNT WERDEN MUSS

- Auth-System komplett (JWT, OAuth, Login, Register)
- S3/Boto3 Object Storage
- Claude OAuth Subscription Flow
- Multi-User Isolation Logic (user_id Filtering bleibt, aber nur 1 User)
- Google OAuth Flow
- Registrierung/Login Pages

## 8. DOKUMENTATION (Nextra Portal)

Im Projekt wird ein `docs/` Verzeichnis existieren mit einer kompletten Nextra-Installation (Next.js 16 + Nextra 4). Diese Doku wird aus dem bisherigen PAIONE-Repo hierher kopiert.

**DIRECTIVE 6: Living Documentation in Nextra**

Die Nextra-Dokumentation (`docs/`) ist die öffentliche Wahrheitsquelle für User. Sie MUSS mit dem Code synchron gehalten werden.

**Regeln:**
- Jedes neue Feature, Modul oder API das ein User nutzen würde → dokumentieren
- Jede neue Konfigurationsoption oder Umgebungsvariable → dokumentieren
- **Zweisprachig PFLICHT:** Jede Seite muss in EN (`docs/content/en/`) UND DE (`docs/content/de/`) existieren
- Deutsche Texte müssen natürlich klingen, nicht "übersetzt"
- Technische Begriffe bleiben Englisch: Token, Provider, Channel, Hook, Hands, MCP

**Docs-Struktur:**
```
docs/
├── content/
│   ├── en/                    # Englische Seiten
│   │   ├── guide/             # User Guide (für Anwender)
│   │   │   └── welcome.mdx
│   │   ├── dev/               # Developer Reference
│   │   │   ├── architecture.mdx
│   │   │   ├── core-modules.mdx
│   │   │   └── graphiti.mdx
│   │   ├── index.mdx
│   │   ├── getting-started.mdx
│   │   ├── configuration.mdx
│   │   └── telos.mdx
│   └── de/                    # Deutsche Seiten (Spiegel von en/)
│       └── ...
├── app/[lang]/layout.tsx      # Nextra App Router Layout
├── next.config.mjs            # Nextra Config
├── proxy.ts                   # i18n Locale Middleware
└── package.json               # next@16, nextra@4
```

**Nach jedem Schritt prüfen:**
1. Sind alle neuen Features/Module in Nextra dokumentiert?
2. Sind alle neuen Config-Optionen auf der Configuration-Seite?
3. Existieren beide Sprachversionen (EN + DE)?
4. Baut `cd docs && npm run build` noch erfolgreich?

Wenn Doku fehlt → ERSTELLEN bevor der Schritt als fertig gilt.

**Docs Dev-Server:** `cd docs && npm run dev` auf Port 3002

## 9. REIHENFOLGE

1. Rebranding (PAIX → PAIONE) — global suchen/ersetzen
2. Auth entfernen — Backend + Frontend
3. S3 → Lokaler Storage
4. Setup-Wizard für Ersteinrichtung (Name, API-Key, Sprache)
5. Token Budget System einbauen
6. Persona Loader (5 Dateien) einbauen
7. TELOS Keyword-Scoring einbauen
8. Echtzeit-Monitoring (Log Translation, Status Badges) einbauen
9. Dokumentation aktualisieren (Nextra, alle Änderungen in EN + DE)
10. Testen, dass alles funktioniert
11. Docker Compose anpassen

Arbeite jeden Schritt einzeln ab. Committe nach jedem Schritt.
Nach jedem Schritt: Docs-Check — ist die Dokumentation aktuell?
Frag NICHT nach — arbeite autonom durch.
```

---

## Hinweise für dich (Oliver):

1. **Vor dem Start:** PAIX-Repo klonen nach neues Verzeichnis (oder direkt im paione Repo das web/ und api/ ersetzen)
2. **docs/ Ordner kopieren:** Kopiere den `docs/` Ordner aus dem aktuellen PAIONE-Repo ins neue Projekt — das ist die komplette Nextra-Installation mit allen bilingualen Seiten
3. **Den Prompt** oben zwischen den ``` Backticks kopieren und in die PAIX Claude Code Session einfügen
4. **"Autonom"** am Ende hinzufügen wenn der Agent selbstständig durcharbeiten soll
5. **Die PAIONE-spezifischen Dateien** (Token Estimator, Persona Loader, TELOS Scorer, i18n Locales) können nach der Migration aus dem aktuellen PAIONE-Repo kopiert werden — sie sind als TypeScript in `SYSTEM/src/` geschrieben und müssten für Python/FastAPI portiert werden
