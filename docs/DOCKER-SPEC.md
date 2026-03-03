# PAI-X Docker Compose Spezifikation

**Version:** 1.0
**Datum:** 2026-02-26
**Basis:** PRD v1.0

---

## Uebersicht Services

| Service | Image | Port (Host) | Port (Container) | Beschreibung |
|---------|-------|-------------|-------------------|--------------|
| web | custom (Dockerfile.web) | 3000 | 3000 | Next.js 16 Frontend |
| api | custom (Dockerfile.api) | 8000 | 8000 | FastAPI Backend |
| postgres | postgres:16-alpine | 5432 | 5432 | PostgreSQL Datenbank |
| redis | redis:7-alpine | 6379 | 6379 | Cache, Sessions, Queue |
| falkordb | falkordb/falkordb:latest | 6380 | 6379 | Graph-Datenbank (Graphiti Backend) |
| graphiti | custom (Dockerfile.graphiti) | 8001 | 8001 | Graphiti API Service |
| n8n | n8nio/n8n:latest | 5678 | 5678 | Workflow Automation |
| nginx | nginx:alpine | 80 / 443 | 80 / 443 | Reverse Proxy |
| celery_worker | custom (wie api) | - | - | Background Task Worker |
| celery_beat | custom (wie api) | - | - | Periodic Task Scheduler |

---

## Docker Compose (Lokale Entwicklung)

```yaml
version: "3.9"

services:
  # ──────────────────────────────────────────────
  # Frontend: Next.js 16
  # ──────────────────────────────────────────────
  web:
    build:
      context: ./web
      dockerfile: ../infra/dockerfiles/Dockerfile.web
    ports:
      - "3000:3000"
    volumes:
      - ./web:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
      - NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/chat/stream
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - paix-network

  # ──────────────────────────────────────────────
  # Backend: FastAPI
  # ──────────────────────────────────────────────
  api:
    build:
      context: ./api
      dockerfile: ../infra/dockerfiles/Dockerfile.api
    ports:
      - "8000:8000"
    volumes:
      - ./api:/app
    environment:
      - ENVIRONMENT=development
      - DEBUG=true
      - DATABASE_URL=postgresql+asyncpg://paix:${POSTGRES_PASSWORD}@postgres:5432/paix
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/1
      - CELERY_RESULT_BACKEND=redis://redis:6379/2
      - FALKORDB_HOST=falkordb
      - FALKORDB_PORT=6379
      - GRAPHITI_URL=http://graphiti:8001
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - INTERNAL_API_KEY=${INTERNAL_API_KEY}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      falkordb:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    networks:
      - paix-network

  # ──────────────────────────────────────────────
  # PostgreSQL 16
  # ──────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    environment:
      - POSTGRES_DB=paix
      - POSTGRES_USER=paix
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U paix -d paix"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - paix-network

  # ──────────────────────────────────────────────
  # Redis 7.x
  # ──────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - paix-network

  # ──────────────────────────────────────────────
  # FalkorDB (Graph-Datenbank)
  # ──────────────────────────────────────────────
  falkordb:
    image: falkordb/falkordb:latest
    ports:
      - "6380:6379"
    volumes:
      - falkordb_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-p", "6379", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - paix-network

  # ──────────────────────────────────────────────
  # Graphiti API Service
  # ──────────────────────────────────────────────
  graphiti:
    build:
      context: ./api
      dockerfile: ../infra/dockerfiles/Dockerfile.graphiti
    ports:
      - "8001:8001"
    environment:
      - FALKORDB_HOST=falkordb
      - FALKORDB_PORT=6379
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      falkordb:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    networks:
      - paix-network

  # ──────────────────────────────────────────────
  # n8n (Workflow Automation)
  # ──────────────────────────────────────────────
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - WEBHOOK_URL=http://localhost:5678
      - GENERIC_TIMEZONE=Europe/Berlin
      - TZ=Europe/Berlin
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - paix-network

  # ──────────────────────────────────────────────
  # Nginx (Reverse Proxy)
  # ──────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infra/nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - web
      - api
    networks:
      - paix-network

  # ──────────────────────────────────────────────
  # Celery Worker (Background Tasks)
  # ──────────────────────────────────────────────
  celery_worker:
    build:
      context: ./api
      dockerfile: ../infra/dockerfiles/Dockerfile.api
    command: celery -A core.celery_app worker --loglevel=info --concurrency=4 -Q default,proactive,memory
    volumes:
      - ./api:/app
    environment:
      - ENVIRONMENT=development
      - DATABASE_URL=postgresql+asyncpg://paix:${POSTGRES_PASSWORD}@postgres:5432/paix
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/1
      - CELERY_RESULT_BACKEND=redis://redis:6379/2
      - FALKORDB_HOST=falkordb
      - FALKORDB_PORT=6379
      - GRAPHITI_URL=http://graphiti:8001
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    depends_on:
      - api
      - redis
      - postgres
    networks:
      - paix-network

  # ──────────────────────────────────────────────
  # Celery Beat (Periodic Task Scheduler)
  # ──────────────────────────────────────────────
  celery_beat:
    build:
      context: ./api
      dockerfile: ../infra/dockerfiles/Dockerfile.api
    command: celery -A core.celery_app beat --loglevel=info
    volumes:
      - ./api:/app
    environment:
      - ENVIRONMENT=development
      - CELERY_BROKER_URL=redis://redis:6379/1
      - CELERY_RESULT_BACKEND=redis://redis:6379/2
    depends_on:
      - redis
    networks:
      - paix-network

# ──────────────────────────────────────────────
# Volumes
# ──────────────────────────────────────────────
volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  falkordb_data:
    driver: local
  n8n_data:
    driver: local

# ──────────────────────────────────────────────
# Networks
# ──────────────────────────────────────────────
networks:
  paix-network:
    driver: bridge
```

