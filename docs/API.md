# PAI-X API Reference

**Base URL:** `http://localhost:8000/api/v1`
**Authentication:** JWT Bearer token (unless noted otherwise)

---

## Health

No authentication required.

### GET /health

Service health check with dependency status.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "development",
  "services": {
    "postgres": "connected",
    "redis": "connected",
    "graphiti": "connected",
    "falkordb": "connected"
  }
}
```

### GET /health/ready

Readiness check -- is the service ready to accept traffic?

**Response:** `{ "status": "ready" }`

### GET /health/live

Liveness check -- is the process running?

**Response:** `{ "status": "alive" }`

### GET /health (root)

Root-level health check at `http://localhost:8000/health` (outside `/api/v1` prefix). Used by Docker healthcheck.

**Response:** `{ "status": "ok" }`

---

## Auth

### POST /auth/register

Register a new user account. No authentication required.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "minimum8chars",
  "name": "User Name"
}
```

**Validation:**
- `email`: valid email format (EmailStr)
- `password`: 8-128 characters
- `name`: 1-255 characters

**Response (201):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "created_at": "2026-02-27T10:00:00Z"
}
```

**Errors:**
- `409`: Email already registered

### POST /auth/login

Login with email and password. No authentication required.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

**Errors:**
- `401`: Invalid email or password
- `403`: Account is deactivated

### POST /auth/refresh

Refresh an access token. No authentication required (uses refresh token in body).

**Request:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "expires_in": 1800
}
```

**Errors:**
- `401`: Invalid, expired, or revoked refresh token

### POST /auth/logout

Logout -- invalidates all refresh tokens for the user. **Auth required.**

**Response (200):**
```json
{ "message": "Logged out successfully" }
```

### GET /auth/me

Get the current authenticated user's profile. **Auth required.**

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "avatar_url": null,
  "timezone": "Europe/Berlin",
  "created_at": "2026-02-27T10:00:00Z"
}
```

### PUT /auth/me

Update the current user's profile. **Auth required.**

**Request:**
```json
{
  "name": "New Name",
  "avatar_url": "https://...",
  "timezone": "Europe/Berlin"
}
```
All fields are optional.

**Response (200):** Same as GET /auth/me with updated values.

---

## Chat

All endpoints require authentication.

### POST /chat

Send a chat message (synchronous, non-streaming).

**Request:**
```json
{
  "message": "Hello, what's on my schedule today?",
  "session_id": "uuid (optional)"
}
```

If `session_id` is omitted, a new session is created automatically.

**Response (200):**
```json
{
  "id": "uuid",
  "session_id": "uuid",
  "content": "Good morning! Here's your schedule...",
  "skill_used": null,
  "sources": [],
  "created_at": "2026-02-27T10:00:00Z"
}
```

### WebSocket /chat/stream

Real-time streaming chat via WebSocket. Authenticates via query parameter.

**Connection:** `ws://localhost:8000/api/v1/chat/stream?token=<jwt_access_token>`

**Send (JSON):**
```json
{
  "type": "message",
  "content": "Tell me about my goals",
  "session_id": "uuid (optional)"
}
```

**Receive (JSON) -- chunks:**
```json
{
  "type": "chunk",
  "content": "Based on ",
  "session_id": "uuid",
  "message_id": "uuid"
}
```

**Receive (JSON) -- end signal:**
```json
{
  "type": "end",
  "message_id": "uuid",
  "skill_used": null,
  "sources": []
}
```

**Receive (JSON) -- error:**
```json
{
  "type": "error",
  "message": "Error description",
  "code": "LLM_ERROR"
}
```

**WebSocket Close Codes:**
- `4001`: Missing or invalid token

### GET /chat/sessions

List all chat sessions for the current user.

**Query Parameters:**
- `limit` (int, default 20, max 100)
- `offset` (int, default 0)

**Response (200):**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "Schedule Discussion",
      "last_message_at": "2026-02-27T10:00:00Z",
      "message_count": 5,
      "created_at": "2026-02-27T09:55:00Z"
    }
  ],
  "total": 42
}
```

### GET /chat/sessions/{session_id}/messages

Get messages for a specific chat session.

**Query Parameters:**
- `limit` (int, default 50, max 100)
- `before` (uuid, optional) -- cursor for pagination

**Response (200):**
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Hello",
      "skill_used": null,
      "sources": [],
      "created_at": "2026-02-27T10:00:00Z"
    }
  ]
}
```

### POST /chat/feedback

Submit feedback for a chat message.

**Request:**
```json
{
  "message_id": "uuid",
  "rating": 5,
  "comment": "Very helpful!"
}
```

**Response (200):**
```json
{ "message": "Feedback saved" }
```

---

## Calendar

All endpoints require authentication.

### GET /calendar/today

Get all calendar events for today, enriched with Graphiti context.

**Response (200):**
```json
{
  "events": [
    {
      "title": "Team Standup",
      "start": "2026-02-27T09:00:00Z",
      "end": "2026-02-27T09:30:00Z",
      "participants": [{ "name": "Jane Doe", "email": "jane@example.com" }],
      "location": "Zoom",
      "context": { "person_notes": "CTO at PartnerCo, discussed API integration last week" }
    }
  ],
  "date": "2026-02-27"
}
```

