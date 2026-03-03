# Decision Log: PAI-X Infrastructure Setup

**Datum:** 2026-02-26
**Team:** Team 2 (Infrastructure Setup)

## Entscheidungen

### D-001: Next.js 15 statt Next.js 16
- **Kontext:** Die PRD spezifiziert Next.js 16, aber Next.js 16 ist noch nicht released (Stand Feb 2026)
- **Entscheidung:** Next.js 15 (latest stable) mit `"next": "^15.0.0"` in package.json
- **Begründung:** Next.js 15 ist die aktuelle stabile Version. 16 existiert noch nicht.
- **Migration:** Upgrade auf Next.js 16 kann via simple `npm update` erfolgen, sobald verfuegbar.

### D-002: Tailwind CSS v4 statt v3
- **Kontext:** ARCHITECTURE.md referenziert Tailwind v3, Mission Brief sagt v4
- **Entscheidung:** Tailwind CSS v4 mit `@tailwindcss/postcss` Plugin
- **Begründung:** v4 ist aktueller, nutzt CSS-native Features, performanter
- **Auswirkung:** Kein `tailwind.config.ts` noetig (v4 nutzt CSS-basierte Konfiguration)

### D-003: Docker Compose ohne version key
- **Kontext:** DOCKER-SPEC.md hat `version: "3.9"`
- **Entscheidung:** `version` key weggelassen
- **Begründung:** Docker Compose v2 (aktuell) ignoriert den version key, er ist deprecated

### D-004: wget statt curl fuer web/nginx healthchecks
- **Kontext:** Docker Healthchecks brauchen HTTP-Client
- **Entscheidung:** `wget --spider` fuer alpine-basierte Container (web, nginx)
- **Begründung:** curl ist nicht in alpine-Images enthalten, wget ist leichter

### D-005: Standalone Output fuer Next.js
- **Kontext:** Production Docker Build
- **Entscheidung:** `output: "standalone"` in next.config.ts
- **Begründung:** Erzeugt minimales Deployment-Bundle fuer Docker ohne node_modules
