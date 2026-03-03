# PAI-X API Endpoints

**Version:** 1.0
**Datum:** 2026-02-26
**Basis:** PRD v1.0 — MVP Phase 1

---

## Basis-URL

```
Lokal:      http://localhost:8000/api/v1
Production: https://api.paix.hrcodelabs.de/api/v1
```

## Authentication

Alle Endpoints (ausser `/auth/*`) erfordern einen JWT Bearer Token:
```
Authorization: Bearer <jwt_token>
```

---

## 1. Auth Endpoints

### POST /auth/register
Neuen Benutzer registrieren.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| email | string | E-Mail-Adresse |
| password | string | Passwort (min. 8 Zeichen) |
| name | string | Anzeigename |
| **Response 201** | | |
| id | uuid | User ID |
| email | string | E-Mail |
| name | string | Name |
| created_at | datetime | Erstellungszeitpunkt |

### POST /auth/login
Login und JWT-Token erhalten.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| email | string | E-Mail-Adresse |
| password | string | Passwort |
| **Response 200** | | |
| access_token | string | JWT Access Token |
| refresh_token | string | JWT Refresh Token |
| token_type | string | "bearer" |
| expires_in | int | Sekunden bis Ablauf |

### POST /auth/refresh
Access Token erneuern.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| refresh_token | string | Gueltigter Refresh Token |
| **Response 200** | | |
| access_token | string | Neuer JWT Access Token |
| expires_in | int | Sekunden bis Ablauf |

### POST /auth/logout
Session beenden.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 200** | | |
| message | string | "Logged out successfully" |

### GET /auth/me
Aktuellen Benutzer abrufen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 200** | | |
| id | uuid | User ID |
| email | string | E-Mail |
| name | string | Name |
| avatar_url | string | nullable |
| timezone | string | z.B. "Europe/Berlin" |
| created_at | datetime | |

### POST /auth/oauth/{provider}
OAuth-Login (Google, GitHub).

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Path Parameter** | | |
| provider | string | "google" oder "github" |
| **Request Body** | | |
| code | string | OAuth Authorization Code |
| **Response 200** | | |
| access_token | string | JWT Access Token |
| refresh_token | string | JWT Refresh Token |

---

## 2. Chat Endpoints

### POST /chat
Chat-Nachricht senden (synchron, ohne Streaming).

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| message | string | Nutzernachricht |
| session_id | uuid | optional, fuer Gespraechs-Kontext |
| **Response 200** | | |
| id | uuid | Nachrichten-ID |
| session_id | uuid | Session-ID |
| content | string | Antwort-Text |
| skill_used | string | nullable, z.B. "calendar_briefing" |
| sources | array | Genutzte Memory-Nodes |
| created_at | datetime | |

### WebSocket /chat/stream
Real-time Chat mit Streaming-Antworten.

**Connection:**
```
ws://localhost:8000/api/v1/chat/stream?token=<jwt>
```

**Client → Server (Message):**
```json
{
  "type": "message",
  "content": "Was steht morgen an?",
  "session_id": "uuid-optional"
}
```

**Server → Client (Stream-Chunk):**
```json
{
  "type": "chunk",
  "content": "Morgen hast du ",
  "session_id": "uuid",
  "message_id": "uuid"
}
```

**Server → Client (Stream-End):**
```json
{
  "type": "end",
  "message_id": "uuid",
  "skill_used": "calendar_briefing",
  "sources": [{"node_id": "uuid", "type": "Meeting", "name": "Rudolf Meier"}]
}
```

**Server → Client (Error):**
```json
{
  "type": "error",
  "message": "Skill execution failed",
  "code": "SKILL_ERROR"
}
```

### GET /chat/sessions
Alle Chat-Sessions abrufen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Query Parameter** | | |
| limit | int | Default 20, max 100 |
| offset | int | Default 0 |
| **Response 200** | | |
| sessions | array | Liste von Session-Objekten |
| total | int | Gesamtanzahl |

**Session-Objekt:**
```json
{
  "id": "uuid",
  "title": "Autogenerierter Titel",
  "last_message_at": "datetime",
  "message_count": 12,
  "created_at": "datetime"
}
```

### GET /chat/sessions/{session_id}/messages
Nachrichten einer Session abrufen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Path Parameter** | | |
| session_id | uuid | Session-ID |
| **Query Parameter** | | |
| limit | int | Default 50 |
| before | uuid | Cursor-Pagination |
| **Response 200** | | |
| messages | array | Liste von Nachrichten |

