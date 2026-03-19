"""Settings Endpoints — persona file management."""

from fastapi import APIRouter
from pydantic import BaseModel

from services.persona_loader import persona_loader, PERSONA_FILES

router = APIRouter()


class PersonaFilesResponse(BaseModel):
    files: dict[str, str]


class PersonaFilesUpdateRequest(BaseModel):
    files: dict[str, str]


@router.get("/settings/persona-files", response_model=PersonaFilesResponse)
async def get_persona_files():
    """Read all 5 persona markdown files."""
    files = {}
    for f in PERSONA_FILES:
        path = persona_loader.user_path / f
        key = f.replace(".md", "")
        files[key] = path.read_text("utf-8") if path.exists() else ""
    return PersonaFilesResponse(files=files)


@router.put("/settings/persona-files", response_model=PersonaFilesResponse)
async def update_persona_files(body: PersonaFilesUpdateRequest):
    """Write all 5 persona markdown files."""
    for key, content in body.files.items():
        path = persona_loader.user_path / f"{key}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    # Return current state
    files = {}
    for f in PERSONA_FILES:
        path = persona_loader.user_path / f
        k = f.replace(".md", "")
        files[k] = path.read_text("utf-8") if path.exists() else ""
    return PersonaFilesResponse(files=files)
