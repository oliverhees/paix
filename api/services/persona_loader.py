"""Persona Loader — reads 5 persona files with fallback chain."""

import logging
from pathlib import Path
from services.token_budget import truncate_to_budget

logger = logging.getLogger(__name__)

PERSONA_FILES = ["identity.md", "rules.md", "skills.md", "preferences.md", "pinned.md"]
PER_FILE_BUDGET = 300  # ~300 tokens per file, 5 files = ~1500 total

# Resolve paths relative to project root (two levels up from this file)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class PersonaLoader:
    def __init__(self):
        self.user_path = _PROJECT_ROOT / "USER" / "groups" / "persona"
        self.system_path_template = str(_PROJECT_ROOT / "SYSTEM" / "defaults" / "persona" / "{locale}")

    def load_persona(self, locale: str = "de") -> str:
        """Load all 5 persona files and combine them."""
        system_path = Path(self.system_path_template.format(locale=locale))

        sections = []
        for filename in PERSONA_FILES:
            content = self._load_file(filename, system_path)
            if content.strip():
                label = filename.replace(".md", "").replace("_", " ").title()
                truncated = truncate_to_budget(content, "persona", PER_FILE_BUDGET)
                sections.append(f"## {label}\n{truncated}")

        combined = "\n\n".join(sections) if sections else ""
        # Final truncation to total persona budget
        return truncate_to_budget(combined, "persona")

    def _load_file(self, filename: str, system_fallback: Path) -> str:
        """Load a persona file with fallback chain: User -> System -> empty."""
        user_file = self.user_path / filename
        system_file = system_fallback / filename

        if user_file.exists():
            content = user_file.read_text(encoding="utf-8").strip()
            if content:
                return content

        if system_file.exists():
            return system_file.read_text(encoding="utf-8").strip()

        return ""


# Singleton
persona_loader = PersonaLoader()
