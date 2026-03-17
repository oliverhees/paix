"""Skills Endpoints — skill configuration, execution, and logs."""

import json
import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import case, func, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.mcp_server import McpServer
from models.skill import SkillConfig, SkillExecution
from models.user import User
from services.llm_service import llm_service, get_user_anthropic_key
from services.skill_service import skill_service, SKILL_DEFINITIONS, DEFAULT_SKILL_MDS
from services.skill_parser import parse_skill_md, build_skill_md

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────────────────────────
# Seed data — built from SKILL_DEFINITIONS in skill_service.py
# Each entry maps to a SkillConfig row (is_custom=False)
# ──────────────────────────────────────────────

_SEED_CATEGORIES: dict[str, tuple[str, str]] = {
    "calendar_briefing": ("productivity", "\U0001f4c5"),   # 📅
    "content_pipeline": ("writing", "\u270d\ufe0f"),       # ✍️
    "meeting_prep": ("productivity", "\U0001f91d"),         # 🤝
    "follow_up": ("communication", "\U0001f4e9"),           # 📩
    "idea_capture": ("creativity", "\U0001f4a1"),           # 💡
}


def _build_seed_skills() -> list[dict]:
    """Build seed skill list from SKILL_DEFINITIONS (single source of truth)."""
    seeds = []
    for skill_id, defn in SKILL_DEFINITIONS.items():
        cat, icon = _SEED_CATEGORIES.get(skill_id, (None, None))
        seeds.append(
            {
                "skill_id": skill_id,
                "name": defn.get("name", skill_id),
                "description": defn.get("description", ""),
                "system_prompt": defn.get("system_prompt", ""),
                "parameters": defn.get("parameters", {}),
                "allowed_tools": defn.get("allowed_tools", []),
                "metadata_json": defn.get("metadata", {}),
                "skill_md": DEFAULT_SKILL_MDS.get(skill_id),
                "category": cat,
                "icon": icon,
            }
        )
    return seeds


SEED_SKILLS = _build_seed_skills()


# ──────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────


class SkillScheduleRequest(BaseModel):
    cron_expression: str  # e.g. "30 7 * * *"
    timezone: str = "Europe/Berlin"
    description: str = ""


class SkillUpdateRequest(BaseModel):
    active: bool | None = None
    autonomy_level: int | None = None
    config: dict | None = None
    skill_md: str | None = None
    category: str | None = None
    icon: str | None = None
    output_path: str | None = None


class SkillExecuteRequest(BaseModel):
    input: str = ""
    parameters: dict | None = None


class SkillCreateRequest(BaseModel):
    name: str
    description: str = ""
    system_prompt: str = ""
    allowed_tools: list[str] = []
    parameters: dict = {}
    metadata: dict = {}
    skill_md: str | None = None
    category: str | None = None
    icon: str | None = None
    output_path: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        return v


class SkillGenerateRequest(BaseModel):
    messages: list[dict] = []  # [{"role": "user"|"assistant", "content": "..."}]


class SkillParseMdRequest(BaseModel):
    skill_md: str


# ──────────────────────────────────────────────
# Skill Generator (AI-guided creation) – now outputs SKILL.md format
# ──────────────────────────────────────────────

