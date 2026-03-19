# PAIONE API Backend

FastAPI Backend mit LangGraph Agent-Orchestrierung.

## Tech-Stack
- Python 3.12
- FastAPI 0.110+
- LangGraph 0.2+ (Multi-Agent Orchestration)
- LangChain 0.2+ (LLM Abstraction)
- Graphiti (Temporal Knowledge Graph)
- SQLAlchemy 2.x + Alembic (PostgreSQL ORM + Migrations)
- Celery 5.x (Background Tasks)
- Redis 7.x (Cache, Session, Queue)

## Struktur (geplant)
```
api/
├── routers/               # API Endpoints
│   ├── auth.py
│   ├── chat.py
│   ├── calendar.py
│   ├── telos.py
│   ├── memory.py
│   ├── skills.py
│   └── notifications.py
├── agents/                # LangGraph Agents
│   ├── router_agent.py
│   └── skills/
├── memory/                # Graphiti Integration
│   ├── client.py
│   └── schemas.py
├── mcp/                   # MCP Server Clients
│   ├── gmail.py
│   ├── calendar.py
│   └── drive.py
├── models/                # SQLAlchemy Models
├── schemas/               # Pydantic Schemas
├── core/                  # Config, Security, Dependencies
└── main.py                # FastAPI App Entry
```

## Hinweis
Anthropic Claude API als primaeres LLM (claude-sonnet-4-5 Standard, opus fuer komplexe Tasks).
