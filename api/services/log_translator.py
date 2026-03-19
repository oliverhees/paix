"""Translate technical skill/tool names to human-readable German."""

TRANSLATIONS = {
    "web_search": "Websuche",
    "web_fetch": "Webseite abrufen",
    "storage_write": "Datei speichern",
    "storage_read": "Datei lesen",
    "storage_list": "Dateien auflisten",
    "storage_delete": "Datei loeschen",
    "create_artifact": "Dokument erstellen",
    "call_skill": "Skill aufrufen",
    "calendar_briefing": "Kalender-Briefing",
    "content_pipeline": "Content Pipeline",
    "meeting_prep": "Meeting-Vorbereitung",
    "follow_up": "Follow-Up",
    "idea_capture": "Ideen erfassen",
    "mcp__ghost-cms__posts_add": "Ghost: Artikel erstellen",
    "mcp__ghost-cms__posts_edit": "Ghost: Artikel bearbeiten",
    "mcp__ghost-cms__posts_browse": "Ghost: Artikel suchen",
    "mcp__ghost-cms__tags_browse": "Ghost: Tags suchen",
}

STATUS_TRANSLATIONS = {
    "success": "Erfolgreich",
    "completed": "Abgeschlossen",
    "error": "Fehler",
    "failed": "Fehlgeschlagen",
    "running": "Laeuft...",
    "pending": "Wartend",
}


def translate_tool(tool_name: str) -> str:
    """Translate a tool name to human-readable German."""
    if tool_name in TRANSLATIONS:
        return TRANSLATIONS[tool_name]
    # MCP tools: mcp__server-name__action
    if tool_name.startswith("mcp__"):
        parts = tool_name.split("__")
        if len(parts) >= 3:
            server = parts[1].replace("-", " ").title()
            action = "__".join(parts[2:]).replace("_", " ").title()
            return f"{server}: {action}"
    # API tools: api__service__action
    if tool_name.startswith("api__"):
        parts = tool_name.split("__")
        if len(parts) >= 3:
            return f"API: {parts[1]} — {parts[2]}"
    # Fallback: replace underscores, title-case
    return tool_name.replace("_", " ").title()


def translate_status(status: str) -> str:
    """Translate a status string to human-readable German."""
    return STATUS_TRANSLATIONS.get(status, status)