SKILL_GENERATOR_SYSTEM_PROMPT = """\
Du bist ein Skill-Konfigurator fuer PAI-X, einen Personal AI Assistant. Deine Aufgabe ist es, durch gezielte Fragen herauszufinden, was der Benutzer braucht, und daraus einen Skill im SKILL.md Format zu erstellen.

## Verfuegbare System-Capabilities

Der Skill laeuft innerhalb von PAI-X und hat Zugriff auf folgende Tools. Nutze diese in deinen Skill-Anweisungen:

### Websuche & Internet
- **web_search**: Websuche mit Brave Search oder DuckDuckGo. Parameter: query (string), max_results (int, max 5)
- **web_fetch**: Eine Webseite abrufen und den Textinhalt lesen. Parameter: url (string), max_length (int, default 10000). Ideal um nach web_search die vollen Artikel zu lesen.

### Dateien & Speicher
- **storage_list**: Dateien und Ordner im persoenlichen Object Storage (S3) auflisten. Parameter: path (string)
- **storage_read**: Eine Textdatei aus dem Object Storage lesen. Parameter: path (string)
- **storage_write**: Eine Textdatei im Object Storage speichern. Parameter: path (string), content (string), content_type (string). Beispiel-Pfade: "briefings/datei.md", "notizen/todo.txt", "reports/analyse.md"
- **storage_delete**: Eine Datei aus dem Object Storage loeschen. Parameter: path (string)

### Content & Ausgabe
- **create_artifact**: Substanziellen Content (Dokumente, Code, HTML, Diagramme, SVG) in einem Side-Panel neben dem Chat anzeigen. Parameter: title (string), content (string), type (string: "text/markdown", "text/html", "application/javascript", "image/svg+xml", "application/vnd.ant.mermaid")

### Skill-Verkettung
- **call_skill**: Einen anderen Skill aufrufen. Parameter: skill_id (string), input (string). Ermoeglicht Skill-Pipelines: z.B. erst recherchieren, dann Artikel schreiben. Max 3 Ebenen tief.

### Wichtige Regeln fuer Skills
1. **Dateien speichern**: Nutze `storage_write` mit sinnvollen Pfaden (z.B. "briefings/briefing-2026-03-17.md"). NICHT "/mnt/..." oder lokale Pfade — es gibt kein lokales Dateisystem.
2. **Webrecherche**: Nutze `web_search` fuer Suchen und `web_fetch` um die gefundenen URLs zu lesen.
3. **Ergebnisse anzeigen**: Nutze `create_artifact` fuer laengere Dokumente die der User sehen soll.
4. **Kombination**: Skills koennen mehrere Tools kombinieren. Z.B. web_search → web_fetch → storage_write → create_artifact.
5. **Skill-Pipelines**: Nutze `call_skill` um andere Skills aufzurufen und Ergebnisse zu verketten.

## Skill-Erstellung

Frage nacheinander ab:
1. Was soll der Skill tun? (daraus leitest du name + description ab)
2. Wie soll der Skill sich verhalten? Gibt es spezielle Anweisungen? (daraus leitest du die Markdown-Anweisungen ab)
3. Braucht der Skill Zugriff auf bestimmte Tools aus der obigen Liste? (erwaehne verfuegbare Tools)
4. Gibt es Parameter die der Benutzer beim Ausfuehren angeben soll? (daraus leitest du die Parameters-Sektion ab)

Wenn du genug Informationen hast, antworte mit einem SKILL.md Block:
```skill_md
---
name: skill-name
description: |
  Beschreibung des Skills.
  Wann soll dieser Skill genutzt werden.
---

# Skill-Titel

Du bist ein [Rolle].

## Verfuegbare Tools
- web_search: Websuche
- web_fetch: Webseiten abrufen
- storage_write: Dateien speichern
- create_artifact: Dokumente anzeigen
[Liste nur die Tools die dieser Skill braucht]

## Anweisungen
[Detaillierte Anweisungen fuer den Skill]

## Parameters
- **param_name** (type, required/optional): Beschreibung.

## Output Format
[Gewuenschtes Ausgabeformat]

## Speicherort
[Wenn der Skill Dateien erstellt: z.B. "Speichere unter: briefings/dateiname-YYYY-MM-DD.md"]
```

Stelle immer nur EINE Frage auf einmal. Sei freundlich und hilfreich. Wenn der Benutzer keine Werkzeuge oder Parameter braucht, ist das ok — ueberspringe diese Schritte dann.

WICHTIG:
- Schlage proaktiv passende Tools aus der Capabilities-Liste vor
- Erklaere dem User kurz welche Tools der Skill nutzen wird
- Verwende IMMER storage_write statt lokaler Dateipfade
- Erstelle realistische, ausfuehrliche Skill-Anweisungen
- Wenn du den Skill fertig hast, gib IMMER den skill_md Block aus. Gib ZUSAETZLICH auch ein JSON-Block aus:
```json
{"skill_ready": true, "name": "...", "description": "...", "allowed_tools": []}
```
"""


def _build_generator_context(mcp_servers: list[dict]) -> str:
    """Build context about available MCP servers for the generator agent."""
    if not mcp_servers:
        return ""
    lines = ["\n\nVerfuegbare MCP-Werkzeuge des Benutzers:"]
    for srv in mcp_servers:
        name = srv["name"]
        tools = srv.get("tools", [])
        tool_refs = [f"mcp__{name}__{t}" for t in tools]
        lines.append(f"- Server \"{name}\": {', '.join(tool_refs) if tool_refs else '(keine Tools)'}")
    lines.append(
        "\nWenn der Benutzer Werkzeuge braucht, schlage passende aus dieser Liste vor. "
        "Verwende die tool_ref-Notation (mcp__servername__toolname)."
    )
    return "\n".join(lines)


