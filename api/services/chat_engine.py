"""Chat Engine — core chat business logic, channel-agnostic.

Handles: system prompt building, LLM streaming, tool use rounds,
artifact creation, code execution, message persistence.
Delivers events to any ChannelAdapter.
"""

import json
import logging
import uuid
import zoneinfo
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from config import settings as app_settings
from models.user import User
from services.agent_state_service import agent_state_service
from services.chat_service import chat_service
from services.llm_service import llm_service, get_user_api_key
from services.llm_providers.factory import resolve_provider
from services.skill_service import skill_service
from services.graphiti_service import graphiti_service
from services.docker_executor_service import docker_executor
from services.channel_adapters.base import ChannelAdapter
from sqlalchemy import select

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 30

# ── Artifact Tool Definition ──
ARTIFACT_TOOL = {
    "name": "create_artifact",
    "description": (
        "Create a visual artifact that will be displayed in a side panel next to the chat. "
        "Use this for: code files, documents, HTML pages, Mermaid diagrams, SVG graphics, "
        "or any substantial content that benefits from its own viewing space. "
        "Do NOT use for short inline code snippets or brief text answers."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "Short title for the artifact (e.g. 'Login Component', 'API Documentation')",
            },
            "artifact_type": {
                "type": "string",
                "enum": ["code", "markdown", "html", "mermaid", "svg"],
                "description": (
                    "Type of artifact: "
                    "'code' for source code files, "
                    "'markdown' for documents/articles, "
                    "'html' for interactive HTML pages with inline CSS/JS, "
                    "'mermaid' for diagrams using Mermaid syntax, "
                    "'svg' for SVG graphics"
                ),
            },
            "language": {
                "type": "string",
                "description": "Programming language for code artifacts (e.g. 'python', 'typescript', 'jsx'). Only used when artifact_type is 'code'.",
            },
            "content": {
                "type": "string",
                "description": "The full content of the artifact.",
            },
        },
        "required": ["title", "artifact_type", "content"],
    },
}

# ── Run Code Tool Definition ──
WEB_FETCH_TOOL = {
    "name": "web_fetch",
    "description": (
        "Fetch the content of a web page by URL. Returns the text content of the page. "
        "Use this to read articles, blog posts, documentation, or any web page. "
        "Ideal for getting full context from URLs found via web_search."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The URL to fetch",
            },
            "max_length": {
                "type": "integer",
                "description": "Maximum characters to return (default: 10000)",
            },
        },
        "required": ["url"],
    },
}

# ── Run Code Tool Definition ──
RUN_CODE_TOOL = {
    "name": "run_code",
    "description": (
        "Execute code in an isolated Docker sandbox and return the output. "
        "Use this when the user asks you to run, test, or execute code. "
        "The code runs in a sandboxed container with no network access. "
        "Supported languages: python, javascript, bash."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "language": {
                "type": "string",
                "enum": ["python", "javascript", "bash"],
                "description": "Programming language to execute",
            },
            "code": {
                "type": "string",
                "description": "The source code to execute",
            },
        },
        "required": ["language", "code"],
    },
}


