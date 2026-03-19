# Graphiti Knowledge Graph — Design Spec

**Date:** 2026-03-18
**Phase:** Phase 2: TELOS + Graphiti
**Status:** Approved

## Overview

Graphiti runs as a separate Python container with a FastAPI REST API. PAIONE communicates via HTTP. FalkorDB serves as the graph database. Semantic retrieval within a 3,000-token budget. Knowledge extraction happens synchronously after each response using Haiku (fast model) to minimize costs.

## Architecture

```
User Message
    ↓
Context Assembly: Graphiti Search (GET /search)
    → Top-N relevant facts/episodes by semantic similarity
    → Truncated to 3,000 tokens
    ↓
LLM Response
    ↓
Knowledge Extraction: Graphiti Add (POST /episodes)
    → Synchronous after every response
    → Uses Haiku (modelFast) for extraction
    → Stores facts, entities, relations in FalkorDB
```

## Container Setup

```yaml
# docker-compose.yml additions
graphiti:
  build:
    context: .
    dockerfile: SYSTEM/container/graphiti/Dockerfile
  environment:
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - MODEL_NAME=claude-haiku-4-5-20251001
    - GRAPH_DB_PROVIDER=falkordb
    - FALKORDB_URL=redis://falkordb:6379
  depends_on:
    falkordb:
      condition: service_started
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 30s
    timeout: 5s
    retries: 3
  networks:
    - paione-net

falkordb:
  # Already exists in docker-compose.yml
```

## Modules

### `SYSTEM/src/memory/graphiti-client.ts`

HTTP client wrapping Graphiti's REST API.

```typescript
interface GraphitiSearchResult {
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

interface GraphitiClient {
  search(query: string, limit?: number): Promise<GraphitiSearchResult[]>;
  addEpisode(content: string, metadata?: Record<string, unknown>): Promise<void>;
  health(): Promise<boolean>;
}

function createGraphitiClient(baseUrl: string): GraphitiClient
```

### `SYSTEM/src/memory/graphiti-retriever.ts`

Retrieves relevant knowledge from Graphiti and enforces the 3,000-token budget.

```typescript
interface GraphitiRetrievalResult {
  content: string;
  tokens: number;
  resultCount: number;
}

function retrieveFromGraphiti(
  message: string,
  client: GraphitiClient,
  budget?: number,
): Promise<GraphitiRetrievalResult>
```

- Calls `client.search(message)`
- Sorts results by relevance score
- Truncates each result to ~300 tokens
- Fills budget until 3,000 tokens reached
- Returns formatted content with `[KNOWLEDGE]` headers

### `SYSTEM/src/memory/graphiti-extractor.ts`

Extracts knowledge from conversations and stores it in Graphiti.

```typescript
function createExtractionHook(client: GraphitiClient): Hook
```

- Registered as POST_RESPONSE hook with priority 200
- Formats conversation turn as episode: `User: {message}\nAssistant: {response}`
- Calls `client.addEpisode(episode, metadata)`
- Errors are caught and logged (non-fatal)

### Context Assembler Integration

```typescript
// In assembler.ts — after TELOS, before final assembly:
if (graphitiClient) {
  const graphiti = await retrieveFromGraphiti(message, graphitiClient);
  if (graphiti.content) {
    sections.push(graphiti.content);
    tokenCounts.graphiti = graphiti.tokens;
  }
}
```

### `SYSTEM/container/graphiti/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install graphiti-core[falkordb] uvicorn fastapi
# Copy Graphiti server configuration
COPY SYSTEM/container/graphiti/server.py .
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Token Budget

- **GRAPHITI_BUDGET:** 3,000 tokens (from constants.ts)
- **Per-result cap:** ~300 tokens
- **Typical retrieval:** 5-10 results per query
- **Search method:** Semantic similarity via Graphiti's built-in search

## Graceful Degradation

Graphiti is optional. When the container is not running:

1. `graphitiClient.health()` returns `false`
2. Retriever returns empty result (0 tokens, 0 results)
3. Extractor skips with a debug-level log
4. PAIONE works normally — just without long-term memory
5. No error messages shown to user

This means PAIONE can run without Docker (development mode) and still function fully — Graphiti only activates when the container is available.

## Config Integration

```typescript
// In PaioneConfig:
graphitiUrl?: string;  // Default: http://graphiti:8000 (docker) or undefined (disabled)
```

If `graphitiUrl` is not set or the health check fails, Graphiti features are silently disabled.

## Extraction Details

- **When:** Synchronously after every LLM response, before the next message is accepted
- **What:** Full conversation turn (user message + assistant response)
- **LLM:** Haiku (modelFast from config) — cheap, fast, sufficient for entity extraction
- **Metadata:** groupId, sessionId, timestamp
- **Errors:** Caught and logged, never block the message pipeline

## GitHub Issues

1. `feat(memory): implement Graphiti HTTP client`
2. `feat(memory): implement Graphiti retriever with budget enforcement`
3. `feat(memory): implement Graphiti extraction hook`
4. `feat(memory): integrate Graphiti into context assembler`
5. `infrastructure: add Graphiti container to docker-compose`
6. `docs: add Graphiti documentation to Nextra (EN + DE)`

## Out of Scope

- No custom Graph query layer (Graphiti handles this)
- No UI for graph visualization (Phase 5+)
- No manual fact editing (Phase 4 via MCP)
- No graph pruning/cleanup (Graphiti handles temporal decay)
