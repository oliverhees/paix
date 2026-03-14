"""Storage Router — File management via S3-compatible object storage.

Endpoints:
  GET    /storage/status          — Connection status
  GET    /storage/list            — List files and folders
  POST   /storage/upload          — Upload file(s) via multipart
  POST   /storage/upload-url      — Get presigned upload URL
  GET    /storage/download        — Download a file
  GET    /storage/download-url    — Get presigned download URL
  POST   /storage/folder          — Create a folder
  POST   /storage/move            — Move/rename a file or folder
  DELETE /storage/delete          — Delete a file or folder
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from pydantic import BaseModel

from models.user import User
from routers.auth import get_current_user
from services.storage_service import storage_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request/Response Models ──


class FolderRequest(BaseModel):
    path: str


class MoveRequest(BaseModel):
    src: str
    dst: str


class DeleteRequest(BaseModel):
    path: str
    recursive: bool = False


class UploadUrlRequest(BaseModel):
    key: str
    content_type: str = "application/octet-stream"


class StorageConfigRequest(BaseModel):
    endpoint_url: str = ""
    access_key: str = ""
    secret_key: str = ""
    bucket_name: str = "paix-files"
    region: str = "fsn1"


# ── Endpoints ──


@router.get("/storage/status")
async def storage_status(user: User = Depends(get_current_user)):
    """Check object storage connection status."""
    return await storage_service.get_status()


@router.get("/storage/list")
async def list_files(
    prefix: str = Query(default="", description="Folder path prefix"),
    user: User = Depends(get_current_user),
):
    """List files and folders at a given prefix."""
    if not storage_service.configured:
        raise HTTPException(status_code=503, detail="Object Storage nicht konfiguriert")
    try:
        # Scope to user namespace
        user_prefix = f"users/{user.id}/{prefix}"
        result = await storage_service.list_objects(prefix=user_prefix)
        # Strip user prefix from paths for frontend
        strip = f"users/{user.id}/"
        for item in result["folders"]:
            item["path"] = item["path"][len(strip):] if item["path"].startswith(strip) else item["path"]
        for item in result["files"]:
            item["path"] = item["path"][len(strip):] if item["path"].startswith(strip) else item["path"]
        result["prefix"] = prefix
        return result
    except Exception as e:
        logger.error("Storage list error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/storage/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(default=""),
    user: User = Depends(get_current_user),
):
    """Upload a file via multipart form data."""
    if not storage_service.configured:
        raise HTTPException(status_code=503, detail="Object Storage nicht konfiguriert")

    content = await file.read()
    if len(content) > 100 * 1024 * 1024:  # 100 MB limit
        raise HTTPException(status_code=413, detail="Datei zu groß (max 100 MB)")

    # Build key: users/{user_id}/{path}/{filename}
    base = path.strip("/")
    filename = file.filename or "upload"
    key = f"users/{user.id}/{base}/{filename}" if base else f"users/{user.id}/{filename}"

    ct = file.content_type or "application/octet-stream"
    result = await storage_service.upload_file(key=key, data=content, content_type=ct)

    # Strip user prefix
    strip = f"users/{user.id}/"
    result["path"] = result["path"][len(strip):] if result["path"].startswith(strip) else result["path"]
    return result


@router.post("/storage/upload-url")
async def get_upload_url(
    req: UploadUrlRequest,
    user: User = Depends(get_current_user),
):
    """Get a presigned URL for direct browser upload."""
    if not storage_service.configured:
        raise HTTPException(status_code=503, detail="Object Storage nicht konfiguriert")

    key = f"users/{user.id}/{req.key.lstrip('/')}"
    return await storage_service.get_upload_url(key=key, content_type=req.content_type)


@router.get("/storage/download")
async def download_file(
    path: str = Query(..., description="File path"),
    user: User = Depends(get_current_user),
):
    """Download a file directly."""
    if not storage_service.configured:
        raise HTTPException(status_code=503, detail="Object Storage nicht konfiguriert")

    key = f"users/{user.id}/{path.lstrip('/')}"
    try:
        data, ct = await storage_service.download_file(key)
        filename = path.split("/")[-1]
        return Response(
            content=data,
            media_type=ct,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")


@router.get("/storage/download-url")
async def get_download_url(
    path: str = Query(..., description="File path"),
    user: User = Depends(get_current_user),
):
    """Get a presigned download URL."""
    if not storage_service.configured:
        raise HTTPException(status_code=503, detail="Object Storage nicht konfiguriert")

    key = f"users/{user.id}/{path.lstrip('/')}"
    return await storage_service.get_download_url(key)


@router.post("/storage/folder")
async def create_folder(
    req: FolderRequest,
    user: User = Depends(get_current_user),
):
    """Create a new folder."""
    if not storage_service.configured:
        raise HTTPException(status_code=503, detail="Object Storage nicht konfiguriert")

    key = f"users/{user.id}/{req.path.lstrip('/')}"
    result = await storage_service.create_folder(key)
    strip = f"users/{user.id}/"
    result["path"] = result["path"][len(strip):] if result["path"].startswith(strip) else result["path"]
    return result


@router.post("/storage/move")
async def move_object(
    req: MoveRequest,
    user: User = Depends(get_current_user),
):
    """Move or rename a file/folder."""
    if not storage_service.configured:
        raise HTTPException(status_code=503, detail="Object Storage nicht konfiguriert")

    src = f"users/{user.id}/{req.src.lstrip('/')}"
    dst = f"users/{user.id}/{req.dst.lstrip('/')}"
    result = await storage_service.move_object(src, dst)
    strip = f"users/{user.id}/"
    result["from"] = result["from"][len(strip):] if result["from"].startswith(strip) else result["from"]
    result["to"] = result["to"][len(strip):] if result["to"].startswith(strip) else result["to"]
    return result


@router.delete("/storage/delete")
async def delete_object(
    path: str = Query(..., description="Path to delete"),
    recursive: bool = Query(default=False, description="Delete folder recursively"),
    user: User = Depends(get_current_user),
):
    """Delete a file or folder."""
    if not storage_service.configured:
        raise HTTPException(status_code=503, detail="Object Storage nicht konfiguriert")

    key = f"users/{user.id}/{path.lstrip('/')}"

    if recursive:
        count = await storage_service.delete_prefix(key)
        return {"deleted": count, "path": path}
    else:
        await storage_service.delete_object(key)
        return {"deleted": 1, "path": path}


@router.get("/storage/config")
async def get_storage_config(user: User = Depends(get_current_user)):
    """Get current S3 storage configuration (secret key masked)."""
    from config import settings as cfg
    return {
        "endpoint_url": cfg.s3_endpoint_url,
        "access_key": cfg.s3_access_key,
        "secret_key": ("*" * 8 + cfg.s3_secret_key[-4:]) if len(cfg.s3_secret_key) > 4 else "",
        "bucket_name": cfg.s3_bucket_name,
        "region": cfg.s3_region,
        "configured": storage_service.configured,
    }


@router.put("/storage/config")
async def update_storage_config(
    req: StorageConfigRequest,
    user: User = Depends(get_current_user),
):
    """Update S3 storage configuration by writing to .env file."""
    import os
    from pathlib import Path
    from config import settings as cfg

    env_path = Path(__file__).parent.parent / ".env"

    # Read existing .env
    env_lines: list[str] = []
    if env_path.exists():
        env_lines = env_path.read_text().splitlines()

    # Keys to update
    updates = {
        "S3_ENDPOINT_URL": req.endpoint_url,
        "S3_ACCESS_KEY": req.access_key,
        "S3_BUCKET_NAME": req.bucket_name,
        "S3_REGION": req.region,
    }
    # Only update secret if not masked
    if req.secret_key and not req.secret_key.startswith("*"):
        updates["S3_SECRET_KEY"] = req.secret_key

    # Update or append each key
    updated_keys: set[str] = set()
    for i, line in enumerate(env_lines):
        stripped = line.strip()
        if stripped.startswith("#") or "=" not in stripped:
            continue
        key = stripped.split("=", 1)[0].strip()
        if key in updates:
            env_lines[i] = f"{key}={updates[key]}"
            updated_keys.add(key)

    # Append missing keys
    missing = set(updates.keys()) - updated_keys
    if missing:
        if env_lines and env_lines[-1].strip():
            env_lines.append("")
        env_lines.append("# ─── Object Storage (S3-compatible) ───")
        for key in sorted(missing):
            env_lines.append(f"{key}={updates[key]}")

    env_path.write_text("\n".join(env_lines) + "\n")

    # Update runtime config + reinitialize storage service
    os.environ["S3_ENDPOINT_URL"] = req.endpoint_url
    os.environ["S3_ACCESS_KEY"] = req.access_key
    os.environ["S3_BUCKET_NAME"] = req.bucket_name
    os.environ["S3_REGION"] = req.region
    if req.secret_key and not req.secret_key.startswith("*"):
        os.environ["S3_SECRET_KEY"] = req.secret_key

    # Reinitialize settings + storage
    cfg.__init__()  # type: ignore[misc]
    storage_service._client = None  # Force reconnect

    logger.info("Storage config updated by user %s", user.id)
    return {"status": "ok", "configured": storage_service.configured}


@router.post("/storage/test")
async def test_storage_connection(user: User = Depends(get_current_user)):
    """Test S3 connection with current config."""
    if not storage_service.configured:
        return {"connected": False, "error": "Nicht konfiguriert — bitte erst Zugangsdaten eingeben"}
    try:
        status = await storage_service.get_status()
        return status
    except Exception as e:
        return {"connected": False, "error": str(e)}