### GET /calendar/upcoming

Get upcoming calendar events for the next N days.

**Query Parameters:**
- `days` (int, default 7, max 30, min 1)

**Response (200):**
```json
{
  "events": [ ... ],
  "days": 7
}
```

### GET /calendar/briefing

Generate an AI-powered daily briefing combining calendar, TELOS goals, open items, and idea of the day.

**Query Parameters:**
- `date_str` (string, optional, format "YYYY-MM-DD")

**Response (200):**
```json
{
  "briefing": {
    "date": "2026-02-27",
    "greeting": "Guten Morgen. Heute hast du 3 Termine...",
    "events": [ ... ],
    "priorities": [{ "text": "Launch MVP", "source": "TELOS.GOALS" }],
    "open_items": [{ "text": "Follow up with client", "due": "", "from_meeting": "" }],
    "idea_of_the_day": { "content": "Consider building a plugin system", "created_at": "..." }
  }
}
```

---

## TELOS (Identity Layer)

All endpoints require authentication. TELOS manages 10 dimensions: `mission`, `goals`, `projects`, `beliefs`, `models`, `strategies`, `narratives`, `learned`, `challenges`, `ideas`.

### GET /telos

Get all 10 TELOS dimensions with their entries.

**Response (200):**
```json
{
  "dimensions": {
    "mission": [
      {
        "id": "uuid",
        "content": "Build impactful AI products",
        "source": "user",
        "status": "active",
        "created_at": "...",
        "updated_at": "..."
      }
    ],
    "goals": [ ... ],
    ...
  },
  "last_updated": "2026-02-27T10:00:00Z"
}
```

### GET /telos/{dimension}

Get a specific TELOS dimension.

**Response (200):**
```json
{
  "dimension": "goals",
  "entries": [ ... ],
  "last_updated": "2026-02-27T10:00:00Z"
}
```

**Errors:**
- `404`: Unknown dimension name

### PUT /telos/{dimension}

Replace all entries in a TELOS dimension (user edit).

**Request (body is a JSON array):**
```json
[
  { "content": "Launch PAI-X MVP", "metadata": {} },
  { "content": "Grow user base to 100", "metadata": {} }
]
```

**Response (200):**
```json
{
  "dimension": "goals",
  "entries": [
    { "id": "uuid", "content": "Launch PAI-X MVP", "source": "user", "status": "active" }
  ]
}
```

### POST /telos/{dimension}/entries

Add a new entry to a TELOS dimension.

**Request:**
```json
{
  "content": "Learn Rust",
  "metadata": {}
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "content": "Learn Rust",
  "source": "user",
  "status": "active",
  "created_at": "...",
  "updated_at": "..."
}
```

### DELETE /telos/{dimension}/entries/{entry_id}

Delete (archive) a TELOS entry.

**Response:** `204 No Content`

### POST /telos/{dimension}/entries/{entry_id}/confirm

Confirm an agent-suggested TELOS entry.

**Response (200):**
```json
{ "message": "Entry confirmed" }
```

### POST /telos/{dimension}/agent

Agent-initiated entry addition (shown as green in frontend, status `review_needed`).

**Request:**
```json
{
  "content": "You seem interested in AI governance",
  "metadata": {}
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "content": "You seem interested in AI governance",
  "source": "agent",
  "status": "review_needed",
  "created_at": "...",
  "updated_at": "..."
}
```

---

## Memory (Knowledge Graph)

All endpoints require authentication.

### GET /memory/search

Semantic search through the Knowledge Graph.

**Query Parameters:**
- `q` (string, required) -- search query
- `type` (string, optional) -- node type filter
- `since` (string, optional) -- date filter
- `limit` (int, default 10, max 50)

**Response (200):**
```json
{
  "results": [ ... ],
  "total": 5,
  "query": "project deadline"
}
```

### GET /memory/nodes/{node_id}

Get a specific node from the Knowledge Graph with its relations.

**Response (200):**
```json
{
  "node": { "id": "...", "name": "...", "type": "..." },
  "relations": [ ... ]
}
```

### GET /memory/persons

List all person nodes in the Knowledge Graph.

**Query Parameters:**
- `limit` (int, default 20, max 100)

**Response (200):**
```json
{
  "persons": [ ... ],
  "total": 12
}
```

### GET /memory/persons/{person_id}

Get a person with full context (meetings, projects, tasks, last contact).

**Response (200):**
```json
{
  "person": { ... },
  "meetings": [ ... ],
  "projects": [ ... ],
  "tasks": [ ... ],
  "last_contact": "2026-02-20"
}
```

---

## Skills

All endpoints require authentication.

### GET /skills

Get all skills with configuration and execution stats. Default skills are automatically seeded on first access.

**Response (200):**
```json
{
  "skills": [
    {
      "id": "calendar_briefing",
      "name": "Calendar & Briefing",
      "description": "Proaktives Terminmanagement und taegliches Briefing",
      "active": true,
      "autonomy_level": 3,
      "last_execution": "2026-02-27T07:30:00Z",
      "execution_count": 42,
      "success_rate": 0.95
    }
  ]
}
```

