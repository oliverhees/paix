"""Calendar Endpoints — events, upcoming, and daily briefing generation."""

import random
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from models.database import get_db
from models.user import User
from services.calendar_service import calendar_service
from services.graphiti_service import graphiti_service
from services.llm_service import llm_service, get_user_anthropic_key

router = APIRouter()


@router.get("/calendar/today")
async def get_today_events(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all calendar events for today.
    Enriches each event with Graphiti context (person info, last meeting, open items).
    """
    user_id = str(user.id)
    events = await calendar_service.get_events_today(user_id)

    event_dicts = []
    for ev in events:
        ev_dict = ev.model_dump()

        # Enrich with Graphiti context for participants
        context: dict = {}
        for participant in ev.participants:
            if participant.name:
                try:
                    results = await graphiti_service.search(
                        query=participant.name, limit=1
                    )
                    if results:
                        node = results[0]
                        context["person_notes"] = node.get("summary", "")
                except Exception:
                    pass
        ev_dict["context"] = context if context else None
        event_dicts.append(ev_dict)

    return {
        "events": event_dicts,
        "date": date.today().isoformat(),
    }


@router.get("/calendar/upcoming")
async def get_upcoming_events(
    days: int = 7,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get upcoming calendar events for the next N days.
    Default: 7 days, max: 30 days.
    """
    days = min(max(days, 1), 30)
    user_id = str(user.id)
    events = await calendar_service.get_upcoming_events(user_id, days)

    return {
        "events": [ev.model_dump() for ev in events],
        "days": days,
    }


@router.get("/calendar/briefing")
async def get_daily_briefing(
    date_str: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a daily briefing for the given date.
    Combines: calendar events + TELOS goals + open items + idea of the day.
    Used both interactively and by the n8n cron job.
    """
    user_id = str(user.id)
    target_date = date_str or date.today().isoformat()

    # 1. Calendar events for today
    events = await calendar_service.get_events_today(user_id)
    events_list = [
        {
            "title": ev.title,
            "start": ev.start.isoformat() if ev.start else "",
            "end": ev.end.isoformat() if ev.end else "",
            "participants": [p.model_dump() for p in ev.participants],
            "location": ev.location,
        }
        for ev in events
    ]

    # 2. TELOS goals
    priorities: list[dict] = []
    try:
        goals_data = await graphiti_service.get_telos_dimension(user_id, "goals")
        for entry in goals_data.get("entries", [])[:5]:
            priorities.append({
                "text": entry.get("content", ""),
                "source": "TELOS.GOALS",
            })
    except Exception:
        pass

    # 3. Open items (search for tasks/action items)
    open_items: list[dict] = []
    try:
        task_results = await graphiti_service.search(
            query="offene aufgaben tasks action items", limit=5
        )
        for r in task_results:
            open_items.append({
                "text": r.get("name", r.get("content", "")),
                "due": r.get("due_date", ""),
                "from_meeting": r.get("meeting_id", ""),
            })
    except Exception:
        pass

    # 4. Idea of the day (random idea from TELOS.IDEAS)
    idea_of_the_day = None
    try:
        ideas_data = await graphiti_service.get_telos_dimension(user_id, "ideas")
        ideas = ideas_data.get("entries", [])
        if ideas:
            chosen = random.choice(ideas)
            idea_of_the_day = {
                "content": chosen.get("content", ""),
                "created_at": chosen.get("created_at", ""),
            }
    except Exception:
        pass

    # 5. Compose briefing via LLM
    greeting = "Guten Morgen."
    try:
        user_api_key = await get_user_anthropic_key(user.id, db)
        briefing_prompt = (
            "Erstelle ein kurzes, strukturiertes Tages-Briefing auf Deutsch. "
            "Sei freundlich und konkret. Nutze folgende Informationen:\n\n"
            f"Datum: {target_date}\n"
            f"Termine heute: {events_list}\n"
            f"Prioritaeten: {priorities}\n"
            f"Offene Aufgaben: {open_items}\n"
            f"Idee des Tages: {idea_of_the_day}\n\n"
            "Formatiere als: Begruessung, dann Termine, dann Prioritaeten, "
            "dann offene Aufgaben, dann Idee des Tages. Halte es unter 200 Woerter."
        )
        greeting = await llm_service.complete(
            messages=[{"role": "user", "content": briefing_prompt}],
            system_prompt="Du bist PAIONE, ein persoenlicher AI-Assistent. Erstelle praegnante Briefings.",
            max_tokens=500,
            api_key=user_api_key,
        )
    except Exception:
        greeting = f"Guten Morgen. Heute ist der {target_date}."

    return {
        "briefing": {
            "date": target_date,
            "greeting": greeting,
            "events": events_list,
            "priorities": priorities,
            "open_items": open_items,
            "idea_of_the_day": idea_of_the_day,
        }
    }
