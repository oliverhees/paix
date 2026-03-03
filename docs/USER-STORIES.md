# PAI-X User Stories — MVP Phase 1

**Version:** 1.0
**Datum:** 2026-02-26
**Basis:** PRD v1.0 — MVP Must-Have + Should-Have

---

## Priorisierung

| Label | Bedeutung |
|-------|-----------|
| **P0** | Blocker — ohne das funktioniert nichts |
| **P1** | Must-Have — gehoert zum MVP-Kern |
| **P2** | Should-Have — wenn Zeit bleibt in Phase 1 |

---

## Woche 1: Setup und Grundstruktur

### US-01: Projekt-Setup und Mono-Repo
**Prioritaet:** P0
**Als** Entwickler **moechte ich** ein lauffaehiges Mono-Repo mit Next.js 16 Frontend und FastAPI Backend, **damit** ich sofort mit der Entwicklung beginnen kann.

**Akzeptanzkriterien:**
- [ ] Mono-Repo mit `/web`, `/api`, `/agents`, `/infra` existiert
- [ ] Next.js 16 (aus shadcn/ui Template) startet lokal auf Port 3000
- [ ] FastAPI startet lokal auf Port 8000
- [ ] Docker Compose startet alle Services (web, api, postgres, redis, falkordb, graphiti, nginx)
- [ ] Health-Check Endpoint `/api/v1/health` antwortet mit Status "healthy"
- [ ] TypeScript strict mode aktiv im Frontend
- [ ] Python 3.12 + FastAPI Skeleton mit Routing-Struktur

---

### US-02: Benutzer-Authentifizierung
**Prioritaet:** P0
**Als** Benutzer **moechte ich** mich registrieren und einloggen koennen, **damit** meine Daten geschuetzt sind und nur ich darauf zugreifen kann.

**Akzeptanzkriterien:**
- [ ] Registrierung mit E-Mail + Passwort funktioniert
- [ ] Login gibt JWT Access + Refresh Token zurueck
- [ ] Token-Refresh funktioniert
- [ ] Alle API-Endpoints (ausser Auth) erfordern gueltigen JWT
- [ ] OAuth Login mit Google funktioniert
- [ ] Session-Management in PostgreSQL
- [ ] Login/Register UI-Seite im Frontend

---

### US-03: TELOS Schema in Graphiti
**Prioritaet:** P0
**Als** System **moechte ich** das TELOS-Schema in Graphiti/FalkorDB definiert haben, **damit** das Identity Layer als Grundlage fuer alle Anfragen verfuegbar ist.

**Akzeptanzkriterien:**
- [ ] Graphiti + FalkorDB laufen in Docker
- [ ] Alle 10 TELOS-Dimensionen als TelosDimension-Nodes erstellt
- [ ] TelosEntry-Nodes koennen erstellt, gelesen, aktualisiert werden
- [ ] Initiale TELOS-Daten fuer Oliver manuell eingepflegt (Basis-Version)
- [ ] TELOS-Snapshot kann ueber API abgerufen werden (`GET /api/v1/telos`)
- [ ] TELOS wird in Redis gecacht (TTL 10 Min)

---

### US-04: Hetzner Server Provisioning
**Prioritaet:** P1
**Als** DevOps **moechte ich** die Hetzner-Server aufgesetzt und konfiguriert haben, **damit** ein Production-Deployment moeglich ist.

**Akzeptanzkriterien:**
- [ ] Server 1 (App: CX21) provisioniert
- [ ] Server 2 (Data: CX31) provisioniert
- [ ] Server 3 (Automation: CX11) provisioniert
- [ ] Private Network zwischen allen Servern eingerichtet
- [ ] SSH-Zugang konfiguriert
- [ ] Firewall-Regeln gesetzt (nur notwendige Ports offen)
- [ ] Docker auf allen Servern installiert

---

## Woche 2: Chat und Memory