def _parse_skill_from_response(text: str) -> dict | None:
    """Try to extract a skill_ready JSON block from the LLM response."""
    # Try to find JSON in code blocks first
    code_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if code_block:
        try:
            data = json.loads(code_block.group(1))
            if data.get("skill_ready"):
                return data
        except json.JSONDecodeError:
            pass

    # Try to find bare JSON object with skill_ready
    json_match = re.search(r"\{[^{}]*\"skill_ready\"\s*:\s*true[^{}]*\}", text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(0))
            if data.get("skill_ready"):
                return data
        except json.JSONDecodeError:
            pass

    # Try to find any JSON block that contains skill_ready (for nested/larger objects)
    brace_depth = 0
    start_idx = None
    for i, ch in enumerate(text):
        if ch == "{":
            if brace_depth == 0:
                start_idx = i
            brace_depth += 1
        elif ch == "}":
            brace_depth -= 1
            if brace_depth == 0 and start_idx is not None:
                candidate = text[start_idx : i + 1]
                if "skill_ready" in candidate:
                    try:
                        data = json.loads(candidate)
                        if data.get("skill_ready"):
                            return data
                    except json.JSONDecodeError:
                        pass
                start_idx = None

    return None


def _extract_skill_md_from_response(text: str) -> str | None:
    """Extract a SKILL.md block from the LLM response (```skill_md ... ``` or --- fenced)."""
    # Look for ```skill_md ... ``` block
    skill_md_block = re.search(r"```skill_md\s*\n(.*?)```", text, re.DOTALL)
    if skill_md_block:
        return skill_md_block.group(1).strip()

    # Look for ```markdown ... ``` block that contains frontmatter
    md_block = re.search(r"```(?:markdown)?\s*\n(---\n.*?---\n.*?)```", text, re.DOTALL)
    if md_block:
        return md_block.group(1).strip()

    return None


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────


