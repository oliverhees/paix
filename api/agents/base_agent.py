"""Base Agent — LangGraph foundation for all PAI-X agents.

Graph Structure:
1. CONTEXT NODE: Load TELOS + Memory based on the request
2. CLASSIFY NODE: Recognize intent (Chat, Calendar, Skill-Trigger)
3. EXECUTE NODE: Call LLM with full context
4. MEMORY NODE: Store relevant information from the response in Graphiti
"""

import re
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from services.graphiti_service import graphiti_service
from services.llm_service import llm_service


class AgentState(TypedDict):
    """State that flows through the agent graph."""

    # Input
    user_message: str
    session_id: str | None
    user_id: str | None

    # Context (enriched during processing)
    telos_context: dict[str, Any] | None
    memory_context: list[dict[str, Any]] | None
    calendar_context: list[dict[str, Any]] | None

    # Processing
    intent: str | None
    skill: str | None

    # Output
    response: str | None
    sources: list[dict[str, Any]] | None
    error: str | None


# ──────────────────────────────────────────────
# Intent patterns for classification
# ──────────────────────────────────────────────

INTENT_PATTERNS: dict[str, list[str]] = {
    "calendar_query": [
        r"termin",
        r"kalender",
        r"meeting",
        r"morgen.*an",
        r"heute.*an",
        r"woche.*an",
        r"calendar",
        r"briefing",
        r"was steht.*an",
    ],
    "telos_query": [
        r"ziel",
        r"goal",
        r"telos",
        r"mission",
        r"strategie",
        r"projekt.*status",
        r"herausforderung",
        r"idee",
    ],
    "memory_query": [
        r"erinnerst.*du.*dich",
        r"wer ist",
        r"wann.*getroffen",
        r"letztes.*meeting",
        r"letztes.*gespraech",
        r"was weisst.*ueber",
        r"kontakt",
    ],
    "skill_trigger": [
        r"content.*erstellen",
        r"linkedin.*post",
        r"blog.*schreiben",
        r"follow.*up",
        r"angebot.*erstellen",
    ],
}


