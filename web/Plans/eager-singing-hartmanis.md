# MCP Integration — Vollständige Tool-Anbindung

## Context

PAI-X hat bereits eine **MCP-Server-Registry** (DB-Modell, CRUD API unter `/werkzeuge`, Frontend in Settings-Tab). Aber es fehlt die **Runtime**: Kein MCP SDK installiert, keine echte Verbindung zu Servern, keine Tool-Discovery, kein Dispatch im Chat. Die Tools-Liste wird manuell eingetragen statt automatisch vom Server abgefragt.

**Ziel:** MCP Server registrieren → Tools werden automatisch entdeckt → Chat nutzt sie sofort. Super easy für Laien.

**Olivers Anforderung:** "Super easy zu integrieren, auch für technische Laien." Das bedeutet:
- Kein manuelles Tool-Eintragen — automatische Discovery
- Einfaches Formular: Name + URL/Command eingeben, fertig
- Verbindungstest mit klarem Feedback (grün/rot)
- Tools erscheinen automatisch im Chat

---

## Plan

### Phase 1: Backend — MCP Client Service

**Datei: `api/services/mcp_client.py`** (NEU)

Zentraler MCP-Client-Manager mit:
- `connect(server: McpServer)` → Verbindung aufbauen (stdio/SSE/streamable_http)
- `disconnect(server_id)` → Verbindung sauber trennen
- `discover_tools(server: McpServer)` → `tools/list` aufrufen, Tool-Schemas zurückgeben
- `call_tool(server: McpServer, tool_name, arguments)` → Tool aufrufen, Ergebnis zurückgeben
- Connection-Pool: `dict[uuid, ClientSession]` für aktive Verbindungen
- Lazy-Connect: Verbindung wird erst beim ersten Tool-Call aufgebaut, nicht dauerhaft
- Graceful Cleanup: `AsyncExitStack` pro Verbindung, Cleanup bei Server-Deaktivierung

Pattern nach offiziellem MCP SDK:
```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamable_http_client

class McpClientManager:
    _sessions: dict[str, tuple[ClientSession, AsyncExitStack]]

    async def _connect(self, server: McpServer) -> ClientSession
    async def discover_tools(self, server: McpServer) -> list[dict]
    async def call_tool(self, server_id, tool_name, arguments) -> str
    async def disconnect(self, server_id)
    async def disconnect_all()
```

### Phase 2: Backend — Werkzeuge Router erweitern

**Datei: `api/routers/werkzeuge.py`** (EDIT)

Neue Endpoints:
- `POST /werkzeuge/{id}/discover` — Verbindet zum MCP Server, ruft `tools/list` auf, speichert Tool-Schemas (nicht nur Namen) in DB
- `POST /werkzeuge/{id}/test` — Schneller Verbindungstest (connect + initialize + disconnect), gibt Status zurück

Änderung am `tools` Feld: Statt `list[str]` (nur Namen) speichern wir `list[dict]` mit `{name, description, input_schema}` — die vollen Anthropic-kompatiblen Tool-Definitionen.

Änderung an `POST /werkzeuge` (Create): Nach dem Erstellen automatisch `discover_tools()` aufrufen.

### Phase 3: Backend — Chat Engine Integration

**Datei: `api/services/chat_engine.py`** (EDIT)

`_load_tools()` erweitern:
```python
async def _load_tools(self, db, user_id):
    tools = await skill_service.get_tools_for_user(db, user_id)
    tools.append(ARTIFACT_TOOL)
    if app_settings.docker_sandbox_enabled:
        tools.append(RUN_CODE_TOOL)
    # NEU: MCP Server Tools hinzufügen
    mcp_tools = await self._load_mcp_tools(db, user_id)
    tools.extend(mcp_tools)
    return tools
```

Neue Methode `_load_mcp_tools()`:
- Alle aktiven MCP Server des Users laden
- Deren gespeicherte Tool-Schemas als Anthropic-Format zurückgeben
- Tool-Name: `mcp__{server_name}__{tool_name}` (bestehendes Pattern)

### Phase 4: Backend — Tool Dispatch