### POST /chat/feedback
Feedback zu einer Antwort geben.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| message_id | uuid | Nachrichten-ID |
| rating | string | "positive" oder "negative" |
| comment | string | optional |
| **Response 200** | | |
| message | string | "Feedback saved" |

---

## 3. Calendar Endpoints

### GET /calendar/today
Alle Termine fuer heute.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 200** | | |
| events | array | Liste von Events |
| date | string | "2026-02-26" |

**Event-Objekt:**
```json
{
  "id": "string",
  "title": "Meeting mit Rudolf",
  "start": "2026-02-26T10:00:00+01:00",
  "end": "2026-02-26T11:00:00+01:00",
  "participants": [
    {"name": "Rudolf Meier", "email": "rudolf@example.com"}
  ],
  "location": "Zoom",
  "context": {
    "last_meeting": "2026-02-10",
    "open_items": ["Angebot finalisieren"],
    "person_notes": "Steuerberater, Pilot-Kunde"
  }
}
```

### GET /calendar/upcoming
Kommende Termine (naechste 7 Tage).

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Query Parameter** | | |
| days | int | Default 7, max 30 |
| **Response 200** | | |
| events | array | Liste von Events |

### GET /calendar/briefing
Tages-Briefing generieren (wird auch vom Cron-Job genutzt).

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Query Parameter** | | |
| date | string | Default heute, Format YYYY-MM-DD |
| **Response 200** | | |
| briefing | object | Strukturiertes Briefing |

**Briefing-Objekt:**
```json
{
  "date": "2026-02-26",
  "greeting": "Guten Morgen, Oliver.",
  "events": [...],
  "priorities": [
    {"text": "Agent One Pilot vorbereiten", "source": "TELOS.GOALS"}
  ],
  "open_items": [
    {"text": "Angebot an Benjamin senden", "due": "2026-02-27", "from_meeting": "uuid"}
  ],
  "idea_of_the_day": {
    "content": "PAI-X fuer Zahnarztpraxen adaptieren",
    "created_at": "2026-02-20"
  }
}
```

---

## 4. TELOS Endpoints

### GET /telos
Alle 10 TELOS-Dimensionen abrufen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 200** | | |
| dimensions | object | Alle 10 Dimensionen |
| last_updated | datetime | Letzte Aenderung (global) |

### GET /telos/{dimension}
Eine spezifische Dimension abrufen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Path Parameter** | | |
| dimension | string | Einer von: mission, goals, projects, beliefs, models, strategies, narratives, learned, challenges, ideas |
| **Response 200** | | |
| dimension | string | Dimensionsname |
| content | object | Inhalt der Dimension |
| entries | array | Einzelne Eintraege |
| last_updated | datetime | |

