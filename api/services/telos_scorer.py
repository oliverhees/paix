"""TELOS Keyword Scorer — loads only relevant dimensions per message."""

import logging
import re

logger = logging.getLogger(__name__)

# Stop words for DE + EN
STOP_WORDS_DE = {
    "und", "oder", "der", "die", "das", "ein", "eine", "ist", "sind", "hat", "haben",
    "wird", "werden", "kann", "mit", "auf", "fuer", "von", "zu", "in", "an", "ab",
    "ich", "du", "er", "sie", "es", "wir", "ihr", "mein", "dein", "sein", "nicht",
    "auch", "aber", "noch", "schon", "wie", "was", "wer", "wo", "wann", "warum",
    "dass", "wenn", "dann", "nur", "mal", "hier", "dort", "sehr", "mehr", "als",
}

STOP_WORDS_EN = {
    "the", "a", "an", "is", "are", "was", "were", "has", "have", "had", "been",
    "will", "would", "can", "could", "should", "may", "might", "must", "do", "does",
    "did", "i", "you", "he", "she", "it", "we", "they", "my", "your", "his", "her",
    "its", "our", "their", "this", "that", "these", "those", "what", "which", "who",
    "how", "when", "where", "why", "not", "no", "but", "and", "or", "if", "then",
    "than", "so", "just", "very", "too", "also", "more", "most", "some", "any",
}

STOP_WORDS = STOP_WORDS_DE | STOP_WORDS_EN

# Fallback dimensions if no match
FALLBACK_DIMENSIONS = ["mission", "goals"]

# All TELOS dimensions
TELOS_DIMENSIONS = [
    "mission", "goals", "projects", "beliefs", "models",
    "strategies", "narratives", "learned", "challenges", "ideas",
]


def extract_keywords(text: str) -> set[str]:
    """Extract meaningful keywords from text (lowercase, no stop words)."""
    words = re.findall(r'\b[a-zA-Z\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df]{3,}\b', text.lower())
    return {w for w in words if w not in STOP_WORDS}


def score_dimensions(
    message: str,
    dimensions: dict[str, str],
    budget_tokens: int = 1000,
) -> str:
    """Score TELOS dimensions against message and return top matches within budget."""
    if not dimensions or not message:
        return ""

    message_keywords = extract_keywords(message)
    if not message_keywords:
        return _build_fallback(dimensions, budget_tokens)

    # Score each dimension
    scores: list[tuple[str, float, str]] = []
    for dim_name, dim_content in dimensions.items():
        dim_keywords = extract_keywords(dim_content)
        if not dim_keywords:
            continue

        overlap = message_keywords & dim_keywords
        score = len(overlap) / max(len(message_keywords), 1)

        if score > 0:
            scores.append((dim_name, score, dim_content))

    # Sort by score descending
    scores.sort(key=lambda x: x[1], reverse=True)

    if not scores:
        return _build_fallback(dimensions, budget_tokens)

    # Build output within budget
    from services.token_budget import estimate_tokens

    result_parts = []
    used_tokens = 0

    for dim_name, score, content in scores:
        tokens = estimate_tokens(content)
        if used_tokens + tokens > budget_tokens:
            remaining = budget_tokens - used_tokens
            if remaining > 50:
                chars = remaining * 4
                result_parts.append(f"### {dim_name.title()}\n{content[:chars]}...")
            break

        result_parts.append(f"### {dim_name.title()}\n{content}")
        used_tokens += tokens

    result = "\n\n".join(result_parts)
    logger.debug("TELOS scored %d dimensions, used ~%d tokens", len(result_parts), used_tokens)
    return result


def _build_fallback(dimensions: dict[str, str], budget_tokens: int) -> str:
    """Build fallback from mission + goals."""
    from services.token_budget import truncate_to_budget

    parts = []
    for dim in FALLBACK_DIMENSIONS:
        if dim in dimensions and dimensions[dim].strip():
            parts.append(f"### {dim.title()}\n{dimensions[dim]}")

    result = "\n\n".join(parts)
    return truncate_to_budget(result, "telos")
