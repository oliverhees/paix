# PAI-X Infrastructure

Docker, Nginx und Deployment-Konfiguration.

## Tech-Stack
- Docker + Docker Compose
- Nginx (Reverse Proxy)
- Hetzner Cloud (DSGVO, Deutschland)
- GitHub Actions (CI/CD)

## Struktur (geplant)
```
infra/
├── docker-compose.yml          # Lokale Entwicklung
├── docker-compose.prod.yml     # Production
├── nginx/
│   ├── nginx.conf              # Nginx Hauptkonfig
│   └── conf.d/
│       └── paix.conf           # PAI-X Site Config
├── dockerfiles/
│   ├── Dockerfile.web          # Next.js Frontend
│   ├── Dockerfile.api          # FastAPI Backend
│   └── Dockerfile.whisper      # faster-whisper (Phase 2)
└── scripts/
    ├── setup.sh                # Ersteinrichtung
    └── deploy.sh               # Deployment-Script
```

## Hetzner Server-Architektur (Production)
- Server 1 (CX21): Next.js + FastAPI + Redis + Nginx
- Server 2 (CX31): FalkorDB + PostgreSQL + faster-whisper + LiveKit
- Server 3 (CX11): n8n + NocoDB + Celery Worker

## Hinweis
Alle Daten bleiben auf Hetzner-Servern in Deutschland (EU). DSGVO by Design.
