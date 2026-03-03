"""Parser for Anthropic Skills Open Standard SKILL.md files.

Format:
    ---
    name: skill-name
    description: |
      Multi-line description used for tool routing.
    dependencies:
      - some-dep
    ---

    # Title

    Markdown body (instructions for the LLM system prompt).
"""

from __future__ import annotations

import re
from typing import Any

import yaml


# ── Frontmatter extraction ──────────────────────────────────────────────

_FRONTMATTER_RE = re.compile(
    r"\A\s*^---\s*\n(.*?)^---\s*\n",
    re.MULTILINE | re.DOTALL,
)


def parse_skill_md(content: str) -> dict[str, Any]:
    """Parse a SKILL.md file with YAML frontmatter.

    Returns dict with:
    - name: str
    - description: str
    - dependencies: list[str]
    - instructions: str  (markdown body after frontmatter)
    - parameters: dict   (extracted from ## Parameters section if present)
    """
    if not content or not content.strip():
        return {
            "name": "",
            "description": "",
            "dependencies": [],
            "instructions": "",
            "parameters": {},
        }

    frontmatter: dict[str, Any] = {}
    body = content

    match = _FRONTMATTER_RE.search(content)
    if match:
        try:
            frontmatter = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError:
            frontmatter = {}
        body = content[match.end():]

    instructions = body.strip()
    parameters = extract_parameters_from_instructions(instructions)

    return {
        "name": frontmatter.get("name", ""),
        "description": frontmatter.get("description", "").strip()
        if isinstance(frontmatter.get("description"), str)
        else str(frontmatter.get("description", "")),
        "dependencies": frontmatter.get("dependencies") or [],
        "instructions": instructions,
        "parameters": parameters,
    }


# ── Builder ──────────────────────────────────────────────────────────────


def build_skill_md(
    name: str,
    description: str,
    instructions: str,
    dependencies: list[str] | None = None,
) -> str:
    """Build a SKILL.md string from components."""
    fm: dict[str, Any] = {"name": name}

    if description:
        # Use literal block style for multi-line descriptions
        fm["description"] = description

    if dependencies:
        fm["dependencies"] = dependencies

    yaml_str = yaml.dump(
        fm,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
    ).strip()

    parts = ["---", yaml_str, "---", "", instructions.strip()]
    return "\n".join(parts) + "\n"


# ── Parameter extraction ─────────────────────────────────────────────────

# Matches: - **param_name** (type, optional/required): Description text
_PARAM_LINE_RE = re.compile(
    r"^\s*[-*]\s+\*\*(\w+)\*\*"           # - **param_name**
    r"\s*\(([^)]*)\)"                       # (type/optional info)
    r"\s*:?\s*(.*)",                         # : description
    re.MULTILINE,
)


def extract_parameters_from_instructions(instructions: str) -> dict[str, Any]:
    """Extract parameter definitions from markdown instructions.

    Looks for a ``## Parameters`` section with list items like:
        - **date** (optional): Datum fuer das Briefing im Format YYYY-MM-DD.
        - **topic** (string, required): The topic.
    """
    # Find the ## Parameters section
    section_match = re.search(
        r"^##\s+Parameters?\s*\n(.*?)(?=^##|\Z)",
        instructions,
        re.MULTILINE | re.DOTALL,
    )
    if not section_match:
        return {}

    section_text = section_match.group(1)
    parameters: dict[str, Any] = {}

    for m in _PARAM_LINE_RE.finditer(section_text):
        param_name = m.group(1)
        type_info = m.group(2).strip().lower()
        description = m.group(3).strip().rstrip(".")

        # Determine type and required status
        param_type = "string"
        required = True

        if "optional" in type_info:
            required = False
        if "required" in type_info:
            required = True

        # Try to extract actual type from type_info
        for candidate in ("string", "number", "integer", "boolean", "array", "object"):
            if candidate in type_info:
                param_type = candidate
                break

        parameters[param_name] = {
            "type": param_type,
            "required": required,
            "description": description,
        }

    return parameters