async def _ensure_defaults_seeded(user_id: uuid.UUID, db: AsyncSession) -> None:
    """Ensure all default (non-custom) skills are seeded for this user."""
    for seed in SEED_SKILLS:
        result = await db.execute(
            select(SkillConfig).where(
                SkillConfig.user_id == user_id,
                SkillConfig.skill_id == seed["skill_id"],
            )
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            db.add(
                SkillConfig(
                    user_id=user_id,
                    skill_id=seed["skill_id"],
                    name=seed["name"],
                    description=seed["description"],
                    system_prompt=seed["system_prompt"],
                    parameters=seed["parameters"],
                    allowed_tools=seed["allowed_tools"],
                    metadata_json=seed["metadata_json"],
                    skill_md=seed.get("skill_md"),
                    category=seed.get("category"),
                    icon=seed.get("icon"),
                    active=True,
                    autonomy_level=3,
                    config={},
                    is_custom=False,
                )
            )
        else:
            # Keep existing user preferences (active, autonomy_level, config),
            # but sync definition fields if this is a non-custom seed skill.
            if not existing.is_custom:
                needs_update = False
                if existing.name != seed["name"]:
                    existing.name = seed["name"]
                    needs_update = True
                if existing.description != seed["description"]:
                    existing.description = seed["description"]
                    needs_update = True
                if existing.system_prompt != seed["system_prompt"]:
                    existing.system_prompt = seed["system_prompt"]
                    needs_update = True
                if existing.parameters != seed["parameters"]:
                    existing.parameters = seed["parameters"]
                    needs_update = True
                if existing.allowed_tools != seed["allowed_tools"]:
                    existing.allowed_tools = seed["allowed_tools"]
                    needs_update = True
                # Sync skill_md for defaults
                new_skill_md = seed.get("skill_md")
                if existing.skill_md != new_skill_md and new_skill_md is not None:
                    existing.skill_md = new_skill_md
                    needs_update = True
                # Sync category and icon for defaults
                seed_cat = seed.get("category")
                if existing.category != seed_cat and seed_cat is not None:
                    existing.category = seed_cat
                    needs_update = True
                seed_icon = seed.get("icon")
                if existing.icon != seed_icon and seed_icon is not None:
                    existing.icon = seed_icon
                    needs_update = True
                if needs_update:
                    db.add(existing)
    await db.flush()


def _cfg_to_dict(cfg: SkillConfig, execution_stats: dict | None = None) -> dict:
    """Serialize a SkillConfig to a response dict."""
    stats = execution_stats or {}
    return {
        "id": cfg.skill_id,
        "db_id": str(cfg.id),
        "name": cfg.name or cfg.skill_id,
        "description": cfg.description or "",
        "system_prompt": cfg.system_prompt or "",
        "skill_md": cfg.skill_md or None,
        "active": cfg.active,
        "autonomy_level": cfg.autonomy_level,
        "config": cfg.config,
        "parameters": cfg.parameters or {},
        "allowed_tools": cfg.allowed_tools or [],
        "is_custom": cfg.is_custom,
        "category": cfg.category,
        "icon": cfg.icon,
        "output_path": cfg.output_path,
        "metadata": cfg.metadata_json or {},
        "last_execution": stats.get("last_execution"),
        "execution_count": stats.get("execution_count", 0),
        "success_rate": stats.get("success_rate", 0.0),
    }


async def _get_execution_stats(
    user_id: uuid.UUID, skill_id: str, db: AsyncSession
) -> dict:
    """Return execution stats for a skill."""
    count_result = await db.execute(
        select(func.count())
        .select_from(SkillExecution)
        .where(
            SkillExecution.user_id == user_id,
            SkillExecution.skill_id == skill_id,
        )
    )
    execution_count = count_result.scalar() or 0

    success_count_result = await db.execute(
        select(func.count())
        .select_from(SkillExecution)
        .where(
            SkillExecution.user_id == user_id,
            SkillExecution.skill_id == skill_id,
            SkillExecution.status == "success",
        )
    )
    success_count = success_count_result.scalar() or 0
    success_rate = (success_count / execution_count) if execution_count > 0 else 0.0

    last_exec_result = await db.execute(
        select(SkillExecution)
        .where(
            SkillExecution.user_id == user_id,
            SkillExecution.skill_id == skill_id,
        )
        .order_by(SkillExecution.created_at.desc())
        .limit(1)
    )
    last_exec = last_exec_result.scalar_one_or_none()

    return {
        "execution_count": execution_count,
        "success_rate": round(success_rate, 2),
        "last_execution": (
            last_exec.created_at.isoformat() if last_exec and last_exec.created_at else None
        ),
    }


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.get("/skills")
async def list_skills(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all skills with their configuration and execution stats."""
    await _ensure_defaults_seeded(user.id, db)

    result = await db.execute(
        select(SkillConfig).where(SkillConfig.user_id == user.id)
    )
    configs = list(result.scalars().all())

    skills = []
    for cfg in configs:
        stats = await _get_execution_stats(user.id, cfg.skill_id, db)
        skills.append(_cfg_to_dict(cfg, stats))

    return {"skills": skills}


@router.post("/skills", status_code=status.HTTP_201_CREATED)
async def create_skill(
    request: SkillCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new custom skill for the authenticated user."""
    # Generate a unique skill_id from the name
    import re
    base_id = request.name.lower().replace(" ", "_").replace("-", "_")
    # Strip everything except ASCII a-z, 0-9, underscore (no umlauts!)
    base_id = re.sub(r'[^a-z0-9_]', '', base_id)
    if not base_id:
        base_id = "skill"
    skill_id = f"custom_{base_id}_{uuid.uuid4().hex[:8]}"

    # If skill_md is provided, parse it to populate fields
    skill_md = request.skill_md
    parsed_name = request.name
    parsed_description = request.description
    parsed_system_prompt = request.system_prompt
    parsed_parameters = request.parameters

    if skill_md:
        parsed = parse_skill_md(skill_md)
        if parsed["name"]:
            parsed_name = parsed["name"]
        if parsed["description"]:
            parsed_description = parsed["description"]
        if parsed["instructions"]:
            parsed_system_prompt = parsed["instructions"]
        if parsed["parameters"]:
            parsed_parameters = parsed["parameters"]

    cfg = SkillConfig(
        user_id=user.id,
        skill_id=skill_id,
        name=parsed_name,
        description=parsed_description,
        system_prompt=parsed_system_prompt,
        allowed_tools=request.allowed_tools,
        parameters=parsed_parameters,
        metadata_json=request.metadata,
        skill_md=skill_md,
        category=request.category,
        icon=request.icon,
        output_path=request.output_path,
        active=True,
        autonomy_level=3,
        config={},
        is_custom=True,
    )
    db.add(cfg)
    await db.flush()

    return {"skill": _cfg_to_dict(cfg)}


# ──────────────────────────────────────────────
# AI-Guided Skill Generation (MUST be before {skill_id} routes)
# ──────────────────────────────────────────────


@router.post("/skills/generate")
async def generate_skill(
    request: SkillGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    AI-guided skill creation. Send conversation messages and receive either
    a follow-up question or a completed skill configuration in SKILL.md format.
    """
    # Fetch user's MCP servers for context
    srv_result = await db.execute(
        select(McpServer).where(
            McpServer.user_id == user.id,
            McpServer.active == True,  # noqa: E712
        )
    )
    servers = list(srv_result.scalars().all())
    server_dicts = [
        {"name": s.name, "tools": s.tools or []}
        for s in servers
    ]

    # Build system prompt with MCP context
    system_prompt = SKILL_GENERATOR_SYSTEM_PROMPT + _build_generator_context(server_dicts)

    # Get user's API key from DB
    user_api_key = await get_user_anthropic_key(user.id, db)

    # Build conversation messages
    messages = list(request.messages)

    # If no messages yet, start the conversation
    if not messages:
        messages = [{"role": "user", "content": "Ich moechte einen neuen Skill erstellen."}]

    try:
        response_text = await llm_service.complete(
            messages=messages,
            system_prompt=system_prompt,
            max_tokens=2048,
            temperature=0.7,
            api_key=user_api_key,
        )
    except Exception as exc:
        logger.error("Skill generation LLM call failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Fehler bei der KI-Kommunikation. Bitte versuche es erneut.",
        )

    # Update conversation history with assistant response
    updated_messages = messages + [{"role": "assistant", "content": response_text}]

    # Check if the response contains a completed skill config
    skill_data = _parse_skill_from_response(response_text)
    extracted_skill_md = _extract_skill_md_from_response(response_text)

    if skill_data:
        # Extract the clean message (text before/after the JSON/skill_md blocks)
        clean_message = re.sub(
            r"```(?:json|skill_md|markdown)?\s*.*?\s*```", "", response_text, flags=re.DOTALL
        ).strip()
        if not clean_message:
            clean_message = f"Ich habe den Skill \"{skill_data.get('name', 'Neuer Skill')}\" fuer dich konfiguriert."

        # Build skill_md from extracted block or from skill_data
        final_skill_md = extracted_skill_md
        if not final_skill_md:
            # Build from JSON data
            final_skill_md = build_skill_md(
                name=skill_data.get("name", "Neuer Skill"),
                description=skill_data.get("description", ""),
                instructions=skill_data.get("system_prompt", ""),
            )

        return {
            "type": "skill_ready",
            "message": clean_message,
            "skill": {
                "name": skill_data.get("name", "Neuer Skill"),
                "description": skill_data.get("description", ""),
                "system_prompt": skill_data.get("system_prompt", ""),
                "allowed_tools": skill_data.get("allowed_tools", []),
                "parameters": skill_data.get("parameters", {}),
                "skill_md": final_skill_md,
            },
            "messages": updated_messages,
        }

    # Follow-up question
    return {
        "type": "question",
        "message": response_text,
        "messages": updated_messages,
    }


@router.post("/skills/parse-md")
async def parse_skill_md_endpoint(
    request: SkillParseMdRequest,
    user: User = Depends(get_current_user),
):
    """Parse a SKILL.md string and return the extracted fields (for frontend preview)."""
    parsed = parse_skill_md(request.skill_md)
    return {
        "parsed": {
            "name": parsed["name"],
            "description": parsed["description"],
            "dependencies": parsed["dependencies"],
            "instructions": parsed["instructions"],
            "parameters": parsed["parameters"],
        }
    }


@router.post("/skills/seed-defaults")
async def seed_default_skills(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update the 5 default skills with SKILL.md content for the current user."""
    await _ensure_defaults_seeded(user.id, db)
    await db.commit()

    # Return all skills
    result = await db.execute(
        select(SkillConfig).where(
            SkillConfig.user_id == user.id,
            SkillConfig.is_custom == False,  # noqa: E712
        )
    )
    configs = list(result.scalars().all())

    return {
        "message": f"Seeded {len(configs)} default skills with SKILL.md format",
        "skills": [_cfg_to_dict(cfg) for cfg in configs],
    }


@router.get("/skills/executions")
async def list_skill_executions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, le=50),
    offset: int = Query(default=0),
):
    """List all skill executions for the user, most recent first."""
    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    result = await db.execute(
        select(SkillExecution)
        .where(SkillExecution.user_id == user.id)
        .order_by(SkillExecution.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    executions = list(result.scalars().all())

    # Fetch skill names for display
    skill_ids = list({e.skill_id for e in executions})
    skill_names: dict[str, str] = {}
    if skill_ids:
        name_result = await db.execute(
            select(SkillConfig.skill_id, SkillConfig.name).where(
                SkillConfig.user_id == user.id,
                SkillConfig.skill_id.in_(skill_ids),
            )
        )
        for row in name_result:
            skill_names[row.skill_id] = row.name or row.skill_id

    # Total count for pagination
    count_result = await db.execute(
        select(func.count())
        .select_from(SkillExecution)
        .where(SkillExecution.user_id == user.id)
    )
    total = count_result.scalar() or 0

    return {
        "executions": [
            {
                "id": str(e.id),
                "skill_id": e.skill_id,
                "skill_name": skill_names.get(e.skill_id, e.skill_id),
                "status": e.status,
                "input_summary": e.input_summary,
                "output_summary": e.output_summary,
                "duration_ms": e.duration_ms,
                "error_message": e.error_message,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in executions
        ],
        "total": total,
    }


@router.get("/skills/analytics")
async def get_skill_analytics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=7, le=90),
):
    """Get skill execution analytics for the dashboard."""
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total stats
    total_result = await db.execute(
        select(
            func.count(SkillExecution.id).label("total_runs"),
            func.count(case((SkillExecution.status == "success", 1))).label("success_count"),
            func.count(case((SkillExecution.status == "error", 1))).label("error_count"),
            func.avg(SkillExecution.duration_ms).label("avg_duration_ms"),
            func.sum(SkillExecution.duration_ms).label("total_duration_ms"),
        ).where(
            SkillExecution.user_id == user.id,
            SkillExecution.created_at >= since,
        )
    )
    totals = total_result.one()

    # Per-skill breakdown
    per_skill = await db.execute(
        select(
            SkillExecution.skill_id,
            func.count(SkillExecution.id).label("runs"),
            func.count(case((SkillExecution.status == "success", 1))).label("successes"),
            func.avg(SkillExecution.duration_ms).label("avg_duration"),
        ).where(
            SkillExecution.user_id == user.id,
            SkillExecution.created_at >= since,
        ).group_by(SkillExecution.skill_id)
        .order_by(func.count(SkillExecution.id).desc())
    )

    # Fetch skill names for display
    skill_ids_in_period = set()
    per_skill_rows = per_skill.all()
    for row in per_skill_rows:
        skill_ids_in_period.add(row.skill_id)

    skill_names: dict[str, str] = {}
    if skill_ids_in_period:
        name_result = await db.execute(
            select(SkillConfig.skill_id, SkillConfig.name, SkillConfig.icon).where(
                SkillConfig.user_id == user.id,
                SkillConfig.skill_id.in_(list(skill_ids_in_period)),
            )
        )
        for r in name_result:
            skill_names[r.skill_id] = r.name or r.skill_id

    return {
        "period_days": days,
        "totals": {
            "total_runs": totals.total_runs or 0,
            "success_count": totals.success_count or 0,
            "error_count": totals.error_count or 0,
            "success_rate": round(
                (totals.success_count or 0) / max(totals.total_runs or 1, 1) * 100, 1
            ),
            "avg_duration_ms": int(totals.avg_duration_ms or 0),
            "total_duration_ms": int(totals.total_duration_ms or 0),
        },
        "per_skill": [
            {
                "skill_id": row.skill_id,
                "skill_name": skill_names.get(row.skill_id, row.skill_id),
                "runs": row.runs,
                "successes": row.successes,
                "success_rate": round(row.successes / max(row.runs, 1) * 100, 1),
                "avg_duration_ms": int(row.avg_duration or 0),
            }
            for row in per_skill_rows
        ],
    }


@router.get("/skills/{skill_id}")
async def get_skill(
    skill_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details for a specific skill."""
    result = await db.execute(
        select(SkillConfig).where(
            SkillConfig.user_id == user.id,
            SkillConfig.skill_id == skill_id,
        )
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")

    stats = await _get_execution_stats(user.id, skill_id, db)
    return {"skill": _cfg_to_dict(cfg, stats)}


@router.put("/skills/{skill_id}")
async def update_skill(
    skill_id: str,
    request: SkillUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update skill configuration (enabled, autonomy_level, config, skill_md)."""
    result = await db.execute(
        select(SkillConfig).where(
            SkillConfig.user_id == user.id,
            SkillConfig.skill_id == skill_id,
        )
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")

    update_values: dict = {}
    if request.active is not None:
        update_values["active"] = request.active
    if request.autonomy_level is not None:
        if not 1 <= request.autonomy_level <= 5:
            raise HTTPException(
                status_code=422,
                detail="autonomy_level must be between 1 and 5",
            )
        update_values["autonomy_level"] = request.autonomy_level
    if request.config is not None:
        update_values["config"] = request.config
    if request.skill_md is not None:
        update_values["skill_md"] = request.skill_md
        # Also sync parsed fields from the SKILL.md
        parsed = parse_skill_md(request.skill_md)
        if parsed["name"]:
            update_values["name"] = parsed["name"]
        if parsed["description"]:
            update_values["description"] = parsed["description"]
        if parsed["instructions"]:
            update_values["system_prompt"] = parsed["instructions"]
        if parsed["parameters"]:
            update_values["parameters"] = parsed["parameters"]
    if request.category is not None:
        update_values["category"] = request.category
    if request.icon is not None:
        update_values["icon"] = request.icon
    if request.output_path is not None:
        update_values["output_path"] = request.output_path

    if update_values:
        await db.execute(
            update(SkillConfig)
            .where(SkillConfig.id == cfg.id)
            .values(**update_values)
        )
        await db.flush()

    result = await db.execute(
        select(SkillConfig).where(SkillConfig.id == cfg.id)
    )
    updated = result.scalar_one()

    return {"skill": _cfg_to_dict(updated)}


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a custom skill. Default (seeded) skills cannot be deleted."""
    result = await db.execute(
        select(SkillConfig).where(
            SkillConfig.user_id == user.id,
            SkillConfig.skill_id == skill_id,
        )
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")

    if not cfg.is_custom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default skills cannot be deleted. Disable them instead via PUT.",
        )

    await db.execute(
        delete(SkillConfig).where(SkillConfig.id == cfg.id)
    )
    await db.flush()


@router.post("/skills/{skill_id}/execute")
async def execute_skill(
    skill_id: str,
    request: SkillExecuteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a skill with the given input and parameters.
    Calls the Claude LLM with the skill's system prompt and returns the result.
    """
    result = await skill_service.execute(
        db=db,
        user_id=user.id,
        skill_id=skill_id,
        user_input=request.input,
        parameters=request.parameters,
    )

    if result["status"] == "error":
        # In-App Notification bei Skill-Fehler
        try:
            from models.notification import Notification

            error_text = result.get("error", "Unbekannter Fehler")
            notification = Notification(
                user_id=user.id,
                type="skill_error",
                title=f"Skill '{skill_id}' fehlgeschlagen",
                content=(error_text[:500] if error_text else "Unbekannter Fehler"),
                sent_channels=["in_app"],
            )
            db.add(notification)
            await db.flush()
        except Exception:
            logger.warning("Failed to create skill error notification", exc_info=True)

        # Telegram Alert bei Skill-Fehler (wenn konfiguriert)
        try:
            from services.telegram_service import telegram_service

            error_preview = result.get("error", "Unbekannter Fehler")
            if error_preview and len(error_preview) > 200:
                error_preview = error_preview[:200] + "..."
            await telegram_service.send_message_to_user(
                user_id=str(user.id),
                text=(
                    f"<b>Skill-Fehler: {skill_id}</b>\n\n"
                    f"{error_preview}"
                ),
            )
        except Exception:
            logger.warning("Failed to send skill error Telegram alert", exc_info=True)

        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Skill execution failed"),
        )

    # Create notification for successful skill execution
    try:
        from models.notification import Notification

        output_preview = result.get("output", "") or ""
        if len(output_preview) > 200:
            output_preview = output_preview[:200] + "..."

        notification = Notification(
            user_id=user.id,
            type="skill_completed",
            title=f"Skill '{skill_id}' abgeschlossen",
            content=output_preview,
        )
        db.add(notification)
        await db.commit()
    except Exception:
        logger.warning("Failed to create skill completion notification", exc_info=True)

    return {
        "execution": {
            "id": result.get("execution_id"),
            "skill_id": skill_id,
            "status": result["status"],
            "output": result["output"],
            "duration_ms": result["duration_ms"],
            "tool_calls": result.get("tool_calls", []),
        }
    }


@router.post("/skills/{skill_id}/schedule")
async def schedule_skill(
    skill_id: str,
    request: SkillScheduleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a routine that executes this skill on a cron schedule."""
    # Check skill exists
    skill_result = await db.execute(
        select(SkillConfig).where(
            SkillConfig.user_id == user.id,
            SkillConfig.skill_id == skill_id,
        )
    )
    skill = skill_result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")

    # Check if a scheduled routine already exists for this skill
    from models.routine import Routine, RoutineSkill as RoutineSkillModel
    existing_result = await db.execute(
        select(Routine)
        .join(RoutineSkillModel, RoutineSkillModel.routine_id == Routine.id)
        .where(
            Routine.user_id == user.id,
            RoutineSkillModel.skill_id == skill_id,
            Routine.is_active == True,  # noqa: E712
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Skill '{skill_id}' hat bereits eine aktive geplante Routine: '{existing.name}'",
        )

    # Create routine via routine_service
    from services.routine_service import routine_service
    routine = await routine_service.create_routine(
        db=db,
        user_id=user.id,
        name=f"Auto: {skill.name or skill_id}",
        description=request.description or f"Automatische Ausfuehrung von {skill.name or skill_id}",
        prompt=f"Fuehre den Skill '{skill_id}' aus.",
        cron_expression=request.cron_expression,
        timezone=request.timezone,
        skill_ids=[skill_id],
        max_tool_rounds=30,
    )
    await db.commit()

    return {
        "routine_id": str(routine.id),
        "name": routine.name,
        "cron": routine.cron_expression,
    }


@router.get("/skills/{skill_id}/logs")
async def get_skill_logs(
    skill_id: str,
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get execution logs for a specific skill."""
    limit = min(limit, 100)

    result = await db.execute(
        select(SkillExecution)
        .where(
            SkillExecution.user_id == user.id,
            SkillExecution.skill_id == skill_id,
        )
        .order_by(SkillExecution.created_at.desc())
        .limit(limit)
    )
    executions = list(result.scalars().all())

    return {
        "logs": [
            {
                "id": str(ex.id),
                "status": ex.status,
                "input_summary": ex.input_summary,
                "output_summary": ex.output_summary,
                "duration_ms": ex.duration_ms,
                "error_message": ex.error_message,
                "created_at": ex.created_at.isoformat() if ex.created_at else None,
            }
            for ex in executions
        ]
    }


# ──────────────────────────────────────────────
# Skill Directory Files (PostgreSQL)
# ──────────────────────────────────────────────

from models.skill_file import SkillFile


@router.get("/skills/{skill_id}/files")
async def list_skill_files(
    skill_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List files attached to a skill (stored in PostgreSQL)."""
    # Verify skill exists for this user
    result = await db.execute(
        select(SkillConfig).where(
            SkillConfig.user_id == user.id,
            SkillConfig.skill_id == skill_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")

    result = await db.execute(
        select(SkillFile)
        .where(SkillFile.user_id == user.id, SkillFile.skill_id == skill_id)
        .order_by(SkillFile.filename)
    )
    files = result.scalars().all()
    return {
        "files": [
            {
                "id": str(f.id),
                "filename": f.filename,
                "file_type": f.file_type,
                "size": len(f.content),
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            }
            for f in files
        ]
    }


class SkillFileCreateRequest(BaseModel):
    filename: str
    content: str
    file_type: str = "reference"


@router.post("/skills/{skill_id}/files")
async def upload_skill_file(
    skill_id: str,
    body: SkillFileCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update a skill file (stored in PostgreSQL)."""
    # Verify skill exists for this user
    result = await db.execute(
        select(SkillConfig).where(
            SkillConfig.user_id == user.id,
            SkillConfig.skill_id == skill_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")

    if not body.filename.strip():
        raise HTTPException(status_code=400, detail="Dateiname fehlt")

    if len(body.content) > 100 * 1024:
        raise HTTPException(status_code=400, detail="Datei zu gross (max 100KB)")

    if body.file_type not in ("template", "example", "reference"):
        raise HTTPException(status_code=400, detail="file_type muss template, example oder reference sein")

    # Count existing files for this skill
    count_result = await db.execute(
        select(func.count()).select_from(SkillFile).where(
            SkillFile.user_id == user.id, SkillFile.skill_id == skill_id
        )
    )
    file_count = count_result.scalar() or 0

    # Check if file already exists — update it
    existing = await db.execute(
        select(SkillFile).where(
            SkillFile.user_id == user.id,
            SkillFile.skill_id == skill_id,
            SkillFile.filename == body.filename,
        )
    )
    file = existing.scalar_one_or_none()

    if file:
        file.content = body.content
        file.file_type = body.file_type
    else:
        if file_count >= 20:
            raise HTTPException(status_code=400, detail="Maximal 20 Dateien pro Skill")
        file = SkillFile(
            user_id=user.id,
            skill_id=skill_id,
            filename=body.filename,
            content=body.content,
            file_type=body.file_type,
        )
        db.add(file)

    await db.commit()
    await db.refresh(file)
    return {"id": str(file.id), "filename": body.filename, "size": len(body.content)}


@router.get("/skills/{skill_id}/files/{file_id}")
async def get_skill_file(
    skill_id: str,
    file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single skill file with its content."""
    import uuid as uuid_mod

    result = await db.execute(
        select(SkillFile).where(
            SkillFile.id == uuid_mod.UUID(file_id),
            SkillFile.user_id == user.id,
            SkillFile.skill_id == skill_id,
        )
    )
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")

    return {
        "id": str(file.id),
        "filename": file.filename,
        "content": file.content,
        "file_type": file.file_type,
        "size": len(file.content),
        "updated_at": file.updated_at.isoformat() if file.updated_at else None,
    }


@router.delete("/skills/{skill_id}/files/{file_id}")
async def delete_skill_file(
    skill_id: str,
    file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a skill file."""
    import uuid as uuid_mod

    result = await db.execute(
        select(SkillFile).where(
            SkillFile.id == uuid_mod.UUID(file_id),
            SkillFile.user_id == user.id,
        )
    )
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    await db.delete(file)
    await db.commit()
    return {"deleted": True}
