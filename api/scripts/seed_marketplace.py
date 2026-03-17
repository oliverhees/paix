"""Seed the marketplace with initial skills and werkzeuge.

Usage:
    python -m scripts.seed_marketplace
    # or from api/ directory:
    python scripts/seed_marketplace.py
"""

import asyncio
import sys
import os

# Ensure api/ is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from models.database import async_session
from models.marketplace import MarketplaceItem


SEED_ITEMS: list[dict] = [
    # ── Skills ──────────────────────────────────────────────
    {
        "type": "skill",
        "slug": "taegliches-ki-briefing",
        "name": "Tägliches KI-Briefing",
        "description": "Automatisches KI-News Briefing jeden Morgen. Recherchiert die wichtigsten Entwicklungen in der KI-Welt und fasst sie kompakt zusammen.",
        "category": "research",
        "icon": "📊",
        "featured": True,
        "version": "1.0.0",
        "skill_md": """---
name: Tägliches KI-Briefing
description: Recherchiert die wichtigsten KI-News und erstellt ein kompaktes Briefing.
category: research
trigger: Jeden Morgen automatisch oder auf Anfrage
---

# Tägliches KI-Briefing

Du recherchierst die wichtigsten KI-Entwicklungen und erstellst ein strukturiertes Briefing.

## Aufgaben
1. Recherchiere aktuelle KI-News der letzten 24 Stunden
2. Identifiziere die 5 wichtigsten Entwicklungen
3. Fasse jede Entwicklung in 2-3 Sätzen zusammen
4. Bewerte die Relevanz für den User

## Output-Format
- Überschrift mit Datum
- Top 5 News mit Kurzbeschreibung
- Relevanz-Einschätzung
- Handlungsempfehlung falls relevant
""",
    },
    {
        "type": "skill",
        "slug": "content-pipeline",
        "name": "Content Pipeline",
        "description": "Erstelle professionelle LinkedIn-Posts und Blog-Artikel. Von der Ideenfindung bis zum fertigen Text.",
        "category": "writing",
        "icon": "✍️",
        "featured": False,
        "version": "1.0.0",
        "skill_md": """---
name: Content Pipeline
description: Erstellt LinkedIn-Posts und Blog-Artikel von der Idee bis zum fertigen Text.
category: writing
trigger: Auf Anfrage
---

# Content Pipeline

Du hilfst beim Erstellen von professionellen Social-Media-Posts und Blog-Artikeln.

## Workflow
1. Thema und Zielgruppe klären
2. Kernbotschaft definieren
3. Struktur erstellen
4. Text schreiben
5. Optimieren und finalisieren

## Formate
- LinkedIn Post (kurz, mit Hook)
- Blog-Artikel (lang, strukturiert)
- Twitter/X Thread
""",
    },
    {
        "type": "skill",
        "slug": "meeting-vorbereitung",
        "name": "Meeting-Vorbereitung",
        "description": "Bereite dich optimal auf Meetings vor. Agenda erstellen, Teilnehmer recherchieren, Notizen strukturieren.",
        "category": "productivity",
        "icon": "🤝",
        "featured": False,
        "version": "1.0.0",
        "skill_md": """---
name: Meeting-Vorbereitung
description: Erstellt Agenda, recherchiert Teilnehmer und strukturiert Notizen.
category: productivity
trigger: Vor jedem Meeting
---

# Meeting-Vorbereitung

Du bereitest Meetings professionell vor.

## Aufgaben
1. Agenda aus Einladung und Kontext erstellen
2. Teilnehmer-Profile zusammenstellen
3. Relevante Dokumente sammeln
4. Fragen und Diskussionspunkte vorbereiten
5. Notiz-Template erstellen
""",
    },
    {
        "type": "skill",
        "slug": "follow-up-manager",
        "name": "Follow-Up Manager",
        "description": "Verfolge offene Aufgaben und Zusagen nach. Erinnere an Deadlines und ausstehende Antworten.",
        "category": "communication",
        "icon": "📩",
        "featured": False,
        "version": "1.0.0",
        "skill_md": """---
name: Follow-Up Manager
description: Verfolgt offene Aufgaben und erinnert an ausstehende Antworten.
category: communication
trigger: Täglich oder auf Anfrage
---

# Follow-Up Manager

Du behältst den Überblick über offene Aufgaben und Zusagen.

## Aufgaben
1. Offene To-Dos identifizieren
2. Ausstehende Antworten tracken
3. Erinnerungen setzen
4. Follow-Up Nachrichten vorschlagen
""",
    },
    {
        "type": "skill",
        "slug": "ideen-sammler",
        "name": "Ideen-Sammler",
        "description": "Erfasse, strukturiere und bewerte Ideen systematisch. Von der spontanen Eingebung zum bewerteten Konzept.",
        "category": "creativity",
        "icon": "💡",
        "featured": False,
        "version": "1.0.0",
        "skill_md": """---
name: Ideen-Sammler
description: Erfasst und bewertet Ideen systematisch.
category: creativity
trigger: Auf Anfrage
---

# Ideen-Sammler

Du hilfst beim systematischen Erfassen und Bewerten von Ideen.

## Workflow
1. Idee erfassen (Titel, Beschreibung, Kontext)
2. Kategorisieren (Produkt, Marketing, Prozess, etc.)
3. Bewerten (Impact, Aufwand, Dringlichkeit)
4. Priorisieren und nächste Schritte definieren
""",
    },

    # ── Werkzeuge (MCP) ─────────────────────────────────────
    {
        "type": "werkzeug",
        "slug": "ghost-cms",
        "name": "Ghost CMS",
        "description": "Verwalte deinen Ghost Blog direkt aus dem Chat. Beiträge erstellen, bearbeiten und veröffentlichen.",
        "category": "content",
        "icon": "👻",
        "featured": True,
        "version": "1.0.0",
        "address": "npx -y @anthropic/ghost-mcp",
        "requirements": {"GHOST_URL": "URL deiner Ghost-Instanz", "GHOST_ADMIN_API_KEY": "Admin API Key"},
        "hint": "Erstelle einen Admin API Key unter Ghost Admin > Settings > Integrations.",
    },
    {
        "type": "werkzeug",
        "slug": "github",
        "name": "GitHub",
        "description": "Verwalte GitHub Repositories, Issues und Pull Requests direkt im Chat.",
        "category": "development",
        "icon": "🐙",
        "featured": False,
        "version": "1.0.0",
        "address": "npx -y @modelcontextprotocol/server-github",
        "requirements": {"GITHUB_PERSONAL_ACCESS_TOKEN": "Personal Access Token mit repo Scope"},
        "hint": "Erstelle einen Token unter github.com/settings/tokens mit den benötigten Berechtigungen.",
    },
    {
        "type": "werkzeug",
        "slug": "slack",
        "name": "Slack",
        "description": "Sende und empfange Slack-Nachrichten, verwalte Kanäle und reagiere auf Mentions.",
        "category": "communication",
        "icon": "💬",
        "featured": False,
        "version": "1.0.0",
        "address": "npx -y @anthropic/slack-mcp",
        "requirements": {"SLACK_BOT_TOKEN": "Bot User OAuth Token (xoxb-...)", "SLACK_TEAM_ID": "Workspace ID"},
        "hint": "Erstelle eine Slack App unter api.slack.com/apps und installiere sie in deinem Workspace.",
    },
    {
        "type": "werkzeug",
        "slug": "google-drive",
        "name": "Google Drive",
        "description": "Greife auf Google Drive Dateien zu. Suche, lese und organisiere Dokumente.",
        "category": "productivity",
        "icon": "📁",
        "featured": False,
        "version": "1.0.0",
        "address": "npx -y @anthropic/gdrive-mcp",
        "requirements": {"GDRIVE_CREDENTIALS": "OAuth2 Credentials JSON"},
        "hint": "Erstelle OAuth2 Credentials in der Google Cloud Console und autorisiere den Zugriff.",
    },
    {
        "type": "werkzeug",
        "slug": "brave-search",
        "name": "Brave Search",
        "description": "Durchsuche das Web mit der Brave Search API. Datenschutzfreundliche Websuche.",
        "category": "research",
        "icon": "🔍",
        "featured": False,
        "version": "1.0.0",
        "address": "npx -y @modelcontextprotocol/server-brave-search",
        "requirements": {"BRAVE_API_KEY": "Brave Search API Key"},
        "hint": "Registriere dich unter brave.com/search/api für einen kostenlosen API Key.",
    },
]


async def seed_marketplace():
    """Insert marketplace items, skipping any that already exist (by slug)."""
    async with async_session() as session:
        inserted = 0
        skipped = 0

        for item_data in SEED_ITEMS:
            # Check if already exists
            existing = await session.execute(
                select(MarketplaceItem).where(MarketplaceItem.slug == item_data["slug"])
            )
            if existing.scalar_one_or_none() is not None:
                skipped += 1
                continue

            item = MarketplaceItem(**item_data)
            session.add(item)
            inserted += 1

        await session.commit()
        print(f"Marketplace seeded: {inserted} inserted, {skipped} skipped (already exist).")


if __name__ == "__main__":
    asyncio.run(seed_marketplace())