---

## Health Checks pro Service

| Service | Check | Interval | Timeout | Retries | Start Period |
|---------|-------|----------|---------|---------|-------------|
| web | curl http://localhost:3000 | 30s | 10s | 3 | 30s |
| api | curl http://localhost:8000/api/v1/health | 30s | 10s | 3 | 15s |
| postgres | pg_isready -U paix -d paix | 10s | 5s | 5 | - |
| redis | redis-cli ping | 10s | 5s | 5 | - |
| falkordb | redis-cli -p 6379 ping | 10s | 5s | 5 | - |
| graphiti | curl http://localhost:8001/health | 30s | 10s | 3 | 20s |
| n8n | curl http://localhost:5678/healthz | 30s | 10s | 3 | 30s |

---

## Environment Variables (.env.example)

```bash
# ──────────────────────────────────────────────
# PAI-X Environment Configuration
# ──────────────────────────────────────────────

# ─── PostgreSQL ───
POSTGRES_PASSWORD=your_secure_password_here

# ─── JWT / Auth ───
JWT_SECRET=your_jwt_secret_min_32_chars_here
NEXTAUTH_SECRET=your_nextauth_secret_here

# ─── Internal API (n8n → FastAPI) ───
INTERNAL_API_KEY=your_internal_api_key_here

# ─── Anthropic (LLM) ───
ANTHROPIC_API_KEY=sk-ant-your-key-here

# ─── OpenAI (optional, Fallback fuer Whisper/Embeddings) ───
OPENAI_API_KEY=sk-your-key-here

# ─── Google OAuth + APIs ───
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ─── Telegram Bot ───
TELEGRAM_BOT_TOKEN=123456:ABC-your-telegram-bot-token
TELEGRAM_CHAT_ID=your_chat_id

# ─── n8n ───
N8N_ENCRYPTION_KEY=your_n8n_encryption_key

# ─── ElevenLabs (Phase 2 — Voice TTS) ───
# ELEVENLABS_API_KEY=your_elevenlabs_key

# ─── LiveKit (Phase 2 — Voice WebRTC) ───
# LIVEKIT_API_KEY=your_livekit_key
# LIVEKIT_API_SECRET=your_livekit_secret
# LIVEKIT_URL=wss://your-livekit-server

# ─── Environment ───
ENVIRONMENT=development
DEBUG=true
TZ=Europe/Berlin
```

---

## Ports-Uebersicht (Lokale Entwicklung)

```
localhost:80     → Nginx (Reverse Proxy)
localhost:3000   → Next.js Frontend
localhost:8000   → FastAPI Backend
localhost:5432   → PostgreSQL
localhost:6379   → Redis
localhost:6380   → FalkorDB
localhost:8001   → Graphiti API
localhost:5678   → n8n Dashboard
```

---

## Netzwerk-Architektur

```
                    ┌─── Browser ───┐
                    │  localhost:80  │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │    nginx      │
                    │  :80 / :443   │
                    └──┬─────────┬──┘
                       │         │
              /app/*   │         │  /api/*
                       │         │
              ┌────────▼──┐  ┌──▼──────────┐
              │   web     │  │    api       │
              │  :3000    │  │   :8000      │
              └───────────┘  └──┬───┬───┬───┘
                                │   │   │
                    ┌───────────┘   │   └───────────┐
                    │               │               │
              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
              │ postgres  │  │   redis   │  │ falkordb  │
              │  :5432    │  │  :6379    │  │  :6379    │
              └───────────┘  └───────────┘  └─────┬─────┘
                                                   │
                                            ┌──────▼──────┐
                                            │  graphiti   │
                                            │   :8001     │
                                            └─────────────┘

              ┌───────────┐  ┌──────────────┐  ┌──────────────┐
              │    n8n    │  │ celery_worker│  │ celery_beat  │
              │  :5678    │  │  (no port)   │  │  (no port)   │
              └───────────┘  └──────────────┘  └──────────────┘
```

---

## Startup-Reihenfolge (Abhaengigkeiten)

```
1. postgres, redis, falkordb     (keine Abhaengigkeiten)
2. graphiti                       (wartet auf falkordb)
3. api                            (wartet auf postgres, redis, falkordb)
4. web                            (wartet auf api)
5. celery_worker, celery_beat    (wartet auf api, redis, postgres)
6. n8n                            (keine harten Abhaengigkeiten)
7. nginx                          (wartet auf web, api)
```

---

## Entwicklungs-Befehle

```bash
# Alle Services starten
docker compose up -d

# Logs verfolgen (alle Services)
docker compose logs -f

# Logs eines einzelnen Services
docker compose logs -f api

# Nur Backend-Services starten (ohne Frontend)
docker compose up -d postgres redis falkordb graphiti api

# Datenbank-Migration ausfuehren
docker compose exec api alembic upgrade head

# FastAPI Shell / Python REPL
docker compose exec api python

# PostgreSQL CLI
docker compose exec postgres psql -U paix -d paix

# Redis CLI
docker compose exec redis redis-cli

# FalkorDB CLI
docker compose exec falkordb redis-cli

# Alle Services stoppen
docker compose down

# Alle Services + Volumes loeschen (ACHTUNG: Datenverlust!)
docker compose down -v
```