**Entry-Objekt:**
```json
{
  "id": "uuid",
  "content": "Agent One Pilot mit Benjamin Arras starten",
  "source": "agent" | "user",
  "status": "active" | "review_needed" | "completed",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### PUT /telos/{dimension}
Dimension aktualisieren (Nutzer-Edit).

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| entries | array | Aktualisierte Eintraege |
| **Response 200** | | |
| dimension | string | |
| entries | array | Aktualisierte Liste |

### POST /telos/{dimension}/entries
Neuen Eintrag zu einer Dimension hinzufuegen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| content | string | Inhalt |
| metadata | object | optional |
| **Response 201** | | |
| id | uuid | Neuer Entry |

### DELETE /telos/{dimension}/entries/{entry_id}
Eintrag loeschen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 204** | | Kein Content |

### POST /telos/{dimension}/entries/{entry_id}/confirm
Vom Agenten hinzugefuegten Eintrag bestaetigen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 200** | | |
| message | string | "Entry confirmed" |

---

## 5. Memory Endpoints

### GET /memory/search
Semantische Suche durch den Knowledge Graph.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Query Parameter** | | |
| q | string | Suchanfrage |
| type | string | optional: person, meeting, project, idea, task, document |
| since | datetime | optional, nur Ergebnisse nach diesem Datum |
| limit | int | Default 10, max 50 |
| **Response 200** | | |
| results | array | Liste von Memory-Nodes |
| total | int | |

### GET /memory/nodes/{node_id}
Einen spezifischen Node abrufen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 200** | | |
| node | object | Node mit allen Attributen |
| relations | array | Verbundene Nodes |

### GET /memory/persons
Alle Personen-Nodes abrufen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Query Parameter** | | |
| limit | int | Default 20 |
| **Response 200** | | |
| persons | array | Liste von Person-Nodes |

### GET /memory/persons/{person_id}
Person mit vollstaendigem Kontext.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 200** | | |
| person | object | Person-Node |
| meetings | array | Letzte Meetings |
| projects | array | Gemeinsame Projekte |
| tasks | array | Zugewiesene Tasks |
| last_contact | datetime | |

---

## 6. Skills Endpoints

### GET /skills
Alle verfuegbaren Skills auflisten.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 200** | | |
| skills | array | Liste von Skill-Objekten |

**Skill-Objekt:**
```json
{
  "id": "calendar_briefing",
  "name": "Calendar & Briefing",
  "description": "Proaktives Terminmanagement und taegliches Briefing",
  "active": true,
  "autonomy_level": 3,
  "last_execution": "datetime",
  "execution_count": 42,
  "success_rate": 0.95
}
```

### GET /skills/{skill_id}
Skill-Details abrufen.

### PUT /skills/{skill_id}
Skill-Konfiguration aendern.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| active | bool | optional |
| autonomy_level | int | 1-5, optional |
| config | object | Skill-spezifische Config |
| **Response 200** | | |
| skill | object | Aktualisierter Skill |

### GET /skills/{skill_id}/logs
Ausfuehrungslog eines Skills.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Query Parameter** | | |
| limit | int | Default 10 |
| **Response 200** | | |
| logs | array | Ausfuehrungslogs |

---

## 7. Notifications Endpoints

### GET /notifications
Alle Benachrichtigungen abrufen.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Query Parameter** | | |
| unread_only | bool | Default false |
| limit | int | Default 20 |
| **Response 200** | | |
| notifications | array | |

**Notification-Objekt:**
```json
{
  "id": "uuid",
  "type": "pre_meeting_alert" | "daily_briefing" | "deadline_warning" | "follow_up",
  "title": "Meeting mit Rudolf in 60 Minuten",
  "content": "Beim letzten Mal habt ihr ueber...",
  "read": false,
  "created_at": "datetime",
  "action_url": "/chat?context=meeting-uuid"
}
```

### PUT /notifications/{notification_id}/read
Notification als gelesen markieren.

### POST /notifications/read-all
Alle Notifications als gelesen markieren.

### GET /notifications/settings
Notification-Einstellungen abrufen.

### PUT /notifications/settings
Notification-Einstellungen aendern.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| daily_briefing_time | string | z.B. "07:30" |
| pre_meeting_minutes | int | z.B. 60 |
| channels | object | {"telegram": true, "pwa_push": true, "email": false} |
| **Response 200** | | |
| settings | object | Aktualisierte Settings |

---

## 8. Internal Endpoints (nur fuer n8n / Celery)

Diese Endpoints sind nur ueber das interne Netzwerk erreichbar und erfordern einen internen API-Key.

### POST /internal/trigger/daily-briefing
Tages-Briefing generieren und versenden.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Header** | | |
| X-Internal-Key | string | Interner API-Key |
| **Response 200** | | |
| sent_to | array | Kanaele an die gesendet wurde |

### POST /internal/trigger/pre-meeting-alert
Pre-Meeting Alert generieren und versenden.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Request Body** | | |
| event_id | string | Google Calendar Event ID |
| minutes_until | int | Minuten bis zum Termin |
| **Response 200** | | |
| sent_to | array | |

### POST /internal/trigger/follow-up-check
Follow-up Pruefung nach Meetings.

### POST /internal/trigger/deadline-warning
Deadline-Warnung generieren.

---

## 9. Health & System Endpoints

### GET /health
Health Check.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| **Response 200** | | |
| status | string | "healthy" |
| version | string | API-Version |
| services | object | Status aller verbundenen Services |

**Beispiel:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "services": {
    "postgres": "connected",
    "redis": "connected",
    "graphiti": "connected",
    "falkordb": "connected"
  }
}
```

### GET /health/ready
Readiness Check (fuer Kubernetes/Docker).

### GET /health/live
Liveness Check.

---

## Fehler-Format (alle Endpoints)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      {"field": "email", "message": "Must be a valid email address"}
    ]
  }
}
```

**HTTP Status Codes:**
| Code | Bedeutung |
|------|-----------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request (Validation) |
| 401 | Unauthorized (Token fehlt/abgelaufen) |
| 403 | Forbidden (keine Berechtigung) |
| 404 | Not Found |
| 422 | Unprocessable Entity |
| 429 | Rate Limited |
| 500 | Internal Server Error |