### US-05: Chat Interface (Text)
**Prioritaet:** P0
**Als** Benutzer **moechte ich** einen Chat mit PAI-X fuehren koennen, **damit** ich Fragen stellen und Aufgaben delegieren kann.

**Akzeptanzkriterien:**
- [ ] Chat-UI mit Nachrichtenverlauf (shadcn/ui Komponenten)
- [ ] Eingabefeld mit Enter-zum-Senden
- [ ] Real-time Streaming der Antworten (kein Warten auf vollstaendige Antwort)
- [ ] WebSocket-Verbindung (Socket.io) zwischen Frontend und Backend
- [ ] Markdown in Antworten korrekt gerendert (Code-Bloecke, Listen, Tabellen)
- [ ] Kontext-Panel (rechts, ausklappbar) zeigt genutzte Memory-Nodes
- [ ] Skill-Indicator Badge zeigt welcher Skill aktiv ist
- [ ] Chat-History: Vergangene Sessions in Sidebar aufgelistet

---

### US-06: LangGraph Agent mit Context Enrichment
**Prioritaet:** P0
**Als** System **moechte ich** einen LangGraph-Agenten der jede Anfrage mit TELOS- und Graphiti-Kontext anreichert, **damit** Antworten personalisiert und kontextbezogen sind.

**Akzeptanzkriterien:**
- [ ] LangGraph Basic Agent laeuft (Single Agent, kein Multi-Agent)
- [ ] Jede Anfrage loest einen Graphiti-Query aus (Entity-Erkennung in der Anfrage)
- [ ] TELOS wird als Hintergrund-Kontext injiziert
- [ ] Antworten beziehen sich auf gespeicherte Informationen (z.B. Personen, Projekte)
- [ ] Intent Classification (deterministisch + LLM) routet zu richtigem Skill
- [ ] Anthropic Claude API (claude-sonnet-4-5) als LLM

---

### US-07: Memory Update nach Interaktion
**Prioritaet:** P1
**Als** System **moechte ich** nach jeder Interaktion relevante Informationen in Graphiti speichern, **damit** das Gedaechtnis kontinuierlich waechst.

**Akzeptanzkriterien:**
- [ ] ConversationEpisode wird nach jedem Chat-Turn in Graphiti gespeichert
- [ ] Erwaehnte Personen werden erkannt und mit Person-Nodes verknuepft
- [ ] Erwaehnte Projekte werden erkannt und verknuepft
- [ ] Neue Ideen werden automatisch als Idea-Nodes erstellt
- [ ] Memory-Update passiert async (Celery) — blockiert nicht die Antwort
- [ ] Chat-Messages werden in PostgreSQL gespeichert (chat_messages Tabelle)

---

### US-08: Chat-Session-Verwaltung
**Prioritaet:** P1
**Als** Benutzer **moechte ich** vergangene Gespraeche wiederfinden und fortsetzen koennen, **damit** kein Kontext verloren geht.

**Akzeptanzkriterien:**
- [ ] Neue Chat-Session wird automatisch erstellt
- [ ] Titel wird auto-generiert aus erster Nachricht
- [ ] Sidebar zeigt alle Sessions (neueste zuerst)
- [ ] Klick auf Session laedt den vollstaendigen Nachrichtenverlauf
- [ ] Session-Kontext wird beim Fortsetzen mitgegeben

---

## Woche 3: Kalender und Proaktivitaet

### US-09: Google Calendar Integration
**Prioritaet:** P0
**Als** Benutzer **moechte ich** meine Google Calendar Termine in PAI-X sehen, **damit** PAI-X meinen Zeitplan kennt und kontextuell helfen kann.

**Akzeptanzkriterien:**
- [ ] MCP Google Calendar Anbindung funktioniert
- [ ] OAuth-Flow fuer Google-Berechtigung (Calendar read/write)
- [ ] `GET /api/v1/calendar/today` gibt alle heutigen Termine zurueck
- [ ] `GET /api/v1/calendar/upcoming` gibt Termine der naechsten 7 Tage zurueck
- [ ] Termin-Daten werden mit Graphiti-Kontext angereichert (Teilnehmer-Infos)
- [ ] Calendar-Daten werden in Redis gecacht (TTL 15 Min)

