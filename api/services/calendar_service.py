"""Calendar Service — Google Calendar integration."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel

from config import settings


class CalendarParticipant(BaseModel):
    name: str = ""
    email: str = ""


class CalendarEvent(BaseModel):
    id: str
    title: str
    start: datetime
    end: datetime
    participants: list[CalendarParticipant] = []
    location: str | None = None
    context: dict[str, Any] | None = None


class CreateEventRequest(BaseModel):
    title: str
    start: datetime
    end: datetime
    participants: list[CalendarParticipant] = []
    location: str | None = None
    description: str | None = None


class CalendarService:
    """
    Google Calendar integration.
    Loads OAuth tokens from the integration_tokens table.
    Falls back gracefully when Google is not configured or reachable.
    """

    async def _get_calendar_service(self, user_id: str) -> Any | None:
        """
        Build a Google Calendar API service from stored OAuth tokens.
        Returns None if tokens are not available or Google libs are missing.
        """
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            from models.database import async_session
            from models.integration import IntegrationToken
            from sqlalchemy import select

            async with async_session() as db:
                result = await db.execute(
                    select(IntegrationToken).where(
                        IntegrationToken.user_id == uuid.UUID(user_id),
                        IntegrationToken.provider == "google",
                    )
                )
                token_row = result.scalar_one_or_none()

            if token_row is None:
                return None

            creds = Credentials(
                token=token_row.access_token,
                refresh_token=token_row.refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.google_client_id,
                client_secret=settings.google_client_secret,
            )
            service = build("calendar", "v3", credentials=creds)
            return service
        except Exception:
            return None

    async def get_events_today(self, user_id: str) -> list[CalendarEvent]:
        """Get all calendar events for today."""
        now = datetime.now(timezone.utc)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        return await self._fetch_events(user_id, start_of_day, end_of_day)

    async def get_upcoming_events(
        self, user_id: str, days: int = 7
    ) -> list[CalendarEvent]:
        """Get upcoming events for the next N days."""
        now = datetime.now(timezone.utc)
        end = now + timedelta(days=days)
        return await self._fetch_events(user_id, now, end)

    async def _fetch_events(
        self, user_id: str, time_min: datetime, time_max: datetime
    ) -> list[CalendarEvent]:
        """Fetch events from Google Calendar within a time range."""
        service = await self._get_calendar_service(user_id)
        if service is None:
            # Graceful degradation: return empty if not configured
            return []

        try:
            events_result = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=time_min.isoformat(),
                    timeMax=time_max.isoformat(),
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )

            events = []
            for item in events_result.get("items", []):
                start_raw = item.get("start", {})
                end_raw = item.get("end", {})

                start_str = start_raw.get("dateTime", start_raw.get("date", ""))
                end_str = end_raw.get("dateTime", end_raw.get("date", ""))

                participants = [
                    CalendarParticipant(
                        name=a.get("displayName", ""),
                        email=a.get("email", ""),
                    )
                    for a in item.get("attendees", [])
                ]

                events.append(
                    CalendarEvent(
                        id=item.get("id", ""),
                        title=item.get("summary", "Untitled"),
                        start=datetime.fromisoformat(start_str) if start_str else time_min,
                        end=datetime.fromisoformat(end_str) if end_str else time_max,
                        participants=participants,
                        location=item.get("location"),
                    )
                )
            return events
        except Exception:
            return []

    async def create_event(
        self, user_id: str, event: CreateEventRequest
    ) -> CalendarEvent | None:
        """Create a new calendar event."""
        service = await self._get_calendar_service(user_id)
        if service is None:
            return None

        try:
            body = {
                "summary": event.title,
                "start": {"dateTime": event.start.isoformat()},
                "end": {"dateTime": event.end.isoformat()},
                "attendees": [
                    {"email": p.email, "displayName": p.name}
                    for p in event.participants
                ],
            }
            if event.location:
                body["location"] = event.location
            if event.description:
                body["description"] = event.description

            created = service.events().insert(calendarId="primary", body=body).execute()
            return CalendarEvent(
                id=created["id"],
                title=created.get("summary", event.title),
                start=event.start,
                end=event.end,
                participants=event.participants,
                location=event.location,
            )
        except Exception:
            return None

    async def update_event(
        self, user_id: str, event_id: str, updates: dict
    ) -> CalendarEvent | None:
        """Update an existing calendar event."""
        service = await self._get_calendar_service(user_id)
        if service is None:
            return None

        try:
            existing = (
                service.events()
                .get(calendarId="primary", eventId=event_id)
                .execute()
            )

            if "title" in updates:
                existing["summary"] = updates["title"]
            if "start" in updates:
                existing["start"] = {"dateTime": updates["start"]}
            if "end" in updates:
                existing["end"] = {"dateTime": updates["end"]}
            if "location" in updates:
                existing["location"] = updates["location"]

            updated = (
                service.events()
                .update(calendarId="primary", eventId=event_id, body=existing)
                .execute()
            )

            start_raw = updated.get("start", {})
            end_raw = updated.get("end", {})

            return CalendarEvent(
                id=updated["id"],
                title=updated.get("summary", ""),
                start=datetime.fromisoformat(
                    start_raw.get("dateTime", start_raw.get("date", ""))
                ),
                end=datetime.fromisoformat(
                    end_raw.get("dateTime", end_raw.get("date", ""))
                ),
                location=updated.get("location"),
            )
        except Exception:
            return None


# Singleton
calendar_service = CalendarService()
