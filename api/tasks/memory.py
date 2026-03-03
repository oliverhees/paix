"""Memory Tasks — background jobs for Graphiti Knowledge Graph updates."""

import asyncio

from celery_app import celery


def _run_async(coro):
    """Helper to run async code in Celery (sync) workers."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery.task(name="tasks.memory.update_memory_after_chat")
def update_memory_after_chat(session_id: str):
    """
    After each chat session: Extract relevant information and store in Graphiti.
    This runs asynchronously to not block the chat response.
    """
    _run_async(_update_memory_after_chat_async(session_id))


async def _update_memory_after_chat_async(session_id: str):
    """Async implementation of post-chat memory update."""
    import uuid

    from sqlalchemy import select

    from models.database import async_session
    from models.session import ChatMessage
    from services.graphiti_service import graphiti_service
    from services.llm_service import llm_service

    try:
        async with async_session() as db:
            # Get recent messages from this session
            result = await db.execute(
                select(ChatMessage)
                .where(ChatMessage.session_id == uuid.UUID(session_id))
                .order_by(ChatMessage.created_at.desc())
                .limit(10)
            )
            messages = list(result.scalars().all())
            messages.reverse()

        if not messages:
            return

        # Combine messages into conversation text
        conversation_parts = []
        for msg in messages:
            prefix = "User" if msg.role == "user" else "Assistant"
            conversation_parts.append(f"{prefix}: {msg.content}")
        conversation = "\n".join(conversation_parts)

        # Use LLM to extract key facts/entities
        try:
            extraction = await llm_service.complete(
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "Extrahiere die wichtigsten Fakten, Personen, Projekte und "
                            "Aufgaben aus diesem Gespraech. Antworte als stichpunktartige Liste.\n\n"
                            f"{conversation}"
                        ),
                    }
                ],
                system_prompt=(
                    "Du bist ein Informationsextractor. Extrahiere nur explizit "
                    "genannte Fakten. Erfinde nichts."
                ),
                max_tokens=500,
                temperature=0.0,
            )
        except Exception:
            extraction = ""

        # Store as episode in Graphiti
        user_messages = [m.content for m in messages if m.role == "user"]
        assistant_messages = [m.content for m in messages if m.role == "assistant"]

        await graphiti_service.add_episode(
            user_message="\n".join(user_messages),
            assistant_response="\n".join(assistant_messages),
            session_id=session_id,
            skill_used=messages[-1].skill_used if messages else None,
        )

    except Exception:
        # Memory updates should never crash
        pass