---

### US-10: Taegliches Morgen-Briefing
**Prioritaet:** P1
**Als** Benutzer **moechte ich** jeden Morgen um 07:30 ein strukturiertes Briefing erhalten, **damit** ich vorbereitet in den Tag starte.

**Akzeptanzkriterien:**
- [ ] n8n Cron-Job triggert taeglich um 07:30 den Briefing-Endpoint
- [ ] Briefing enthaelt: Alle Termine des Tages mit Kontext
- [ ] Briefing enthaelt: Top-3-Priorities (aus TELOS Goals + offene Tasks)
- [ ] Briefing enthaelt: Offene Action Items der letzten 7 Tage
- [ ] Briefing enthaelt: "Idee des Tages" aus dem IDEAS-Pool
- [ ] Briefing wird als Notification im Dashboard angezeigt
- [ ] Briefing wird via Telegram Push gesendet
- [ ] `GET /api/v1/calendar/briefing` kann manuell aufgerufen werden

---

### US-11: Pre-Meeting Alert
**Prioritaet:** P1
**Als** Benutzer **moechte ich** 60 Minuten vor jedem Termin einen Kontext-Alert erhalten, **damit** ich vorbereitet in jedes Meeting gehe.

**Akzeptanzkriterien:**
- [ ] n8n prueft alle 15 Minuten: Termin in den naechsten 60 Minuten?
- [ ] Alert enthaelt: Wer kommt (Person-Node aus Graphiti)
- [ ] Alert enthaelt: Letztes Meeting mit dieser Person (Zusammenfassung)
- [ ] Alert enthaelt: Offene Action Items von beiden Seiten
- [ ] Alert enthaelt: Relevante Projekte
- [ ] Alert wird via Telegram Push gesendet
- [ ] Alert wird als Dashboard-Notification angezeigt
- [ ] Zeitfenster konfigurierbar (30/60/90 Minuten)

---

### US-12: Gmail Integration
**Prioritaet:** P1
**Als** System **moechte ich** Gmail lesen und senden koennen, **damit** PAI-X E-Mail-basierte Aktionen ausfuehren kann.

**Akzeptanzkriterien:**
- [ ] MCP Gmail Anbindung funktioniert
- [ ] OAuth-Flow fuer Gmail-Berechtigung
- [ ] E-Mails koennen gelesen werden (fuer Kontext)
- [ ] E-Mails koennen verfasst und gesendet werden (fuer Aktionen)
- [ ] E-Mail-Versand erfordert Bestaetigung (Autonomie-Level 3)

---

### US-13: Telegram Notifications
**Prioritaet:** P1
**Als** Benutzer **moechte ich** Benachrichtigungen ueber Telegram erhalten, **damit** ich auch ohne geoeffnete App informiert werde.

**Akzeptanzkriterien:**
- [ ] Telegram Bot eingerichtet
- [ ] Chat-ID des Nutzers konfigurierbar in Settings
- [ ] Briefing wird als formatierte Telegram-Nachricht gesendet
- [ ] Pre-Meeting Alerts werden als Telegram-Nachricht gesendet
- [ ] Telegram-Kanal kann pro Trigger ein/ausgeschaltet werden

---

### US-14: Dashboard Home View
**Prioritaet:** P1
**Als** Benutzer **moechte ich** eine Dashboard-Startseite mit Tagesuebersicht sehen, **damit** ich auf einen Blick weiss was heute ansteht.

