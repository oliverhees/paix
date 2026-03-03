# PAI-X Project Retrospective

## Date
2026-02-27

## Project Summary
Personal AI Assistant — Full-stack web application with AI chat, TELOS life dimensions (10 identity dimensions), settings management, and theme customization. Built on a 5-layer architecture (Identity, Intelligence, Memory, Action, Interface) with FastAPI + PostgreSQL + Redis backend and Next.js 15 frontend, designed for a single power-user with future multi-user capability.

## What Went Well
- **Architecture-first approach**: The 5-layer architecture (TELOS Identity, Intelligence, Memory, Action, Interface) was fully designed before implementation began, resulting in clear separation of concerns and a coherent system design across 6 ADRs.
- **Rapid full-stack delivery**: From PRD to deployable Docker containers across 8 teams in a single sprint — covering architecture, database (14 tables + Graphiti schema), frontend (6 routes), backend (40+ endpoints), testing, security audit, documentation, and deployment.
- **Comprehensive test coverage**: 8/8 Playwright E2E tests and 5/5 API integration tests all passing on first CI run, validating the auth flow, navigation, and core API endpoints.
- **Zero critical security findings**: The security audit found 0 critical and 0 high severity issues across the entire stack, indicating sound security fundamentals (JWT auth, password hashing, CORS configuration).
- **Clean TypeScript codebase**: Zero TypeScript errors in the frontend, demonstrating disciplined type usage with strict mode enabled.
- **Theme system with 8 presets**: A polished UX feature (8 theme presets) delivered alongside core functionality, showing that design quality was not sacrificed for speed.
- **Docker-ready from day one**: Multi-stage Dockerfiles, docker-compose with health checks, and GitHub Actions CI pipeline were delivered as part of the initial build, not as afterthoughts.

## What Could Be Improved
- **Missing rate limiting on auth endpoints**: The security audit flagged this as a medium-severity finding — login and registration endpoints lack brute-force protection. This should have been part of the initial auth implementation.
- **Unused dependency (passlib)**: `passlib` is in requirements.txt but not used anywhere. Dependency hygiene should be part of the development workflow, not caught in security audits.
- **CardTitle accessibility gap (BUG-20260227-001)**: A low-severity accessibility issue was found in the CardTitle component — semantic heading levels are not properly set. Accessibility should be validated during component development.
- **No API key rotation mechanism**: The system relies on static API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY) with no rotation or vault integration. For production, a secrets manager (e.g., Hetzner Secret Manager) should be integrated early.
- **python-jose vs PyJWT**: The security audit recommended PyJWT over python-jose for JWT handling. Library selection should be evaluated against maintenance status and CVE history before initial implementation.
- **Chat v2 is a 1:1 template copy**: The chat interface was copied directly from the shadcn template rather than adapted to PAI-X's specific needs (streaming responses, context panel, TELOS injection display). This creates technical debt for Phase 2.
- **Celery worker not yet operational**: The architecture specifies Celery for background tasks (memory updates, proactive triggers), but the worker is not included in the docker-compose setup. Background processing is deferred to a future phase.

## Key Decisions
| Decision | Rationale |
|----------|-----------|
| **FastAPI + PostgreSQL over PocketBase** (ADR-001) | PAI-X requires a Temporal Knowledge Graph (Graphiti/FalkorDB), LangGraph agent orchestration, and Celery background jobs — none of which PocketBase supports. |
| **Graphiti + FalkorDB over vector database** (ADR-002) | Temporal knowledge graph enables relation-aware, time-conscious memory (Person-Meeting-Project links) instead of flat semantic search. |
| **n8n for automation** (ADR-003) | 400+ pre-built integrations, visual workflow builder, self-hostable, GDPR-compliant. Reduces custom cron code significantly. |
| **shadcn/ui template as exclusive UI basis** (ADR-004) | Consistency over completeness — all PAI-X components extend the template rather than mixing UI frameworks. |
| **Socket.io over native WebSockets** (ADR-005) | Auto-reconnection, fallback mechanisms, room-based communication for future multi-user support. |
| **Monorepo structure** (ADR-006) | Single repository for frontend, backend, agents, and infra — shared types, single CI/CD pipeline, optimal for solo/small team. |
| **JWT auth with bcrypt** | Stateless authentication with Redis session store for revocation capability. |
| **Hetzner 3-server production architecture** | App server (CX21), AI/Data server (CX31), Automation server (CX11) — estimated 80-120 EUR/month, all EU-hosted for GDPR compliance. |

## Lessons Learned
1. **Security audit should run in parallel with implementation, not after**: The two medium findings (rate limiting, python-jose) could have been caught and fixed during development if security review was integrated into the implementation phase rather than run as a separate sequential team.
2. **Dependency auditing belongs in CI from the start**: Adding a `pip-audit` or equivalent check to GitHub Actions would have flagged the unused `passlib` dependency and the python-jose maintenance concerns automatically.
3. **Accessibility testing should be part of component creation**: The CardTitle heading-level issue is a pattern that repeats across UI libraries. A simple axe-core check in the component development workflow prevents these from accumulating.
4. **Template copies need immediate adaptation tickets**: Copying the chat template 1:1 was the right speed decision, but the adaptation work (streaming UI, context panel, TELOS display) should have been captured as explicit follow-up tasks in Linear immediately.
5. **Background worker infrastructure should be in docker-compose from day one**: Even if Celery tasks are not yet implemented, having the worker container in the compose file ensures the infrastructure is validated early and developers can add tasks incrementally.
6. **The 8-team sequential workflow works but has idle time**: Teams waiting on previous team outputs (e.g., Testing waiting on Implementation) could be partially parallelized — e.g., test scaffolding can begin while implementation is in progress.
7. **ADR documentation pays dividends across teams**: Having 6 clear ADRs before implementation meant every team (frontend, backend, deployment, security) worked from the same assumptions without conflicting technical decisions.

## Open Items
- API Keys needed (ANTHROPIC_API_KEY, OPENAI_API_KEY)
- Celery worker for background tasks
- Rate limiting on auth endpoints (security finding)
- CardTitle accessibility fix (Bug BUG-20260227-001)
- Remove unused passlib from requirements.txt
- Consider PyJWT over python-jose
- FalkorDB + Graphiti integration (Memory Layer not yet connected)
- n8n automation workflows (Action Layer not yet connected)
- Chat interface adaptation from template copy to PAI-X specific UI
- TELOS dashboard view (read-only, MVP)
- PWA configuration (next-pwa + Workbox)
- OAuth providers (Google, GitHub) setup
- Production deployment to Hetzner (3-server architecture)

## Metrics
- Frontend routes: 6
- Backend endpoints: 40+
- E2E tests: 8 (all passing)
- API tests: 5 (all passing)
- TypeScript errors: 0
- Security findings: 0 critical, 2 medium, 4 low, 4 info
- Docker services: 4 (postgres, redis, api, web)
- Database tables: 14 (PostgreSQL) + 8 Graphiti node types
- Architecture layers: 5
- ADRs documented: 6
- Theme presets: 8
- TELOS dimensions: 10