class ChatEngine:
    """Channel-agnostic chat processing engine."""

    # ──────────────────────────────────────────────
    # System Prompt
    # ──────────────────────────────────────────────

    async def build_system_prompt(
        self, user: User, user_message: str, db: "AsyncSession | None" = None
    ) -> str:
        """Build dynamic system prompt from user persona + TELOS + memory + agent state."""
        persona_name = user.persona_name or "PAIONE"
        user_id = str(user.id)

        # ── Current date/time (always first in system prompt) ──
        GERMAN_DAYS = {
            "Monday": "Montag", "Tuesday": "Dienstag", "Wednesday": "Mittwoch",
            "Thursday": "Donnerstag", "Friday": "Freitag", "Saturday": "Samstag",
            "Sunday": "Sonntag",
        }
        GERMAN_MONTHS = {
            "January": "Januar", "February": "Februar", "March": "Maerz",
            "April": "April", "May": "Mai", "June": "Juni", "July": "Juli",
            "August": "August", "September": "September", "October": "Oktober",
            "November": "November", "December": "Dezember",
        }
        try:
            berlin_tz = zoneinfo.ZoneInfo("Europe/Berlin")
            now_berlin = datetime.now(timezone.utc).astimezone(berlin_tz)
            day_en = now_berlin.strftime("%A")
            month_en = now_berlin.strftime("%B")
            day_de = GERMAN_DAYS.get(day_en, day_en)
            month_de = GERMAN_MONTHS.get(month_en, month_en)
            date_str = f"{day_de}, {now_berlin.strftime('%d')}. {month_de} {now_berlin.strftime('%Y')}, {now_berlin.strftime('%H:%M')} Uhr"
        except Exception:
            date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        date_prefix = f"Aktuelles Datum und Uhrzeit: {date_str}\n\n"

        # Structured persona sections
        sections = []
        if user.persona_personality:
            sections.append(f"## Persoenlichkeit\n{user.persona_personality}")
        if user.persona_about_user:
            sections.append(f"## Ueber den Nutzer\n{user.persona_about_user}")
        if user.persona_communication:
            sections.append(f"## Kommunikationsstil\n{user.persona_communication}")

        if sections:
            base_persona = f"Du bist {persona_name}.\n\n" + "\n\n".join(sections) + "\n\n"
        elif user.persona_prompt:
            # Fallback to legacy free-text field
            base_persona = user.persona_prompt + "\n\n"
        else:
            base_persona = (
                f"Du bist {persona_name}, ein persoenlicher AI-Assistent. "
                "Du sprichst Deutsch, bist praezise, freundlich und proaktiv. "
                "Du kennst den Nutzer, seine Ziele, Projekte und Kontakte aus dem TELOS-Profil "
                "und dem Knowledge Graph. Antworte hilfreich und kontextbezogen.\n\n"
            )

        base_persona += (
            "ARTIFACTS: Wenn du substanziellen Content erstellst (Code-Dateien, Dokumente, "
            "HTML-Seiten, Diagramme, SVG-Grafiken), nutze das create_artifact Tool. "
            "Das zeigt den Content in einem separaten Panel neben dem Chat an. "
            "Nutze es NICHT fuer kurze Code-Snippets oder einfache Textantworten. "
            "Nutze es fuer: ganze Dateien, laengere Dokumente, HTML-Previews, Diagramme."
        )

        # TELOS context from PostgreSQL
        telos_text = ""
        if db is not None:
            try:
                from models.telos_snapshot import TelosSnapshot
                for dim_name in ["goals", "mission", "challenges"]:
                    result = await db.execute(
                        select(TelosSnapshot)
                        .where(
                            TelosSnapshot.user_id == user.id,
                            TelosSnapshot.dimension == dim_name,
                        )
                        .order_by(TelosSnapshot.created_at.desc())
                        .limit(1)
                    )
                    snapshot = result.scalar_one_or_none()
                    if snapshot and snapshot.content_json:
                        entries = snapshot.content_json.get("entries", [])
                        active = [
                            e.get("content", "")
                            for e in entries
                            if e.get("status") != "archived" and e.get("content")
                        ]
                        if active:
                            label = {"goals": "Ziele", "mission": "Mission", "challenges": "Herausforderungen"}.get(dim_name, dim_name)
                            telos_text += f"\n\n{label} des Nutzers:\n" + "\n".join(
                                f"- {g}" for g in active[:5]
                            )
            except Exception:
                pass

        # Memory context from semantic search
        memory_text = ""
        try:
            results = await graphiti_service.search(query=user_message, limit=3)
            if results:
                snippets = []
                for r in results:
                    name = r.get("name", r.get("title", ""))
                    summary = r.get("summary", r.get("content", ""))
                    if name or summary:
                        snippets.append(f"- {name}: {summary}")
                if snippets:
                    memory_text = "\n\nRelevanter Kontext aus dem Gedaechtnis:\n" + "\n".join(snippets)
        except Exception:
            pass

        # Agent state context (last conversation summary + user preferences)
        agent_state_text = ""
        if db is not None:
            try:
                summary = await agent_state_service.get(db, user.id, "last_conversation_summary")
                if summary and isinstance(summary, dict):
                    user_msg_preview = summary.get("user_message", "")
                    assistant_preview = summary.get("assistant_summary", "")
                    if user_msg_preview or assistant_preview:
                        agent_state_text += (
                            "\n\nLetztes Gespraech (Zusammenfassung):\n"
                            f"Nutzer: {user_msg_preview}\n"
                            f"Assistent: {assistant_preview}"
                        )

                # Load user preference keys
                all_states = await agent_state_service.list_for_user(db, user.id, scope="global")
                prefs = [
                    s for s in all_states if s["key"].startswith("user_preference_")
                ]
                if prefs:
                    pref_lines = [
                        f"- {s['key'].replace('user_preference_', '')}: {s['value']}"
                        for s in prefs[:10]
                    ]
                    agent_state_text += (
                        "\n\nNutzer-Praeferenzen:\n" + "\n".join(pref_lines)
                    )
            except Exception:
                pass

        return date_prefix + base_persona + telos_text + memory_text + agent_state_text

    # ──────────────────────────────────────────────
    # Session Management
    # ──────────────────────────────────────────────

    async def _ensure_session(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        session_id_str: str | None,
        message: str,
    ) -> uuid.UUID:
        """Resolve or create a chat session. Returns the session UUID."""
        session_uuid: uuid.UUID | None = None
        if session_id_str:
            try:
                session_uuid = uuid.UUID(session_id_str)
                existing = await chat_service.get_session(db, session_uuid)
                if existing is None or existing.user_id != user_id:
                    session_uuid = None
            except ValueError:
                session_uuid = None

        if session_uuid is None:
            new_session = await chat_service.create_session(db, user_id)
            session_uuid = new_session.id
            await chat_service.auto_title(db, session_uuid, message)

        return session_uuid

    # ──────────────────────────────────────────────
    # Tool Setup
    # ──────────────────────────────────────────────

    async def _load_tools(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[dict]:
        """Load active skills as tools, plus artifact, run_code, and MCP tools."""
        tools = await skill_service.get_tools_for_user(db, user_id)
        tools.append(ARTIFACT_TOOL)
        tools.append(WEB_FETCH_TOOL)
        if app_settings.docker_sandbox_enabled:
            tools.append(RUN_CODE_TOOL)

        # Load MCP server tools
        mcp_tools = await self._load_mcp_tools(db, user_id)
        tools.extend(mcp_tools)

        # Load API werkzeug tools
        api_tools = await self._load_api_werkzeug_tools(db, user_id)
        tools.extend(api_tools)

        # Storage tools (available if user has S3 configured)
        tools.extend(await self._get_storage_tools(db, user_id))

        return tools

    async def _load_mcp_tools(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[dict]:
        """Load tools from active MCP servers in Anthropic Tool Use format."""
        from models.mcp_server import McpServer

        result = await db.execute(
            select(McpServer).where(
                McpServer.user_id == user_id,
                McpServer.active == True,  # noqa: E712
            )
        )
        servers = result.scalars().all()

        import re
        def _sanitize_tool_name(name: str) -> str:
            """Sanitize tool name for Anthropic API: only a-zA-Z0-9_-"""
            return re.sub(r'[^a-zA-Z0-9_-]', '_', name)[:128]

        tools: list[dict] = []
        for server in servers:
            safe_server = _sanitize_tool_name(server.name)
            for tool in (server.tools or []):
                if isinstance(tool, dict) and tool.get("name"):
                    safe_tool = _sanitize_tool_name(tool['name'])
                    tools.append({
                        "name": f"mcp__{safe_server}__{safe_tool}",
                        "description": tool.get("description", ""),
                        "input_schema": tool.get("input_schema", {
                            "type": "object",
                            "properties": {},
                        }),
                    })
                elif isinstance(tool, str) and tool:
                    safe_tool = _sanitize_tool_name(tool)
                    tools.append({
                        "name": f"mcp__{safe_server}__{safe_tool}",
                        "description": f"MCP tool '{tool}' from {server.name}",
                        "input_schema": {
                            "type": "object",
                            "properties": {},
                        },
                    })

        logger.info("Loaded %d MCP tools for user %s", len(tools), user_id)
        return tools

    async def _load_api_werkzeug_tools(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[dict]:
        """Load tools from active API werkzeuge in Anthropic Tool Use format."""
        from models.api_werkzeug import ApiWerkzeug

        result = await db.execute(
            select(ApiWerkzeug).where(
                ApiWerkzeug.user_id == user_id,
                ApiWerkzeug.active == True,  # noqa: E712
            )
        )
        werkzeuge = result.scalars().all()

        tools: list[dict] = []
        for w in werkzeuge:
            for ep in (w.endpoints or []):
                if not isinstance(ep, dict) or not ep.get("name"):
                    continue
                safe_w = re.sub(r'[^a-zA-Z0-9_-]', '_', w.name)[:50]
                safe_ep = re.sub(r'[^a-zA-Z0-9_-]', '_', ep['name'])[:50]
                tools.append({
                    "name": f"api__{safe_w}__{safe_ep}",
                    "description": ep.get("description", f"API call to {w.name}"),
                    "input_schema": ep.get("parameters", {
                        "type": "object",
                        "properties": {},
                    }),
                })

        if tools:
            logger.info("Loaded %d API werkzeug tools for user %s", len(tools), user_id)
        return tools

    # ──────────────────────────────────────────────
    # Storage tools
    # ──────────────────────────────────────────────

    async def _get_storage_tools(self, db: "AsyncSession", user_id: uuid.UUID) -> list[dict]:
        """Return storage tools if user has S3 configured in their profile."""
        from sqlalchemy import select
        from models.user import User
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.s3_endpoint_url or not user.s3_access_key or not user.s3_secret_key:
            return []
        return [
            {
                "name": "storage_list",
                "description": "List files and folders in the user's object storage. Returns folder and file names with sizes.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Folder path to list (empty string for root)",
                        },
                    },
                    "required": [],
                },
            },
            {
                "name": "storage_read",
                "description": "Read a text file from object storage. Returns the file content as text (max 50KB).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the file to read",
                        },
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "storage_write",
                "description": "Write/save a text file to object storage.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path where the file should be saved",
                        },
                        "content": {
                            "type": "string",
                            "description": "Text content to write",
                        },
                        "content_type": {
                            "type": "string",
                            "description": "MIME type (default: text/plain)",
                        },
                    },
                    "required": ["path", "content"],
                },
            },
            {
                "name": "storage_delete",
                "description": "Delete a file or folder from object storage.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to delete",
                        },
                    },
                    "required": ["path"],
                },
            },
        ]

    # ──────────────────────────────────────────────
    # History
    # ──────────────────────────────────────────────

    async def _load_history(
        self,
        db: AsyncSession,
        session_uuid: uuid.UUID,
        current_message: str,
    ) -> list[dict[str, str]]:
        """Load conversation history and ensure current message is included."""
        history = await chat_service.get_session_messages(db, session_uuid, limit=10)
        messages: list[dict[str, str]] = [
            {"role": msg.role, "content": msg.content}
            for msg in history
        ]
        if not messages or messages[-1].get("content") != current_message:
            messages.append({"role": "user", "content": current_message})
        return messages

    # ──────────────────────────────────────────────
    # Synchronous Process (REST)
    # ──────────────────────────────────────────────

    async def process(
        self,
        user: User,
        message: str,
        session_id: str | None,
        model: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Process a message synchronously (for REST).

        Returns: {text, skill_used, artifact, session_id, message_id, created_at}
        """
        user_id = user.id
        session_uuid = await self._ensure_session(db, user_id, session_id, message)

        # Save user message
        await chat_service.add_message(db, session_uuid, "user", message)

        # Build system prompt and load history
        system_prompt = await self.build_system_prompt(user, message, db=db)
        messages = await self._load_history(db, session_uuid, message)

        # Resolve API key
        provider_name = resolve_provider(model)
        user_api_key = await get_user_api_key(user_id, db, provider_name)

        # Load tools
        tools = await self._load_tools(db, user_id)
        skill_used: str | None = None
        artifact_data: dict | None = None

        # Build tool executor closure
        async def _tool_executor(tool_name: str, tool_input: dict) -> str:
            nonlocal artifact_data
            if tool_name == "create_artifact":
                artifact_data = {
                    "title": tool_input.get("title", "Artifact"),
                    "artifact_type": tool_input.get("artifact_type", "markdown"),
                    "language": tool_input.get("language"),
                    "content": tool_input.get("content", ""),
                }
                return "Artifact created and displayed to the user."
            elif tool_name == "run_code":
                exec_result = await docker_executor.run_code(
                    language=tool_input.get("language", "python"),
                    code=tool_input.get("code", ""),
                )
                result_parts = []
                if exec_result.stdout:
                    result_parts.append(f"Output:\n{exec_result.stdout}")
                if exec_result.stderr:
                    result_parts.append(f"Errors:\n{exec_result.stderr}")
                result_parts.append(f"Exit code: {exec_result.exit_code}")
                return "\n".join(result_parts) if result_parts else "Code executed with no output."
            return await skill_service.execute_tool_call(
                db=db, user_id=user_id, tool_name=tool_name, tool_input=tool_input
            )

        try:
            result = await llm_service.complete_with_tool_handling(
                messages=messages,
                system_prompt=system_prompt,
                model=model,
                max_tokens=16384,
                api_key=user_api_key,
                tools=tools if tools else None,
                tool_executor=_tool_executor if tools else None,
            )
            response_text = result.text
            skill_used = result.skill_used
            if skill_used:
                logger.info("Skill '%s' was used autonomously in chat", skill_used)
        except Exception as exc:
            error_msg = str(exc)
            response_text = f"Fehler: LLM error: {error_msg}"

        # Save assistant response
        assistant_msg = await chat_service.add_message(
            db, session_uuid, "assistant", response_text
        )

        # Persist artifact if one was created
        if artifact_data:
            await chat_service.save_artifact(
                db=db,
                session_id=session_uuid,
                message_id=assistant_msg.id,
                title=artifact_data["title"],
                artifact_type=artifact_data["artifact_type"],
                content=artifact_data["content"],
                language=artifact_data.get("language"),
            )

        # Store episode in Knowledge Graph (fire-and-forget)
        try:
            await graphiti_service.add_episode(
                user_message=message,
                assistant_response=response_text,
                session_id=str(session_uuid),
                skill_used=skill_used,
            )
        except Exception:
            pass  # Knowledge Graph storage should never block chat

        return {
            "text": response_text,
            "skill_used": skill_used,
            "artifact": artifact_data,
            "session_id": str(session_uuid),
            "message_id": str(assistant_msg.id),
            "created_at": assistant_msg.created_at,
        }

    # ──────────────────────────────────────────────
    # Streaming Process (WebSocket / any adapter)
    # ──────────────────────────────────────────────

    async def process_stream(
        self,
        adapter: ChannelAdapter,
        user: User,
        message: str,
        session_id: str | None,
        model: str,
        db: AsyncSession,
    ) -> None:
        """Process a message with streaming, sending events to the adapter.

        This is the main streaming loop extracted from chat_stream().
        Instead of websocket.send_json(), calls adapter.send_event().
        """
        user_id = user.id
        session_uuid = await self._ensure_session(db, user_id, session_id, message)

        # Save user message
        await chat_service.add_message(db, session_uuid, "user", message)

        # Generate message ID for this response
        message_id = str(uuid.uuid4())

        # Send thinking event immediately so frontend shows indicator
        await adapter.send_event({
            "type": "thinking",
            "session_id": str(session_uuid),
            "message_id": message_id,
        })

        # Build system prompt and load history
        system_prompt = await self.build_system_prompt(user, message, db=db)
        messages = await self._load_history(db, session_uuid, message)

        # Resolve API key
        provider_name = resolve_provider(model)
        user_api_key = await get_user_api_key(user_id, db, provider_name)

        # Load tools
        tools = await self._load_tools(db, user_id)
        skill_used: str | None = None

        # Stream response (with tool use support)
        full_response = ""
        collected_artifacts: list[dict] = []

        if tools:
            # ── Streaming Tool Use Path ──
            working_messages = list(messages)

            for _round in range(MAX_TOOL_ROUNDS):
                # Track current tool state
                current_tools: dict[int, dict] = {}  # index -> {name, id, json_buffer}
                text_buffer = ""
                stop_reason = None
                final_msg = None

                async for event in llm_service.stream_raw_events(
                    messages=working_messages,
                    system_prompt=system_prompt,
                    model=model,
                    max_tokens=16384,
                    api_key=user_api_key,
                    tools=tools,
                ):
                    if event["event"] == "text_delta":
                        text = event["text"]
                        text_buffer += text
                        full_response += text
                        await adapter.send_event({
                            "type": "chunk",
                            "content": text,
                            "session_id": str(session_uuid),
                            "message_id": message_id,
                        })

                    elif event["event"] == "tool_start":
                        tool_name = event["tool_name"]
                        current_tools[event["index"]] = {
                            "name": tool_name,
                            "id": event["tool_id"],
                            "json_buffer": "",
                            "content_marker_found": False,
                            "content_sent": 0,
                        }
                        if tool_name == "create_artifact":
                            await adapter.send_event({
                                "type": "artifact_start",
                                "session_id": str(session_uuid),
                                "message_id": message_id,
                            })
                        else:
                            # Send tool_use_start for non-artifact tools
                            await adapter.send_event({
                                "type": "tool_use_start",
                                "tool_name": tool_name,
                                "tool_id": event["tool_id"],
                                "index": event["index"],
                                "session_id": str(session_uuid),
                                "message_id": message_id,
                            })
                            # Keep skill_used for backwards compat
                            if skill_used is None:
                                skill_used = tool_name
                            await adapter.send_event({
                                "type": "skill_used",
                                "skill": tool_name,
                                "session_id": str(session_uuid),
                                "message_id": message_id,
                            })

                    elif event["event"] == "tool_delta":
                        idx = event["index"]
                        tool_info = current_tools.get(idx)
                        if tool_info:
                            tool_info["json_buffer"] += event["partial_json"]

                            # Stream artifact content incrementally
                            if tool_info["name"] == "create_artifact":
                                buf = tool_info["json_buffer"]
                                if not tool_info["content_marker_found"]:
                                    # Look for "content": " or "content":" marker
                                    for marker in ['"content": "', '"content":"']:
                                        pos = buf.find(marker)
                                        if pos != -1:
                                            tool_info["content_marker_found"] = True
                                            tool_info["content_start"] = pos + len(marker)
                                            tool_info["content_sent"] = tool_info["content_start"]
                                            # Extract metadata from prefix
                                            try:
                                                pre = buf[:pos].rstrip().rstrip(",") + "}"
                                                if not pre.startswith("{"):
                                                    pre = "{" + pre
                                                meta = json.loads(pre)
                                                await adapter.send_event({
                                                    "type": "artifact_meta",
                                                    "title": meta.get("title", "Artifact"),
                                                    "artifact_type": meta.get("artifact_type", "code"),
                                                    "language": meta.get("language"),
                                                    "session_id": str(session_uuid),
                                                    "message_id": message_id,
                                                })
                                            except Exception:
                                                pass
                                            # Send initial content chunk
                                            initial = buf[tool_info["content_start"]:]
                                            if initial:
                                                decoded = initial.replace("\\n", "\n").replace("\\t", "\t").replace('\\"', '"').replace("\\\\", "\\")
                                                await adapter.send_event({
                                                    "type": "artifact_chunk",
                                                    "content": decoded,
                                                    "session_id": str(session_uuid),
                                                    "message_id": message_id,
                                                })
                                                tool_info["content_sent"] = len(buf)
                                            break
                                else:
                                    # Send new content since last send
                                    new_content = buf[tool_info["content_sent"]:]
                                    if new_content:
                                        decoded = new_content.replace("\\n", "\n").replace("\\t", "\t").replace('\\"', '"').replace("\\\\", "\\")
                                        await adapter.send_event({
                                            "type": "artifact_chunk",
                                            "content": decoded,
                                            "session_id": str(session_uuid),
                                            "message_id": message_id,
                                        })
                                        tool_info["content_sent"] = len(buf)

                    elif event["event"] == "tool_end":
                        idx = event["index"]
                        tool_info = current_tools.get(idx)
                        if tool_info and tool_info["name"] != "create_artifact":
                            # Send tool_use_input for non-artifact tools
                            try:
                                tool_input_parsed = json.loads(tool_info["json_buffer"])
                            except Exception:
                                tool_input_parsed = {"raw": tool_info["json_buffer"][:200]}
                            await adapter.send_event({
                                "type": "tool_use_input",
                                "tool_name": tool_info["name"],
                                "tool_id": tool_info["id"],
                                "input": tool_input_parsed,
                                "session_id": str(session_uuid),
                                "message_id": message_id,
                            })
                        if tool_info and tool_info["name"] == "create_artifact":
                            # Parse final artifact JSON
                            try:
                                artifact_input = json.loads(tool_info["json_buffer"])
                            except Exception:
                                artifact_input = {
                                    "title": "Artifact",
                                    "artifact_type": "code",
                                    "content": tool_info["json_buffer"],
                                }
                            await adapter.send_event({
                                "type": "artifact_end",
                                "title": artifact_input.get("title", "Artifact"),
                                "artifact_type": artifact_input.get("artifact_type", "code"),
                                "language": artifact_input.get("language"),
                                "content": artifact_input.get("content", ""),
                                "session_id": str(session_uuid),
                                "message_id": message_id,
                            })
                            # Collect artifact for DB persistence after message is saved
                            collected_artifacts.append({
                                "title": artifact_input.get("title", "Artifact"),
                                "artifact_type": artifact_input.get("artifact_type", "code"),
                                "language": artifact_input.get("language"),
                                "content": artifact_input.get("content", ""),
                            })
                            logger.info(
                                "Artifact streamed: %s (%s)",
                                artifact_input.get("title"),
                                artifact_input.get("artifact_type"),
                            )

                    elif event["event"] == "message_end":
                        stop_reason = event["stop_reason"]

                    elif event["event"] == "final_message":
                        final_msg = event["message"]

                # After stream completes, check if we need tool result loop
                if stop_reason != "tool_use" or not final_msg:
                    break

                # Tool use detected — process tool results
                tool_use_blocks = [
                    block for block in final_msg.content
                    if block.type == "tool_use"
                ]

                if not tool_use_blocks:
                    break

                # Append assistant message
                working_messages.append({
                    "role": "assistant",
                    "content": [
                        block.model_dump()
                        if hasattr(block, "model_dump")
                        else block
                        for block in final_msg.content
                    ],
                })

                # Execute non-artifact tools and collect results
                tool_results_content = []
                for tool_block in tool_use_blocks:
                    tool_name = tool_block.name
                    tool_input = tool_block.input
                    tool_use_id = tool_block.id

                    if tool_name == "create_artifact":
                        tool_result_str = "Artifact was created and displayed to the user."
                    elif tool_name == "run_code":
                        # Send execution start event
                        await adapter.send_event({
                            "type": "code_execution_start",
                            "language": tool_input.get("language", "python"),
                            "code": tool_input.get("code", "")[:2000],
                            "session_id": str(session_uuid),
                            "message_id": message_id,
                        })
                        # Execute in Docker sandbox
                        exec_result = await docker_executor.run_code(
                            language=tool_input.get("language", "python"),
                            code=tool_input.get("code", ""),
                        )
                        # Send execution result event
                        await adapter.send_event({
                            "type": "code_execution_result",
                            "language": exec_result.language,
                            "stdout": exec_result.stdout[:2000],
                            "stderr": exec_result.stderr[:1000],
                            "exit_code": exec_result.exit_code,
                            "timed_out": exec_result.timed_out,
                            "duration_ms": exec_result.duration_ms,
                            "session_id": str(session_uuid),
                            "message_id": message_id,
                        })
                        # Build result string for LLM
                        result_parts = []
                        if exec_result.stdout:
                            result_parts.append(f"Output:\n{exec_result.stdout}")
                        if exec_result.stderr:
                            result_parts.append(f"Errors:\n{exec_result.stderr}")
                        if exec_result.timed_out:
                            result_parts.append(f"(Timed out after {app_settings.docker_sandbox_timeout}s)")
                        result_parts.append(f"Exit code: {exec_result.exit_code}")
                        tool_result_str = "\n".join(result_parts) if result_parts else "Code executed with no output."
                        logger.info(
                            "Code executed: %s, exit=%d, %dms",
                            exec_result.language,
                            exec_result.exit_code,
                            exec_result.duration_ms,
                        )
                    else:
                        logger.info("WS Tool call: %s with %s", tool_name, tool_input)
                        try:
                            tool_result_str = await skill_service.execute_tool_call(
                                db=db,
                                user_id=user_id,
                                tool_name=tool_name,
                                tool_input=tool_input,
                            )
                        except Exception as tex:
                            tool_result_str = f"Error executing skill: {str(tex)}"
                        # Send tool_use_result for non-artifact tools
                        await adapter.send_event({
                            "type": "tool_use_result",
                            "tool_name": tool_name,
                            "tool_id": tool_use_id,
                            "result": tool_result_str[:500],
                            "success": not tool_result_str.startswith("Error"),
                            "session_id": str(session_uuid),
                            "message_id": message_id,
                        })

                    tool_results_content.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": tool_result_str,
                    })

                working_messages.append({
                    "role": "user",
                    "content": tool_results_content,
                })

                # Signal thinking again before next LLM round
                await adapter.send_event({
                    "type": "thinking",
                    "session_id": str(session_uuid),
                    "message_id": message_id,
                })

            else:
                # Max rounds — final streamed call without tools
                async for chunk in llm_service.stream(
                    messages=working_messages,
                    system_prompt=system_prompt,
                    model=model,
                    api_key=user_api_key,
                    tools=None,
                ):
                    full_response += chunk
                    await adapter.send_event({
                        "type": "chunk",
                        "content": chunk,
                        "session_id": str(session_uuid),
                        "message_id": message_id,
                    })

        else:
            # ── No Tools Path — standard streaming ──
            async for chunk in llm_service.stream(
                messages=messages,
                system_prompt=system_prompt,
                model=model,
                api_key=user_api_key,
            ):
                full_response += chunk
                await adapter.send_event({
                    "type": "chunk",
                    "content": chunk,
                    "session_id": str(session_uuid),
                    "message_id": message_id,
                })

        # Save assistant response
        assistant_msg = await chat_service.add_message(
            db, session_uuid, "assistant", full_response
        )

        # Persist collected artifacts linked to the saved message
        for art_data in collected_artifacts:
            await chat_service.save_artifact(
                db=db,
                session_id=session_uuid,
                message_id=assistant_msg.id,
                title=art_data["title"],
                artifact_type=art_data["artifact_type"],
                content=art_data["content"],
                language=art_data.get("language"),
            )

        # Save conversation summary as agent state (best-effort)
        try:
            from datetime import datetime, timezone as _tz
            summary_value = {
                "user_message": message[:200],
                "assistant_summary": full_response[:300],
                "timestamp": datetime.now(_tz.utc).isoformat(),
                "session_id": str(session_uuid),
            }
            await agent_state_service.set(
                db, user_id, "last_conversation_summary", summary_value, scope="global"
            )
        except Exception:
            pass

        # Store episode in Knowledge Graph (fire-and-forget)
        try:
            await graphiti_service.add_episode(
                user_message=message,
                assistant_response=full_response,
                session_id=str(session_uuid),
                skill_used=skill_used,
            )
        except Exception:
            pass  # Knowledge Graph storage should never block chat

        await db.commit()

        # Send end signal
        await adapter.send_event({
            "type": "end",
            "message_id": str(assistant_msg.id),
            "skill_used": skill_used,
            "sources": [],
        })


# Singleton
chat_engine = ChatEngine()
