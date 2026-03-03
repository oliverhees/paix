# PAI-X -- Personal AI Assistant

PAI-X is a self-hosted Personal AI Assistant that acts as a digital Chief of Staff. It combines conversational AI with a persistent knowledge graph (TELOS identity layer), calendar awareness, proactive notifications, and configurable AI skills -- all under the user's full control.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend | FastAPI (Python 3.13+), async throughout |
| Database | PostgreSQL (via SQLAlchemy + asyncpg) |
| Cache/Queue | Redis, Celery (worker + beat) |
| Knowledge Graph | FalkorDB + Graphiti |
| AI | Anthropic Claude, OpenAI (configurable via LLM service) |
| Automation | n8n (cron triggers for briefings, alerts) |
| Notifications | Telegram Bot, PWA Push (planned) |
| Deployment | Docker Compose, nginx reverse proxy, Coolify-ready |

## Architecture

```
+-------------------+       +-------------------+       +-------------------+
|                   |       |                   |       |                   |
|   Next.js 15      | <---> |   FastAPI          | <---> |   PostgreSQL      |
|   (React 19)      |  API  |   (Python 3.13)    |       |   (async via      |
|   Port 3000       |       |   Port 8000        |       |    asyncpg)       |
|                   |       |                   |       |                   |
+-------------------+       +--------+----------+       +-------------------+
                                     |
                            +--------+----------+
                            |                   |
                    +-------+-------+   +-------+-------+
                    |               |   |               |
                    |   Redis       |   |   FalkorDB    |
                    |   (cache +    |   |   + Graphiti   |
                    |    Celery)    |   |   (knowledge  |
                    |               |   |    graph)     |
                    +-------+-------+   +---------------+
                            |
                    +-------+-------+
                    |               |
                    |   Celery      |
                    |   Worker +    |
                    |   Beat        |
                    |               |
                    +-------+-------+
                            |
                    +-------+-------+
                    |               |
                    |   n8n         |
                    |   (automation |
                    |    triggers)  |
                    |               |
                    +---------------+
```

### Data Flow

1. **Chat:** User sends message via WebSocket or POST. Backend enriches with TELOS context and knowledge graph memory, then streams response via LLM.
2. **TELOS:** 10-dimension identity layer (mission, goals, projects, beliefs, models, strategies, narratives, learned, challenges, ideas) stored in Graphiti with PostgreSQL snapshot backup.
3. **Calendar:** Google Calendar integration with Graphiti-enriched context (participant info, meeting history).
4. **Notifications:** n8n triggers internal API endpoints for daily briefings, pre-meeting alerts, follow-up checks, and deadline warnings. Delivered via Telegram and in-app.
5. **Skills:** Configurable AI capabilities (Calendar & Briefing, Content Pipeline, Meeting Prep, Follow-Up Tracker, Idea Capture) with per-user activation and autonomy levels.

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.13+
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis (or use Docker)

### Option 1: Docker (Recommended)

```bash
cd infra
docker compose up -d
```

This starts all services: web, api, postgres, redis, falkordb, graphiti, n8n, celery worker, celery beat.

### Option 2: Local Development

See [SETUP.md](./SETUP.md) for detailed step-by-step instructions.

```bash
# Backend
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd web
npm install
npm run dev
```

### Default Login

```
Email: oliver@test.de
Password: test1234
```

## API Documentation

- Interactive Swagger UI: `http://localhost:8000/api/v1/docs` (dev mode only)
- ReDoc: `http://localhost:8000/api/v1/redoc` (dev mode only)
- Full endpoint reference: [API.md](./API.md)

## Documentation Index

| File | Content |
|------|---------|
| [README.md](./README.md) | Project overview, architecture, quick start (this file) |
| [API.md](./API.md) | Complete API endpoint reference |
| [SETUP.md](./SETUP.md) | Developer setup guide |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 5-layer architecture, data flow, deployment |
| [ENDPOINTS.md](./ENDPOINTS.md) | Endpoint planning document |
| [SCHEMA.md](./SCHEMA.md) | Graphiti node types, relations, PostgreSQL tables, Redis |
| [USER-STORIES.md](./USER-STORIES.md) | MVP user stories with acceptance criteria |
| [DOCKER-SPEC.md](./DOCKER-SPEC.md) | Docker Compose specification for local development |

## Project Structure

```
paix/
  api/                  # FastAPI backend
    auth/               # JWT + password hashing
    models/             # SQLAlchemy ORM models
    routers/            # API endpoint handlers
    services/           # Business logic (chat, calendar, LLM, Graphiti, Telegram)
    tasks/              # Celery async tasks
    migrations/         # Alembic database migrations
    config.py           # Pydantic settings (env-based)
    main.py             # FastAPI app entry point
  web/                  # Next.js 15 frontend
    app/                # App Router pages
    components/         # React components (shadcn/ui based)
    hooks/              # Custom React hooks
    lib/                # Utilities, API client, types
  infra/                # Docker Compose, Dockerfiles, nginx
  docs/                 # Documentation
  tests/                # Test suites
  agents/               # AI agent definitions
```

## Key Features

- **Conversational AI** with streaming WebSocket support and session history
- **TELOS Identity Layer** -- 10-dimension profile that the AI uses for personalized responses
- **Knowledge Graph** -- persistent memory across conversations (persons, meetings, projects, tasks)
- **Calendar Integration** -- Google Calendar with AI-enriched context
- **Daily Briefings** -- automated morning summaries via Telegram
- **Configurable Skills** -- 5 built-in skills with per-user autonomy levels (1-5)
- **Proactive Notifications** -- meeting prep, follow-up reminders, deadline warnings
- **Dark Mode** -- theme system with multiple presets, scales, and border radius options
- **PWA Ready** -- manifest.json and mobile-optimized viewport
