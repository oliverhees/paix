"""Skill Execution Service — runs skills via the Claude LLM service."""

import logging
import time
import uuid

logger = logging.getLogger(__name__)
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.skill import SkillConfig, SkillExecution
from services.llm_service import llm_service, get_user_anthropic_key
from services.skill_parser import parse_skill_md, build_skill_md


# ──────────────────────────────────────────────
# Legacy Skill Definitions (fallback when skill_md is NULL)
# ──────────────────────────────────────────────

SKILL_DEFINITIONS: dict[str, dict] = {
    "calendar_briefing": {
        "name": "Kalender-Briefing",
        "description": "Proaktives Terminmanagement und taegliches Briefing",
        "system_prompt": (
            "Du bist ein persoenlicher Assistent. Erstelle ein kurzes Briefing "
            "fuer den heutigen Tag basierend auf dem Kalender des Users. "
            "Fasse Termine zusammen, weise auf Konflikte hin, und gib "
            "Empfehlungen fuer die Tagesplanung."
        ),
        "parameters": {
            "date": {
                "type": "string",
                "required": False,
                "description": "Datum fuer das Briefing (YYYY-MM-DD), Standard: heute",
            }
        },
    },
    "content_pipeline": {
        "name": "Content Pipeline",
        "description": "LinkedIn und Blog Content erstellen und planen",
        "system_prompt": (
            "Du bist ein Content-Stratege. Hilf dem User beim Erstellen von Content. "
            "Analysiere das Thema, schlage Formate vor (Blog, Social Media, Newsletter), "
            "erstelle Entwuerfe und optimiere fuer die Zielgruppe."
        ),
        "parameters": {
            "topic": {
                "type": "string",
                "required": True,
                "description": "Das Thema fuer den Content",
            },
            "format": {
                "type": "string",
                "required": False,
                "description": "Gewuenschtes Format (blog, social_media, newsletter)",
            },
            "audience": {
                "type": "string",
                "required": False,
                "description": "Zielgruppe fuer den Content",
            },
        },
    },
    "meeting_prep": {
        "name": "Meeting-Vorbereitung",
        "description": "Automatische Meeting-Vorbereitung mit Kontext",
        "system_prompt": (
            "Du bist ein Meeting-Vorbereiter. Erstelle eine strukturierte "
            "Vorbereitung fuer das Meeting. Fasse relevante Hintergrundinformationen "
            "zusammen, erstelle eine Agenda-Empfehlung, und liste wichtige "
            "Gespraechspunkte auf."
        ),
        "parameters": {
            "meeting_topic": {
                "type": "string",
                "required": True,
                "description": "Thema oder Titel des Meetings",
            },
            "participants": {
                "type": "string",
                "required": False,
                "description": "Teilnehmer des Meetings (kommagetrennt)",
            },
            "duration": {
                "type": "string",
                "required": False,
                "description": "Geplante Dauer des Meetings (z.B. 30min, 1h)",
            },
        },
    },
    "follow_up": {
        "name": "Follow-Up Manager",
        "description": "Offene Aufgaben und Follow-Ups verfolgen",
        "system_prompt": (
            "Du bist ein Follow-Up Manager. Analysiere die beschriebene Situation "
            "und erstelle professionelle Follow-Up Nachrichten. Beruecksichtige "
            "Timing, Ton und Kontext."
        ),
        "parameters": {
            "context": {
                "type": "string",
                "required": True,
                "description": "Kontext der Situation fuer das Follow-Up",
            },
            "recipient": {
                "type": "string",
                "required": False,
                "description": "Empfaenger des Follow-Ups",
            },
            "urgency": {
                "type": "string",
                "required": False,
                "description": "Dringlichkeit (low, medium, high)",
            },
        },
    },
    "idea_capture": {
        "name": "Ideen-Erfassung",
        "description": "Ideen erfassen, kategorisieren und vernetzen",
        "system_prompt": (
            "Du bist ein Ideen-Analyst. Nimm die rohe Idee des Users auf, "
            "strukturiere sie, identifiziere Staerken und Schwaechen, schlage "
            "naechste Schritte vor und bewerte das Potenzial."
        ),
        "parameters": {
            "idea": {
                "type": "string",
                "required": True,
                "description": "Die Idee die erfasst und analysiert werden soll",
            },
            "domain": {
                "type": "string",
                "required": False,
                "description": "Bereich/Domaene der Idee (z.B. Tech, Business, Kreativ)",
            },
        },
    },
}


