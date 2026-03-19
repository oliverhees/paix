"""Storage Router — File management via local disk storage.

Endpoints:
  GET    /storage/status          — Connection status (always connected)
  GET    /storage/list            — List files and folders
  POST   /storage/upload          — Upload file(s) via multipart
  GET    /storage/download        — Download a file
  POST   /storage/folder          — Create a folder
  POST   /storage/move            — Move/rename a file or folder
  DELETE /storage/delete          — Delete a file or folder
  GET    /storage/config          — Get storage config info
  POST   /storage/test            — Test connection (always OK)
  GET    /storage/stats           — Storage statistics
  GET    /storage/preview         — Preview a text file
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from pydantic import BaseModel

from models.user import User
from auth.dependencies import get_current_user
from services.local_storage_service import local_storage

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


# ── Endpoints ──


@router.get("/storage/status")
async def storage_status(user: User = Depends(get_current_user)):
    """Check storage connection status — local storage is always available."""
    return {
        "connected": True,
        "error": None,
        "endpoint": "local",
        "bucket": str(local_storage.base_path),
    }


@router.get("/storage/list")
async def list_files(
    prefix: str = Query(default="", description="Folder path prefix"),
    user: User = Depends(get_current_user),
):
    """List files and folders at a given prefix."""
    try:
        uid = str(user.id)
        result = await local_storage.list_objects(uid, prefix)

        folders = [
            {"name": f["name"], "path": f["path"], "type": "folder"}
            for f in result["folders"]
        ]
        files = [
            {
                "name": f["name"],
                "path": f["path"],
                "type": "file",
                "size": f["size"],
                "last_modified": f["last_modified"],
                "content_type": f["content_type"],
            }
            for f in result["files"]
        ]

        return {
            "prefix": prefix,
            "folders": folders,
            "files": files,
            "total": len(folders) + len(files),
        }
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
    content = await file.read()
    if len(content) > 100 * 1024 * 1024:  # 100 MB limit
        raise HTTPException(status_code=413, detail="Datei zu gross (max 100 MB)")

    base = path.strip("/")
    filename = file.filename or "upload"
    key = f"{base}/{filename}" if base else filename
    ct = file.content_type or "application/octet-stream"

    # Ensure UTF-8 charset for text content types (fixes Umlaut encoding)
    if ct.startswith("text/") and "charset" not in ct:
        ct += "; charset=utf-8"

    uid = str(user.id)
    await local_storage.upload_file(uid, key, content, ct)

    return {
        "path": key,
        "size": len(content),
        "content_type": ct,
    }


@router.get("/storage/download")
async def download_file(
    path: str = Query(..., description="File path"),
    user: User = Depends(get_current_user),
):
    """Download a file directly."""
    uid = str(user.id)
    try:
        data, ct = await local_storage.download_file(uid, path)
        # Ensure UTF-8 charset for text downloads (fixes Umlaut rendering)
        if ct.startswith("text/") and "charset" not in ct:
            ct += "; charset=utf-8"
        filename = path.split("/")[-1]
        return Response(
            content=data,
            media_type=ct,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/storage/folder")
async def create_folder(
    req: FolderRequest,
    user: User = Depends(get_current_user),
):
    """Create a new folder."""
    uid = str(user.id)
    key = req.path.lstrip("/")
    if not key.endswith("/"):
        key += "/"
    await local_storage.create_folder(uid, key)
    return {"path": key}


@router.post("/storage/move")
async def move_object(
    req: MoveRequest,
    user: User = Depends(get_current_user),
):
    """Move or rename a file/folder."""
    uid = str(user.id)
    await local_storage.move_object(uid, req.src, req.dst)
    return {"from": req.src, "to": req.dst}


@router.delete("/storage/delete")
async def delete_object(
    path: str = Query(..., description="Path to delete"),
    recursive: bool = Query(default=False, description="Delete folder recursively"),
    user: User = Depends(get_current_user),
):
    """Delete a file or folder."""
    uid = str(user.id)
    if recursive:
        deleted = await local_storage.delete_recursive(uid, path)
        return {"deleted": deleted, "path": path}
    else:
        await local_storage.delete_object(uid, path)
        return {"deleted": 1, "path": path}


@router.get("/storage/stats")
async def get_storage_stats(user: User = Depends(get_current_user)):
    """Get storage statistics: file count, folder count, total size."""
    try:
        uid = str(user.id)
        return await local_storage.get_stats(uid)
    except Exception as e:
        logger.error("Storage stats error: %s", e)
        return {"files": 0, "folders": 0, "total_size": 0}


@router.get("/storage/preview")
async def preview_file(
    path: str = Query(..., description="File path to preview"),
    user: User = Depends(get_current_user),
):
    """Preview a text file (max 100 KB). Returns plain text content."""
    uid = str(user.id)
    try:
        data, _ = await local_storage.download_file(uid, path)
        if len(data) > 100 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Datei zu gross fuer Vorschau (max 100 KB)",
            )
        text = data.decode("utf-8")
        return Response(content=text, media_type="text/plain; charset=utf-8")
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=415, detail="Binaerdatei — keine Vorschau moeglich"
        )
    except Exception as e:
        logger.error("Preview error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/config")
async def get_storage_config(user: User = Depends(get_current_user)):
    """Get storage configuration info."""
    return {
        "type": "local",
        "path": str(local_storage.base_path),
        "configured": True,
    }


@router.post("/storage/test")
async def test_storage_connection(user: User = Depends(get_current_user)):
    """Test storage connection — local storage is always available."""
    return {
        "connected": True,
        "error": None,
        "endpoint": "local",
        "bucket": str(local_storage.base_path),
    }
