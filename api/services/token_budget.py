"""Token Budget System — enforces context layer budgets."""

import logging

logger = logging.getLogger(__name__)

# Budget per layer (in tokens)
BUDGETS = {
    "temporal": 50,
    "persona": 1500,
    "telos": 1000,
    "graphiti": 3000,
    "working": 20000,
}

TOTAL_OVERHEAD = sum(v for k, v in BUDGETS.items() if k != "working")


def estimate_tokens(text: str) -> int:
    """Fast token estimation: ~4 chars/token EN, ~3.5 DE.
    Uses 3.75 as average for mixed content."""
    if not text:
        return 0
    return max(1, len(text) // 4)  # Conservative: 4 chars per token


def truncate_to_budget(text: str, budget_name: str, custom_budget: int | None = None) -> str:
    """Truncate text to fit within its token budget."""
    budget = custom_budget or BUDGETS.get(budget_name, 1000)
    estimated = estimate_tokens(text)

    if estimated <= budget:
        return text

    # Truncate: budget * 4 chars (reverse of estimation)
    max_chars = budget * 4
    truncated = text[:max_chars]

    # Try to break at a sentence or newline
    last_newline = truncated.rfind("\n", max_chars - 200)
    if last_newline > max_chars // 2:
        truncated = truncated[:last_newline]

    logger.info(
        "Token budget '%s': truncated from %d to %d tokens (budget: %d)",
        budget_name, estimated, estimate_tokens(truncated), budget,
    )
    return truncated + f"\n\n[... gekuerzt auf {budget} Token Budget]"


def get_budget_report(layers: dict[str, str]) -> dict:
    """Generate a budget usage report."""
    report = {}
    total_used = 0
    for name, text in layers.items():
        budget = BUDGETS.get(name, 0)
        used = estimate_tokens(text)
        report[name] = {
            "budget": budget,
            "used": used,
            "remaining": max(0, budget - used),
            "over_budget": used > budget,
        }
        total_used += used
    report["_total"] = {
        "budget": sum(BUDGETS.values()),
        "used": total_used,
    }
    return report