### GET /skills/{skill_id}

Get details for a specific skill.

**Response (200):**
```json
{
  "skill": {
    "id": "calendar_briefing",
    "name": "Calendar & Briefing",
    "description": "...",
    "active": true,
    "autonomy_level": 3,
    "config": {}
  }
}
```

**Errors:**
- `404`: Skill not found

### PUT /skills/{skill_id}

Update skill configuration.

**Request:**
```json
{
  "active": true,
  "autonomy_level": 4,
  "config": { "custom_key": "value" }
}
```
All fields are optional.

**Validation:**
- `autonomy_level`: must be 1-5

**Response (200):** Same as GET /skills/{skill_id}.

**Errors:**
- `404`: Skill not found
- `422`: Invalid autonomy_level

### GET /skills/{skill_id}/logs

Get execution logs for a specific skill.

**Query Parameters:**
- `limit` (int, default 10, max 100)

**Response (200):**
```json
{
  "logs": [
    {
      "id": "uuid",
      "status": "success",
      "input_summary": "Daily briefing generation",
      "output_summary": "Briefing sent to 1 user",
      "duration_ms": 1234,
      "error_message": null,
      "created_at": "2026-02-27T07:30:00Z"
    }
  ]
}
```

---

## Notifications

All endpoints require authentication.

### GET /notifications

Get all notifications for the current user.

**Query Parameters:**
- `unread_only` (bool, default false)
- `limit` (int, default 20, max 100)

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "daily_briefing",
      "title": "Tages-Briefing",
      "content": "Guten Morgen...",
      "read": false,
      "action_url": null,
      "created_at": "2026-02-27T07:30:00Z"
    }
  ]
}
```

### PUT /notifications/{notification_id}/read

Mark a single notification as read.

**Response (200):**
```json
{ "message": "Notification marked as read" }
```

**Errors:**
- `400`: Invalid notification ID

### POST /notifications/read-all

Mark all notifications as read.

**Response (200):**
```json
{ "message": "All notifications marked as read" }
```

### GET /notifications/settings

Get notification settings for the current user.

**Response (200):**
```json
{
  "settings": {
    "daily_briefing_enabled": true,
    "daily_briefing_time": "07:30",
    "pre_meeting_enabled": true,
    "pre_meeting_minutes": 15,
    "follow_up_enabled": true,
    "follow_up_hours": 48,
    "deadline_warning_enabled": true,
    "deadline_warning_hours": 24,
    "channels": { "telegram": true, "pwa_push": false },
    "telegram_chat_id": null
  }
}
```

### PUT /notifications/settings

Update notification settings.

**Request:**
```json
{
  "daily_briefing_time": "08:00",
  "pre_meeting_minutes": 30,
  "channels": { "telegram": true, "pwa_push": true }
}
```
All fields are optional.

**Response (200):** Same as GET /notifications/settings with updated values.

### POST /notifications/test

Send a test notification to verify channel configuration.

**Request:**
```json
{
  "channel": "telegram"
}
```

**Response (200):**
```json
{ "message": "Test notification sent", "result": { ... } }
```

---

## Internal (Machine-to-Machine)

All internal endpoints require the `X-Internal-Key` header matching the `INTERNAL_API_KEY` environment variable. These are called by n8n automation workflows.

### POST /internal/trigger/daily-briefing

Generate and send daily briefing to all users with enabled notification settings. Called by n8n cron job at 07:30.

**Response (200):**
```json
{ "sent_to": ["oliver@test.de"] }
```

### POST /internal/trigger/pre-meeting-alert

Send a pre-meeting alert for an upcoming event.

**Request:**
```json
{
  "event_id": "google-calendar-event-id",
  "minutes_until": 15,
  "user_id": "uuid (optional)"
}
```

**Response (200):**
```json
{ "sent_to": ["oliver@test.de"] }
```

### POST /internal/trigger/follow-up-check

Check for overdue follow-ups and send reminders to all active users.

**Request (optional):**
```json
{
  "user_id": "uuid (optional)"
}
```

**Response (200):**
```json
{ "sent_to": ["oliver@test.de"] }
```

### POST /internal/trigger/deadline-warning

Check for approaching deadlines and send warnings to all active users.

**Request (optional):**
```json
{
  "user_id": "uuid (optional)"
}
```

**Response (200):**
```json
{ "sent_to": ["oliver@test.de"] }
```

---

## Common Error Responses

All error responses follow this format:

```json
{
  "detail": "Error description"
}
```

| Status Code | Meaning |
|-------------|---------|
| 400 | Bad Request -- invalid input |
| 401 | Unauthorized -- missing/invalid/expired token |
| 403 | Forbidden -- account deactivated |
| 404 | Not Found -- resource does not exist |
| 409 | Conflict -- duplicate resource (e.g., email) |
| 422 | Unprocessable Entity -- validation error |
| 503 | Service Unavailable -- dependency not configured |