**Datei: `api/services/skill_service.py`** (EDIT)

`execute_tool_call()` erweitern — neuer Branch vor dem Skill-Fallback:
```python
async def execute_tool_call(self, db, user_id, tool_name, tool_input):
    if tool_name == "web_search":
        ...  # bestehend

    # NEU: MCP Tool Dispatch
    if tool_name.startswith("mcp__"):
        return await self._execute_mcp_tool(db, user_id, tool_name, tool_input)

    # Bestehender Skill-Fallback
    result = await self.execute(...)
```

`_execute_mcp_tool()`:
- Parse Server-Name und Tool-Name aus `mcp__{server}__{tool}`
- Server aus DB laden (user_id + name)
- `mcp_client_manager.call_tool()` aufrufen
- Ergebnis als String zurückgeben

### Phase 5: Frontend — Werkzeuge UI verbessern

**Datei: `web/app/(dashboard)/settings/page.tsx`** (EDIT)

Verbesserungen an `WerkzeugeSection` und `WerkzeugForm`:
1. **Automatische Tool-Discovery**: Nach dem Erstellen/Speichern eines Servers automatisch `/werkzeuge/{id}/discover` aufrufen
2. **Verbindungstest-Button**: "Verbindung testen" Button der `/werkzeuge/{id}/test` aufruft mit grün/rot Feedback
3. **Tool-Liste dynamisch**: Keine manuelle Tool-Eingabe mehr — Tools werden nach Discovery automatisch angezeigt (read-only Badge-Liste)
4. **Vereinfachtes Formular**:
   - Name (Pflichtfeld)
   - Typ: "Lokal (stdio)" / "Remote (URL)" — statt technischer Transport-Begriffe
   - Bei Lokal: Command + Arguments
   - Bei Remote: URL
5. **Status-Anzeige**: Verbunden/Getrennt Badge pro Server, Anzahl verfügbarer Tools

### Phase 6: Dependencies

**Datei: `api/requirements.txt`** (EDIT)
```
mcp>=1.0
```

---

## Kritische Dateien

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `api/requirements.txt` | EDIT | `mcp>=1.0` hinzufügen |
| `api/services/mcp_client.py` | NEU | MCP Client Manager Service |
| `api/routers/werkzeuge.py` | EDIT | Discover + Test Endpoints |
| `api/services/chat_engine.py` | EDIT | MCP Tools in `_load_tools()` |
| `api/services/skill_service.py` | EDIT | `mcp__` Dispatch in `execute_tool_call()` |
| `web/app/(dashboard)/settings/page.tsx` | EDIT | Vereinfachte Werkzeuge-UI |
| `web/lib/settings-service.ts` | EDIT | Discover + Test API Methoden |

## Bestehende Patterns die wiederverwendet werden

- `mcp__{server}__{tool}` Naming-Convention (werkzeuge.py:195)
- `_server_to_dict()` Serialisierung (werkzeuge.py:53)
- `execute_tool_call()` Dispatch-Pattern (skill_service.py:421)
- `_load_tools()` Tool-Aggregation (chat_engine.py:225)
- `WerkzeugeSection` + `WerkzeugForm` + `WerkzeugCard` (settings/page.tsx)
- `settingsService` API-Client-Methoden (settings-service.ts)
- WebSocket `tool_use_start/input/result` Events (chat-store.ts) — funktioniert bereits für MCP Tools ohne Änderung

## Verification

1. `pip install -r requirements.txt` — MCP SDK installiert
2. `python -c "from mcp import ClientSession; print('OK')"` — Import funktioniert
3. Backend starten, MCP Server registrieren via API/UI
4. `/werkzeuge/{id}/test` aufrufen — Verbindungstest grün
5. `/werkzeuge/{id}/discover` aufrufen — Tools werden gespeichert
6. Chat öffnen, Nachricht senden die ein MCP-Tool triggert — Tool wird ausgeführt
7. `npx tsc --noEmit` — Frontend kompiliert
8. Bestehende Tools (web_search, create_artifact, Skills) funktionieren weiterhin
