# PAI-X Developer Setup Guide

Step-by-step guide for setting up the PAI-X development environment locally.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Frontend runtime |
| Python | 3.13+ | Backend runtime |
| Docker + Docker Compose | Latest | Database and infrastructure services |
| PostgreSQL | 15+ | Primary database (or use Docker) |
| Redis | 7+ | Cache, Celery broker (or use Docker) |
| Git | 2.x | Version control |

---

## 1. Clone the Repository

```bash
git clone <repository-url>
cd paix
```

---

## 2. Start Infrastructure Services

The easiest way to get PostgreSQL, Redis, FalkorDB, Graphiti, and n8n running:

```bash
cd infra
docker compose up -d postgres redis falkordb graphiti
```

This starts:
- **PostgreSQL** on port `5432` (user: `paix`, password: `paix`, database: `paix`)
- **Redis** on port `6379`
- **FalkorDB** on port `6380`
- **Graphiti** on port `8001`

Alternatively, install PostgreSQL and Redis natively and adjust connection strings.

---

## 3. Backend Setup (FastAPI)

### 3.1 Create Virtual Environment

```bash
cd api
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows
```

### 3.2 Install Dependencies

```bash
pip install -r requirements.txt
```

For Graphiti server (if running locally without Docker):
```bash
pip install -r requirements-graphiti.txt
```

### 3.3 Environment Variables

Create `api/.env` from the configuration defaults. All settings have sensible defaults for development, but you should set at minimum:

```env
# Database
DATABASE_URL=postgresql+asyncpg://paix:paix@localhost:5432/paix

# Redis
REDIS_URL=redis://localhost:6379/0

# Auth (CHANGE for production!)
JWT_SECRET=your-secure-random-secret-here

# AI (at least one is required for chat to work)
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...

# Optional
ENVIRONMENT=development
DEBUG=true
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
FALKORDB_HOST=localhost
FALKORDB_PORT=6380
GRAPHITI_URL=http://localhost:8001
INTERNAL_API_KEY=your-internal-key
TELEGRAM_BOT_TOKEN=your-bot-token
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3.4 Run Database Migrations

```bash
alembic upgrade head
```

### 3.5 Start the API Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Swagger UI is at `http://localhost:8000/api/v1/docs`.

### 3.6 Start Celery Workers (Optional)

For background tasks and scheduled jobs:

```bash
# Worker (processes tasks)
celery -A celery_app worker --loglevel=info

# Beat (schedules periodic tasks)
celery -A celery_app beat --loglevel=info
```

---

## 4. Frontend Setup (Next.js)

### 4.1 Install Dependencies

```bash
cd web
npm install
```

### 4.2 Environment Variables

The frontend uses a single environment variable. The default works for local development:

```env
# web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/chat/stream
```

### 4.3 Start the Dev Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`.

### 4.4 Other Commands

```bash
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check
```

---

## 5. Full Docker Development

To run the entire stack in Docker (including frontend and backend):

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This starts all services with hot-reload enabled for both frontend and backend:
- **Web:** `http://localhost:3000` (with volume mounts for hot reload)
- **API:** `http://localhost:8000` (with `--reload` flag)
- **PostgreSQL:** `localhost:5432`
- **Redis:** `localhost:6379`
- **FalkorDB:** `localhost:6380`
- **Graphiti:** `localhost:8001`
- **n8n:** `http://localhost:5678`

---

## 6. Running Tests

```bash
# From project root
cd tests
# Follow test-specific setup instructions in the tests directory
```

---

## 7. Common Issues

### Port Conflicts

If ports 3000, 5432, 6379, 6380, 8000, or 8001 are already in use, either stop the conflicting services or adjust the port mappings in `infra/docker-compose.dev.yml`.

### Database Connection Errors

Ensure PostgreSQL is running and accessible:
```bash
psql -h localhost -U paix -d paix
```

If using Docker, check the container is healthy:
```bash
docker compose -f infra/docker-compose.yml ps
```

### Missing API Key

Chat will return a fallback error message if no `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is configured. Set at least one in `api/.env`.

### Alembic Migration Errors

If the database schema is out of sync:
```bash
cd api
alembic downgrade base
alembic upgrade head
```

Warning: This drops all data. For development only.

---

## 8. Architecture Overview

For a detailed architecture diagram and data flow description, see [README.md](./README.md).

For the complete API endpoint reference, see [API.md](./API.md).

For security considerations, see [SECURITY-AUDIT.md](../SECURITY-AUDIT.md).