# ──────────────────────────────────────────────
# Built-in Tool Definitions (always available, not user-created)
# ──────────────────────────────────────────────

WEB_SEARCH_TOOL = {
    "name": "web_search",
    "description": (
        "Search the internet for current information, news, and real-time data. "
        "Use this when you need up-to-date information that may not be in your training data, "
        "such as current news, prices, events, or recent developments."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query. Be specific and use natural language.",
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum number of results to return (1-10, default 5)",
                "default": 5,
            },
        },
        "required": ["query"],
    },
}


# ──────────────────────────────────────────────
# Default Skills as SKILL.md (Anthropic Open Standard)
# ──────────────────────────────────────────────

DEFAULT_SKILL_MDS: dict[str, str] = {
    "calendar_briefing": """\
---
name: calendar-briefing
description: |
  Proaktives Terminmanagement und taegliches Briefing.
  Nutze diesen Skill wenn der User nach seinem Tagesplan fragt,
  Termine wissen will, oder ein Briefing fuer den Tag braucht.
---

# Kalender-Briefing

Du bist ein persoenlicher Assistent fuer Terminmanagement.

## Anweisungen
Erstelle ein kurzes Briefing fuer den heutigen Tag basierend auf dem Kalender des Users.
Fasse Termine zusammen, weise auf Konflikte hin, und gib Empfehlungen fuer die Tagesplanung.

## Parameters
- **date** (string, optional): Datum fuer das Briefing im Format YYYY-MM-DD. Standard: heute.

## Output Format
Strukturiertes Briefing mit:
1. Uebersicht der Termine
2. Zeitkonflikte (falls vorhanden)
3. Empfehlungen fuer die Tagesplanung
""",
    "content_pipeline": """\
---
name: content-pipeline
description: |
  LinkedIn und Blog Content erstellen und planen.
  Nutze diesen Skill wenn der User Content erstellen, planen oder
  optimieren moechte fuer Social Media, Blogs oder Newsletter.
---

# Content Pipeline

Du bist ein Content-Stratege fuer professionelle Kommunikation.

## Anweisungen
Hilf dem User beim Erstellen von Content. Analysiere das Thema,
schlage Formate vor (Blog, Social Media, Newsletter), erstelle
Entwuerfe und optimiere fuer die Zielgruppe.

## Parameters
- **topic** (string, required): Das Thema fuer den Content.
- **format** (string, optional): Gewuenschtes Format (blog, social_media, newsletter).
- **audience** (string, optional): Zielgruppe fuer den Content.

## Output Format
- Content-Entwurf im gewaehlten Format
- Hashtag-Vorschlaege (bei Social Media)
- SEO-Tipps (bei Blog)
""",
    "meeting_prep": """\
---
name: meeting-prep
description: |
  Automatische Meeting-Vorbereitung mit Kontext.
  Nutze diesen Skill wenn der User sich auf ein Meeting vorbereiten
  moechte oder eine Agenda braucht.
---

# Meeting-Vorbereitung

Du bist ein Meeting-Vorbereiter fuer strukturierte Besprechungen.

## Anweisungen
Erstelle eine strukturierte Vorbereitung fuer das Meeting.
Fasse relevante Hintergrundinformationen zusammen, erstelle eine
Agenda-Empfehlung, und liste wichtige Gespraechspunkte auf.

## Parameters
- **meeting_topic** (string, required): Thema oder Titel des Meetings.
- **participants** (string, optional): Teilnehmer des Meetings (kommagetrennt).
- **duration** (string, optional): Geplante Dauer des Meetings (z.B. 30min, 1h).

## Output Format
1. Meeting-Kontext und Ziel
2. Vorgeschlagene Agenda mit Zeitplan
3. Wichtige Gespraechspunkte
4. Vorbereitungs-Checkliste
""",
    "follow_up": """\
---
name: follow-up
description: |
  Offene Aufgaben und Follow-Ups verfolgen.
  Nutze diesen Skill wenn der User eine Follow-Up Nachricht braucht
  oder offene Aufgaben nachverfolgen moechte.
---

# Follow-Up Manager

Du bist ein Follow-Up Manager fuer professionelle Nachverfolgung.

## Anweisungen
Analysiere die beschriebene Situation und erstelle professionelle
Follow-Up Nachrichten. Beruecksichtige Timing, Ton und Kontext.

## Parameters
- **context** (string, required): Kontext der Situation fuer das Follow-Up.
- **recipient** (string, optional): Empfaenger des Follow-Ups.
- **urgency** (string, optional): Dringlichkeit (low, medium, high).

## Output Format
1. Follow-Up Nachricht (fertig zum Versenden)
2. Empfohlener Zeitpunkt
3. Naechste Schritte
""",
    "idea_capture": """\
---
name: idea-capture
description: |
  Ideen erfassen, kategorisieren und vernetzen.
  Nutze diesen Skill wenn der User eine Idee hat die strukturiert
  und bewertet werden soll.
---

# Ideen-Erfassung

Du bist ein Ideen-Analyst fuer strukturierte Ideenbewertung.

## Anweisungen
Nimm die rohe Idee des Users auf, strukturiere sie, identifiziere
Staerken und Schwaechen, schlage naechste Schritte vor und bewerte
das Potenzial.

## Parameters
- **idea** (string, required): Die Idee die erfasst und analysiert werden soll.
- **domain** (string, optional): Bereich/Domaene der Idee (z.B. Tech, Business, Kreativ).

## Output Format
1. Strukturierte Zusammenfassung der Idee
2. Staerken und Schwaechen
3. Potenzial-Bewertung (1-10)
4. Empfohlene naechste Schritte
""",
}


