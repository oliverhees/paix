"""PAI-X API — FastAPI Application Entry Point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from models.database import init_db, close_db
from routers import health, chat, calendar, telos, memory, models
from routers import auth, skills, notifications, internal, integrations, reminders, werkzeuge, routines, telegram
from routers import agent_state
from routers import claude_oauth
from services.graphiti_service import graphiti_service
from services.llm_service import llm_service
from services.scheduler_service import start_scheduler, stop_scheduler, scheduler
from services.routine_scheduler_service import routine_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    await init_db()
    start_scheduler()
    routine_scheduler.init_scheduler(scheduler)
    await routine_scheduler.load_all_jobs()
    # Graphiti service uses lazy client init — no explicit startup needed
    yield
    # Shutdown
    stop_scheduler()
    await graphiti_service.close()
    await llm_service.close()
    from services.webhook_dispatch_service import webhook_dispatch_service
    await webhook_dispatch_service.close()
    await close_db()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Personal AI Assistant — Backend API",
    docs_url="/api/v1/docs" if settings.debug else None,
    redoc_url="/api/v1/redoc" if settings.debug else None,
    lifespan=lifespan,
)

# ──────────────────────────────────────────────
# Middleware
# ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# Routers
# ──────────────────────────────────────────────
# Health (no auth required)
app.include_router(health.router, prefix="/api/v1", tags=["health"])

# Auth (no auth required for register/login/refresh)
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])

# Protected routes (require JWT via get_current_user)
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(models.router, prefix="/api/v1", tags=["models"])
app.include_router(calendar.router, prefix="/api/v1", tags=["calendar"])
app.include_router(telos.router, prefix="/api/v1", tags=["telos"])
app.include_router(memory.router, prefix="/api/v1", tags=["memory"])
app.include_router(skills.router, prefix="/api/v1", tags=["skills"])
app.include_router(notifications.router, prefix="/api/v1", tags=["notifications"])

app.include_router(integrations.router, prefix="/api/v1", tags=["integrations"])
app.include_router(reminders.router, prefix="/api/v1", tags=["reminders"])
app.include_router(werkzeuge.router, prefix="/api/v1", tags=["werkzeuge"])
app.include_router(routines.router, prefix="/api/v1", tags=["routines"])
app.include_router(agent_state.router, prefix="/api/v1", tags=["agent-state"])

# Telegram webhook (public — Telegram verifies via bot token)
app.include_router(telegram.router, prefix="/api/v1", tags=["telegram"])

# Claude OAuth (PKCE flow for subscription token acquisition)
app.include_router(claude_oauth.router, prefix="/api/v1", tags=["claude-oauth"])

# Internal routes (protected by X-Internal-Key header)
app.include_router(internal.router, prefix="/api/v1", tags=["internal"])


@app.get("/health")
async def root_health():
    """Root-level health check for Docker healthcheck compatibility."""
    return {"status": "ok"}