class BaseAgent:
    """
    Base agent using LangGraph for stateful workflow orchestration.

    Flow:
    1. classify_intent -- Determine what the user wants
    2. enrich_context -- Load relevant memory and TELOS context
    3. execute_skill -- Run the skill with full context
    4. generate_response -- Create the final response
    5. update_memory -- Store the conversation episode

    Subclasses can override individual nodes or add new ones.
    """

    def __init__(self) -> None:
        self.graph = self._build_graph()

    def _build_graph(self) -> Any:
        """Build the LangGraph workflow."""
        workflow = StateGraph(AgentState)

        # Add nodes
        workflow.add_node("classify_intent", self.classify_intent)
        workflow.add_node("enrich_context", self.enrich_context)
        workflow.add_node("execute_skill", self.execute_skill)
        workflow.add_node("generate_response", self.generate_response)
        workflow.add_node("update_memory", self.update_memory)

        # Define edges
        workflow.set_entry_point("classify_intent")
        workflow.add_edge("classify_intent", "enrich_context")
        workflow.add_edge("enrich_context", "execute_skill")
        workflow.add_edge("execute_skill", "generate_response")
        workflow.add_edge("generate_response", "update_memory")
        workflow.add_edge("update_memory", END)

        return workflow.compile()

    async def classify_intent(self, state: AgentState) -> dict:
        """
        Classify the user's intent from their message.
        Uses keyword matching first, then LLM classification as fallback.
        """
        message = state["user_message"].lower()

        # Pattern-based classification
        for intent, patterns in INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, message, re.IGNORECASE):
                    return {"intent": intent, "skill": intent}

        # LLM-based classification for ambiguous messages
        try:
            classification = await llm_service.complete(
                messages=[{"role": "user", "content": state["user_message"]}],
                system_prompt=(
                    "Classify the user's intent into exactly one of: "
                    "general_chat, calendar_query, telos_query, memory_query, skill_trigger. "
                    "Respond with ONLY the intent name, nothing else."
                ),
                max_tokens=20,
                temperature=0.0,
            )
            intent = classification.strip().lower()
            valid_intents = {
                "general_chat",
                "calendar_query",
                "telos_query",
                "memory_query",
                "skill_trigger",
            }
            if intent in valid_intents:
                return {"intent": intent, "skill": intent if intent != "general_chat" else None}
        except Exception:
            pass

        return {"intent": "general_chat", "skill": None}

    async def enrich_context(self, state: AgentState) -> dict:
        """
        Enrich the state with relevant context from Graphiti and TELOS.
        Runs semantic search and loads the user's identity context.
        """
        user_id = state.get("user_id") or ""
        message = state["user_message"]

        telos_context: dict[str, Any] = {}
        memory_context: list[dict[str, Any]] = []
        calendar_context: list[dict[str, Any]] = []

        # Load TELOS context
        try:
            for dimension in ["mission", "goals", "projects", "challenges"]:
                data = await graphiti_service.get_telos_dimension(user_id, dimension)
                entries = data.get("entries", [])
                if entries:
                    telos_context[dimension] = [
                        e.get("content", "") for e in entries[:3]
                    ]
        except Exception:
            pass

        # Semantic search for memory context
        try:
            results = await graphiti_service.search(query=message, limit=5)
            memory_context = results
        except Exception:
            pass

        # Calendar context if intent is calendar-related
        if state.get("intent") in ("calendar_query", "general_chat"):
            try:
                from services.calendar_service import calendar_service

                events = await calendar_service.get_events_today(user_id)
                calendar_context = [
                    {
                        "title": ev.title,
                        "start": ev.start.isoformat() if ev.start else "",
                        "end": ev.end.isoformat() if ev.end else "",
                        "location": ev.location or "",
                    }
                    for ev in events
                ]
            except Exception:
                pass

        return {
            "telos_context": telos_context,
            "memory_context": memory_context,
            "calendar_context": calendar_context,
        }

    async def execute_skill(self, state: AgentState) -> dict:
        """
        Execute the identified skill with the enriched context.
        Falls back to general chat if no specific skill is matched.
        """
        # In the MVP, skill execution is handled by the LLM in generate_response
        # Future: Route to specific skill handlers
        return {}

    async def generate_response(self, state: AgentState) -> dict:
        """
        Generate the final response using the LLM with full context.
        Builds a system prompt from TELOS + Memory + Calendar context.
        """
        # Build system prompt
        system_parts = [
            "Du bist PAI-X, ein persoenlicher AI-Assistent. "
            "Du sprichst Deutsch, bist praezise, freundlich und proaktiv. "
            "Du kennst den Nutzer und hilfst ihm bei allen Anliegen.",
        ]

        telos = state.get("telos_context") or {}
        if telos:
            system_parts.append("\n--- TELOS-Profil des Nutzers ---")
            for dim, entries in telos.items():
                if entries:
                    system_parts.append(f"{dim.upper()}: " + " | ".join(entries))

        memory = state.get("memory_context") or []
        if memory:
            system_parts.append("\n--- Relevanter Kontext aus dem Gedaechtnis ---")
            for item in memory[:5]:
                name = item.get("name", item.get("title", ""))
                summary = item.get("summary", item.get("content", ""))
                if name or summary:
                    system_parts.append(f"- {name}: {summary}")

        cal = state.get("calendar_context") or []
        if cal:
            system_parts.append("\n--- Heutige Termine ---")
            for ev in cal:
                system_parts.append(
                    f"- {ev.get('start', '')} {ev.get('title', '')} ({ev.get('location', '')})"
                )

        system_prompt = "\n".join(system_parts)

        # Build messages
        messages = [{"role": "user", "content": state["user_message"]}]

        sources: list[dict] = []
        if memory:
            sources = [
                {
                    "node_id": m.get("id", ""),
                    "type": m.get("type", ""),
                    "name": m.get("name", ""),
                }
                for m in memory[:3]
            ]

        try:
            response = await llm_service.complete(
                messages=messages,
                system_prompt=system_prompt,
            )
            return {"response": response, "sources": sources}
        except Exception as exc:
            return {
                "response": "Entschuldigung, ich konnte deine Anfrage gerade nicht verarbeiten.",
                "sources": [],
                "error": str(exc),
            }

    async def update_memory(self, state: AgentState) -> dict:
        """
        Store the conversation episode in Graphiti.
        Runs asynchronously — errors are logged but not propagated.
        """
        try:
            if state.get("response") and state.get("user_message"):
                await graphiti_service.add_episode(
                    user_message=state["user_message"],
                    assistant_response=state["response"] or "",
                    session_id=state.get("session_id") or "",
                    skill_used=state.get("skill"),
                )
        except Exception:
            # Memory update failures should not affect the response
            pass
        return {}

    async def run(
        self,
        message: str,
        session_id: str | None = None,
        user_id: str | None = None,
    ) -> AgentState:
        """Run the agent with a user message."""
        initial_state: AgentState = {
            "user_message": message,
            "session_id": session_id,
            "user_id": user_id,
            "telos_context": None,
            "memory_context": None,
            "calendar_context": None,
            "intent": None,
            "skill": None,
            "response": None,
            "sources": None,
            "error": None,
        }
        result = await self.graph.ainvoke(initial_state)
        return result


# Singleton
base_agent = BaseAgent()