**Akzeptanzkriterien:**
- [ ] Card-Grid Layout (shadcn/ui Template)
- [ ] "Heute" Card: Alle Termine als Timeline
- [ ] "Priorities" Card: Top-3-Tasks/Goals
- [ ] "Recent" Card: Letzte Aktivitaeten (Notizen, Gespraeche)
- [ ] Proaktive Notifications als Banner am oberen Rand
- [ ] Responsive Design (Mobile First, 375px)
- [ ] Sidebar-Navigation zu Chat, Dashboard, Settings

---

## Woche 4: Deployment und Testing

### US-15: Production Deployment
**Prioritaet:** P0
**Als** Benutzer **moechte ich** PAI-X ueber eine echte URL im Browser nutzen, **damit** ich es taeglich verwenden kann.

**Akzeptanzkriterien:**
- [ ] Alle Services laufen auf Hetzner (3-Server-Setup)
- [ ] Nginx Reverse Proxy konfiguriert
- [ ] SSL-Zertifikat (Let's Encrypt) aktiv
- [ ] Domain zeigt auf Hetzner Server
- [ ] PWA installierbar (Manifest + Service Worker)
- [ ] System Uptime >99%
- [ ] Chat-Antwortzeit P90 <3 Sekunden
- [ ] GitHub Actions CI/CD Pipeline laeuft

---

## Should-Have (P2 — wenn Zeit bleibt)

### US-16: Voice Input (Whisper)
**Prioritaet:** P2
**Als** Benutzer **moechte ich** Sprachnachrichten im Chat senden koennen, **damit** ich PAI-X auch unterwegs beim Gehen nutzen kann.

**Akzeptanzkriterien:**
- [ ] Mic-Button im Chat Interface
- [ ] Push-to-Talk Modus (Button halten zum Sprechen)
- [ ] Audio wird an faster-whisper gesendet (self-hosted)
- [ ] Transkription erscheint als Text-Nachricht im Chat
- [ ] Latenz <1 Sekunde fuer 10 Sekunden Audio
- [ ] Kein TTS (Text-to-Speech) — nur Input, nicht Output

---

### US-17: Termin verschieben
**Prioritaet:** P2
**Als** Benutzer **moechte ich** PAI-X bitten einen Termin zu verschieben, **damit** ich das nicht manuell machen muss.

**Akzeptanzkriterien:**
- [ ] Nutzer kann im Chat sagen: "Verschiebe den Termin mit Rudolf auf naechste Woche"
- [ ] PAI-X erkennt Intent, Person, neuen Zeitraum
- [ ] PAI-X findet passenden Slot im Kalender
- [ ] PAI-X verfasst E-Mail an die Person
- [ ] E-Mail wird zur Bestaetigung vorgeschlagen (Autonomie-Level 3)
- [ ] Nach Freigabe: E-Mail gesendet + Kalender aktualisiert
- [ ] Graphiti: Meeting-Node aktualisiert

---

### US-18: TELOS View (read-only)
**Prioritaet:** P2
**Als** Benutzer **moechte ich** mein TELOS-Profil im Dashboard einsehen koennen, **damit** ich sehe was PAI-X ueber mich weiss.

**Akzeptanzkriterien:**
- [ ] Tab-basierte Ansicht mit einer Dimension pro Tab
- [ ] Alle 10 Dimensionen werden angezeigt
- [ ] Agent-Eintraege sind gruen markiert
- [ ] Veraltete Eintraege sind orange markiert
- [ ] Read-only im MVP (editierbar ab Phase 2)
- [ ] Zeitstempel zeigen wann was zuletzt aktualisiert wurde

---

## Zusammenfassung

| Woche | Stories | Prioritaeten |
|-------|---------|-------------|
| Woche 1 | US-01 bis US-04 | 3x P0, 1x P1 |
| Woche 2 | US-05 bis US-08 | 2x P0, 2x P1 |
| Woche 3 | US-09 bis US-14 | 1x P0, 5x P1 |
| Woche 4 | US-15 | 1x P0 |
| Wenn Zeit | US-16 bis US-18 | 3x P2 |

**Gesamt:** 18 User Stories (7x P0, 8x P1, 3x P2)
