# MCP Server Setup – HR Code Labs Agency v4

Alle MCPs werden von Agent Teams genutzt. CEO koordiniert welches Team welche MCPs braucht.

## 1. Linear (Projektmanagement – CEO Cockpit)
```bash
claude mcp add linear -- npx -y @anthropic/linear-mcp-server
# Env: LINEAR_API_KEY=lin_api_xxxxx
```

## 2. GitHub (Repository)
```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
# Env: GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxx
```

## 3. Playwright (E2E Testing – test-engineer)
```bash
claude mcp add playwright -- npx -y @anthropic/playwright-mcp-server
```

## 4. shadcn/ui (UI Komponenten – shadcn-specialist)
```bash
claude mcp add shadcn -- npx -y shadcn-mcp-server
```

## 5. Coolify (Deployment – devops-engineer)
```bash
claude mcp add coolify -- npx -y coolify-mcp-server
# Env: COOLIFY_API_TOKEN=xxxxx
# Env: COOLIFY_BASE_URL=https://coolify.deinedomain.de
```

## 6. Next.js DevTools (Debugging – frontend-dev)
```bash
claude mcp add nextjs-devtools -- npx -y @next/devtools-mcp-server
```

## 7. Graphiti (Persistent Knowledge Graph – KRITISCH)
```bash
# Graphiti läuft als MCP Server:
claude mcp add graphiti -- npx -y @getzep/graphiti-mcp-server
# Env: GRAPHITI_API_KEY=xxxxx (oder lokal via Docker)
```

> Graphiti ist das persistente Langzeitgedächtnis für CEO und alle Team Leads.
> Nutze add_memory, search_nodes, search_facts für projektübergreifenden Kontext.
> group_id pro Projekt: agent-one | synkea | hr-code-labs | main

## Status prüfen
```bash
claude mcp list   # alle MCPs inklusive Graphiti
```