class SkillService:
    """Service for executing skills via the LLM."""

    # ── Definition resolution ────────────────────────────────────────────

    def _resolve_definition(self, config: SkillConfig) -> dict:
        """Resolve skill definition from SKILL.md (preferred) or legacy fallback.

        Returns a dict with: name, description, system_prompt, parameters
        """
        # Priority 1: SKILL.md on the DB row
        if config.skill_md:
            parsed = parse_skill_md(config.skill_md)
            return {
                "name": parsed["name"] or config.name or config.skill_id,
                "description": parsed["description"] or config.description or "",
                "system_prompt": parsed["instructions"],
                "parameters": parsed["parameters"] or config.parameters or {},
            }

        # Priority 2: Existing DB fields (system_prompt, description, etc.)
        if config.system_prompt:
            return {
                "name": config.name or config.skill_id,
                "description": config.description or "",
                "system_prompt": config.system_prompt,
                "parameters": config.parameters or {},
            }

        # Priority 3: Legacy hardcoded SKILL_DEFINITIONS
        legacy = SKILL_DEFINITIONS.get(config.skill_id)
        if legacy:
            return legacy

        return {
            "name": config.name or config.skill_id,
            "description": config.description or "",
            "system_prompt": "",
            "parameters": config.parameters or {},
        }

    def get_skill_definition(self, skill_id: str) -> dict | None:
        """Get the legacy definition for a skill by its ID (backward compat)."""
        return SKILL_DEFINITIONS.get(skill_id)

    def get_all_definitions(self) -> dict[str, dict]:
        """Get all legacy skill definitions."""
        return SKILL_DEFINITIONS

    def get_default_skill_mds(self) -> dict[str, str]:
        """Return the 5 default skills as SKILL.md strings."""
        return dict(DEFAULT_SKILL_MDS)

    # ── Tool building for Anthropic Tool Use ─────────────────────────────

    async def get_tools_for_user(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> list[dict]:
        """
        Load all active SkillConfigs for the user and return them
        in Anthropic Tool Use format.

        Uses SKILL.md (parsed) when available, otherwise falls back
        to legacy SKILL_DEFINITIONS.
        """
        result = await db.execute(
            select(SkillConfig).where(
                SkillConfig.user_id == user_id,
                SkillConfig.active == True,  # noqa: E712
            )
        )
        active_configs = result.scalars().all()

        # Always include built-in tools
        tools: list[dict] = [WEB_SEARCH_TOOL]

        for config in active_configs:
            definition = self._resolve_definition(config)
            if not definition.get("description"):
                continue

            # Build input_schema from parameters
            properties: dict = {}
            required: list[str] = []

            for param_name, param_def in definition.get("parameters", {}).items():
                properties[param_name] = {
                    "type": param_def.get("type", "string"),
                    "description": param_def.get("description", ""),
                }
                if param_def.get("required"):
                    required.append(param_name)

            tool = {
                "name": config.skill_id,
                "description": definition["description"],
                "input_schema": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            }
            tools.append(tool)

        return tools

    async def execute_tool_call(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        tool_name: str,
        tool_input: dict,
    ) -> str:
        """
        Execute a tool call triggered by Anthropic Tool Use.

        Delegates to the existing execute() method and returns
        the result as a string suitable for tool_result content.
        """
        # Handle MCP tools — dispatched to MCP client manager
        if tool_name.startswith("mcp__"):
            return await self._execute_mcp_tool(db, user_id, tool_name, tool_input)

        # Handle API werkzeug tools — dispatched via httpx
        if tool_name.startswith("api__"):
            return await self._execute_api_tool(db, user_id, tool_name, tool_input)

        # Handle storage tools
        if tool_name.startswith("storage_"):
            return await self._execute_storage_tool(db, user_id, tool_name, tool_input)

        # Handle web_fetch tool
        if tool_name == "web_fetch":
            import httpx
            from bs4 import BeautifulSoup

            url = tool_input.get("url", "")
            max_length = tool_input.get("max_length", 10000)

            if not url:
                return "Error: URL is required"

            # Block local/private URLs for security
            from urllib.parse import urlparse
            parsed_url = urlparse(url)
            hostname = parsed_url.hostname or ""
            if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1") or hostname.startswith("192.168.") or hostname.startswith("10.") or hostname.startswith("172."):
                return "Error: Fetching local/private URLs is not allowed"

            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (compatible; PAI-X/1.0; +https://agentiqpulse.com)",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                }
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, max_redirects=5) as client:
                    resp = await client.get(url, headers=headers)
                    resp.raise_for_status()

                # Parse HTML to text
                try:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    # Remove script, style, nav elements
                    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                        tag.decompose()
                    text = soup.get_text(separator="\n", strip=True)
                except Exception:
                    text = resp.text

                # Truncate
                if len(text) > max_length:
                    text = text[:max_length] + f"\n\n[...truncated at {max_length} chars]"

                return text
            except Exception as e:
                return f"Error fetching {url}: {str(e)}"

        # Handle built-in tools that don't go through the LLM skill pipeline
        if tool_name == "web_search":
            import os
            query = tool_input.get("query", "")
            max_results = min(tool_input.get("max_results", 5), 5)  # Cap at 5

            # Priority: User's key > Environment key
            brave_api_key = None
            if db and user_id:
                from models.user import User as UserModel
                user_result = await db.execute(
                    select(UserModel).where(UserModel.id == user_id)
                )
                user_obj = user_result.scalar_one_or_none()
                if user_obj and user_obj.brave_search_api_key:
                    brave_api_key = user_obj.brave_search_api_key

            if not brave_api_key:
                brave_api_key = os.environ.get("BRAVE_SEARCH_API_KEY")

            if brave_api_key:
                # Brave Search API — reliable, no rate limits, designed for AI agents
                import httpx
                url = "https://api.search.brave.com/res/v1/web/search"
                headers = {
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": brave_api_key,
                }
                params = {"q": query, "count": max_results, "search_lang": "de", "freshness": "pd"}  # pd = past day
                try:
                    async with httpx.AsyncClient(timeout=10) as client:
                        resp = await client.get(url, headers=headers, params=params)
                        resp.raise_for_status()
                        data = resp.json()
                        results = []
                        for r in data.get("web", {}).get("results", []):
                            results.append(f"**{r.get('title','?')}**\n{r.get('url','')}\n{r.get('description','')}")
                        if not results:
                            return f"No current results found for: {query}"
                        return f"Search results for '{query}':\n\n" + "\n\n---\n\n".join(results)
                except Exception as e:
                    return f"Search failed: {str(e)}"
            else:
                # DuckDuckGo fallback — no API key needed, but may rate-limit
                try:
                    from duckduckgo_search import DDGS
                    results = []
                    with DDGS() as ddgs:
                        for r in ddgs.text(query, max_results=max_results):
                            results.append(f"**{r['title']}**\n{r['href']}\n{r['body']}")
                    if not results:
                        return (
                            f"No results found for '{query}'. "
                            "Tip: Set BRAVE_SEARCH_API_KEY in .env for reliable web search."
                        )
                    return f"Search results for '{query}':\n\n" + "\n\n---\n\n".join(results)
                except Exception as e:
                    return f"Search unavailable: {str(e)}. Set BRAVE_SEARCH_API_KEY in .env for reliable web search."

        # Build user_input from tool_input for the skill
        parts = []
        for key, value in tool_input.items():
            if value:
                parts.append(f"{key}: {value}")
        user_input = "\n".join(parts) if parts else ""

        result = await self.execute(
            db=db,
            user_id=user_id,
            skill_id=tool_name,
            user_input=user_input,
            parameters=tool_input,
        )

        if result["status"] == "error":
            return f"Skill error: {result.get('error', 'Unknown error')}"

        return result.get("output", "Skill executed but produced no output.")

    def _build_user_message(
        self, definition: dict, user_input: str, parameters: dict | None = None
    ) -> str:
        """Build the user message from input + parameters."""
        parts = []

        # Add parameter context if provided
        if parameters:
            param_defs = definition.get("parameters", {})
            for key, value in parameters.items():
                if value and key in param_defs:
                    label = param_defs[key].get("description", key)
                    parts.append(f"{label}: {value}")

        # Add user input
        if user_input:
            parts.append(f"\n{user_input}")

        return "\n".join(parts) if parts else user_input

    def _validate_parameters(
        self, definition: dict, parameters: dict | None
    ) -> str | None:
        """Validate required parameters. Returns error message or None."""
        param_defs = definition.get("parameters", {})
        if not parameters:
            parameters = {}

        for key, param_def in param_defs.items():
            if param_def.get("required") and not parameters.get(key):
                return f"Required parameter missing: {key} ({param_def.get('description', '')})"

        return None

    def _get_skill_tools(self) -> list[dict]:
        """Tools available during skill execution."""
        return [
            {
                "name": "web_search",
                "description": "Search the internet for current information. Returns search results with titles, URLs, and snippets.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "max_results": {"type": "integer", "description": "Max results (1-5, default 5)"},
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "web_fetch",
                "description": "Fetch and read the text content of a web page URL.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "URL to fetch"},
                        "max_length": {"type": "integer", "description": "Max chars to return (default 10000)"},
                    },
                    "required": ["url"],
                },
            },
            {
                "name": "storage_write",
                "description": "Save a text file to the user's object storage.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path (e.g. 'briefings/report.md')"},
                        "content": {"type": "string", "description": "Text content to save"},
                        "content_type": {"type": "string", "description": "MIME type (default: text/plain)"},
                    },
                    "required": ["path", "content"],
                },
            },
            {
                "name": "create_artifact",
                "description": "Display a document in the side panel. Use for long-form content the user should see.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Document title"},
                        "content": {"type": "string", "description": "Document content"},
                        "type": {"type": "string", "description": "Content type: text/markdown, text/html, etc."},
                    },
                    "required": ["title", "content", "type"],
                },
            },
        ]

    async def execute(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        skill_id: str,
        user_input: str = "",
        parameters: dict | None = None,
    ) -> dict:
        """
        Execute a skill:
        1. Validate skill exists and is active
        2. Resolve definition (SKILL.md -> DB fields -> legacy dict)
        3. Validate required parameters
        4. Build prompt from definition + user input
        5. Call LLM service
        6. Save execution log
        7. Return result
        """
        start_time = time.monotonic()

        # Check skill config exists and is active
        result = await db.execute(
            select(SkillConfig).where(
                SkillConfig.user_id == user_id,
                SkillConfig.skill_id == skill_id,
            )
        )
        config = result.scalar_one_or_none()

        if config is None:
            return {
                "status": "error",
                "error": f"Skill '{skill_id}' not found for this user",
                "output": None,
                "duration_ms": 0,
            }

        if not config.active:
            return {
                "status": "error",
                "error": f"Skill '{skill_id}' is deactivated",
                "output": None,
                "duration_ms": 0,
            }

        # Resolve definition via SKILL.md or fallback
        definition = self._resolve_definition(config)
        if not definition.get("system_prompt") and not definition.get("description"):
            return {
                "status": "error",
                "error": f"No definition found for skill '{skill_id}'",
                "output": None,
                "duration_ms": 0,
            }

        # Validate parameters
        validation_error = self._validate_parameters(definition, parameters)
        if validation_error:
            return {
                "status": "error",
                "error": validation_error,
                "output": None,
                "duration_ms": 0,
            }

        # Build the prompt
        system_prompt = definition.get("system_prompt", "")
        user_message = self._build_user_message(definition, user_input, parameters)

        if not user_message.strip():
            user_message = "Bitte fuehre diesen Skill jetzt aus."

        messages = [{"role": "user", "content": user_message}]

        # Execute via LLM
        output_text = ""
        error_message = None
        status = "success"
        tool_calls: list[dict] = []

        try:
            user_api_key = await get_user_anthropic_key(user_id, db)
            tools = self._get_skill_tools()

            # Create a tool executor bound to this user's context
            async def tool_executor(name: str, input_data: dict) -> str:
                return await self.execute_tool_call(db, user_id, name, input_data)

            result = await llm_service.complete_with_tool_handling(
                messages=messages,
                system_prompt=system_prompt,
                max_tokens=16384,
                temperature=0.7,
                api_key=user_api_key,
                tools=tools,
                tool_executor=tool_executor,
            )
            output_text = result.text
            tool_calls = result.tool_calls or []
        except Exception as exc:
            status = "error"
            error_message = str(exc)
            output_text = ""

        # Calculate duration
        duration_ms = int((time.monotonic() - start_time) * 1000)

        # Save execution log
        execution = SkillExecution(
            user_id=user_id,
            skill_id=skill_id,
            status=status,
            input_summary=user_message[:500] if user_message else None,
            output_summary=output_text[:2000] if output_text else None,
            duration_ms=duration_ms,
            error_message=error_message,
            metadata_json={
                "parameters": parameters or {},
            },
        )
        db.add(execution)
        await db.flush()

        return {
            "status": status,
            "output": output_text,
            "error": error_message,
            "duration_ms": duration_ms,
            "execution_id": str(execution.id),
            "tool_calls": tool_calls,
        }

    async def _execute_mcp_tool(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        tool_name: str,
        tool_input: dict,
    ) -> str:
        """Execute an MCP tool call by routing to the correct MCP server.

        Tool name format: mcp__{server_name}__{tool_name}
        """
        from models.mcp_server import McpServer
        from services.mcp_client import mcp_client_manager

        # Parse server_name and actual tool_name from the mcp__ prefix
        parts = tool_name.split("__", 2)
        if len(parts) != 3:
            return f"Invalid MCP tool name format: {tool_name}"

        _, server_name, actual_tool_name = parts

        # Find the MCP server for this user
        result = await db.execute(
            select(McpServer).where(
                McpServer.user_id == user_id,
                McpServer.name == server_name,
                McpServer.active == True,  # noqa: E712
            )
        )
        server = result.scalar_one_or_none()
        if server is None:
            return f"MCP server '{server_name}' not found or inactive."

        try:
            return await mcp_client_manager.call_tool(
                server_id=str(server.id),
                transport_type=server.transport_type,
                config=server.config or {},
                tool_name=actual_tool_name,
                arguments=tool_input,
            )
        except Exception as e:
            logger.error("MCP tool execution failed: %s — %s", tool_name, e)
            return f"MCP tool error: {str(e)}"

    async def _execute_api_tool(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        tool_name: str,
        tool_input: dict,
    ) -> str:
        """Execute an API werkzeug tool call via httpx.

        Tool name format: api__{werkzeug_name}__{endpoint_name}
        """
        import httpx
        from models.api_werkzeug import ApiWerkzeug

        parts = tool_name.split("__", 2)
        if len(parts) != 3:
            return f"Invalid API tool name format: {tool_name}"

        _, werkzeug_name, endpoint_name = parts

        result = await db.execute(
            select(ApiWerkzeug).where(
                ApiWerkzeug.user_id == user_id,
                ApiWerkzeug.name == werkzeug_name,
                ApiWerkzeug.active == True,  # noqa: E712
            )
        )
        werkzeug = result.scalar_one_or_none()
        if werkzeug is None:
            return f"API werkzeug '{werkzeug_name}' not found or inactive."

        # Find the endpoint definition
        endpoint = None
        for ep in (werkzeug.endpoints or []):
            if isinstance(ep, dict) and ep.get("name") == endpoint_name:
                endpoint = ep
                break

        if endpoint is None:
            return f"Endpoint '{endpoint_name}' not found on API werkzeug '{werkzeug_name}'."

        # Build request
        method = endpoint.get("method", "GET").upper()
        path = endpoint.get("path", "/")
        url = f"{werkzeug.base_url}{path}"

        # Build headers with auth
        req_headers = dict(werkzeug.headers or {})
        auth = werkzeug.auth or {}
        if auth.get("type") == "bearer" and auth.get("token"):
            req_headers["Authorization"] = f"Bearer {auth['token']}"
        elif auth.get("type") == "header" and auth.get("key") and auth.get("value"):
            req_headers[auth["key"]] = auth["value"]

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                if method in ("GET", "HEAD", "DELETE"):
                    resp = await client.request(
                        method, url, headers=req_headers, params=tool_input
                    )
                else:
                    resp = await client.request(
                        method, url, headers=req_headers, json=tool_input
                    )

                # Return response content
                content_type = resp.headers.get("content-type", "")
                if "json" in content_type:
                    import json
                    return json.dumps(resp.json(), indent=2, ensure_ascii=False)
                return resp.text[:4000]  # Cap text responses

        except Exception as e:
            logger.error("API tool execution failed: %s — %s", tool_name, e)
            return f"API tool error: {str(e)}"

    async def _execute_storage_tool(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        tool_name: str,
        tool_input: dict,
    ) -> str:
        """Execute a storage tool call using per-user S3 credentials from DB."""
        import json
        import boto3
        from sqlalchemy import select
        from models.user import User

        try:
            # Load user's S3 config from database
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()

            if not user or not user.s3_endpoint_url or not user.s3_access_key or not user.s3_secret_key:
                return "Fehler: Object Storage ist nicht konfiguriert. Bitte unter Settings > Speicher die S3-Zugangsdaten eingeben."

            bucket = user.s3_bucket_name or "paix"
            region = user.s3_region or "fsn1"

            # Create per-user S3 client
            s3 = boto3.client(
                "s3",
                endpoint_url=user.s3_endpoint_url,
                aws_access_key_id=user.s3_access_key,
                aws_secret_access_key=user.s3_secret_key,
                region_name=region,
            )

            user_prefix = f"users/{user_id}/"

            if tool_name == "storage_list":
                path = tool_input.get("path", "")
                full_path = user_prefix + path.lstrip("/")
                resp = s3.list_objects_v2(Bucket=bucket, Prefix=full_path, Delimiter="/")
                items = []
                for p in resp.get("CommonPrefixes", []):
                    name = p["Prefix"].replace(full_path, "").strip("/")
                    if name:
                        items.append(f"📁 {name}/")
                for obj in resp.get("Contents", []):
                    name = obj["Key"].replace(full_path, "")
                    if name and not name.endswith("/"):
                        items.append(f"📄 {name} ({obj['Size']} bytes)")
                if not items:
                    return f"Ordner '{path or '/'}' ist leer."
                return f"Inhalt von '{path or '/'}':\n" + "\n".join(items)

            elif tool_name == "storage_read":
                path = tool_input.get("path", "")
                key = user_prefix + path.lstrip("/")
                resp = s3.get_object(Bucket=bucket, Key=key)
                data = resp["Body"].read()
                if len(data) > 50 * 1024:
                    return f"Datei zu groß zum Lesen ({len(data)} bytes)."
                try:
                    return data.decode("utf-8")
                except UnicodeDecodeError:
                    return f"Binärdatei ({len(data)} bytes) — kann nicht als Text angezeigt werden."

            elif tool_name == "storage_write":
                path = tool_input.get("path", "")
                content = tool_input.get("content", "")
                ct = tool_input.get("content_type", "text/plain")
                # Ensure UTF-8 charset for text content types
                if ct.startswith("text/") and "charset" not in ct:
                    ct += "; charset=utf-8"
                key = user_prefix + path.lstrip("/")
                data = content.encode("utf-8")
                s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=ct)
                return f"Datei gespeichert: {path} ({len(data)} bytes)"

            elif tool_name == "storage_delete":
                path = tool_input.get("path", "")
                key = user_prefix + path.lstrip("/")
                s3.delete_object(Bucket=bucket, Key=key)
                return f"Gelöscht: {path}"

            else:
                return f"Unbekanntes Storage-Tool: {tool_name}"

        except FileNotFoundError:
            return f"Datei nicht gefunden: {tool_input.get('path', '')}"
        except Exception as e:
            logger.error("Storage tool error: %s — %s", tool_name, e)
            return f"Storage-Fehler: {str(e)}"


# Singleton instance
skill_service = SkillService()
