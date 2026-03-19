"""Storage Router — File management via S3-compatible object storage.

Per-user S3 credentials stored in the database (users table).

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
  GET    /storage/config          — Get user's S3 config (masked)
  PUT    /storage/config          — Save user's S3 config to DB
  POST   /storage/test            — Test S3 connection
"""

import logging
import mimetypes
import time
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.user import User
from auth.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ── S3 Client Cache (per user, 5 min TTL) ──
_user_s3_clients: dict[str, tuple] = {}  # user_id -> (client, timestamp)


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
    bucket_name: str = "paione-files"
    region: str = "fsn1"


# ── Helpers ──


def _mask_key(key: str | None) -> str:
    """Mask a secret key for safe display."""
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}...{key[-4:]}"


def _user_s3_configured(user: User) -> bool:
    """Check if user has S3 credentials configured."""
    return bool(
        user.s3_endpoint_url
        and user.s3_access_key
        and user.s3_secret_key
    )


def _get_user_s3_client(user: User):
    """Get or create a cached boto3 S3 client for a user (5 min TTL)."""
    if not _user_s3_configured(user):
        raise HTTPException(
            status_code=503,
            detail="Object Storage nicht konfiguriert - bitte erst Zugangsdaten in den Einstellungen eingeben",
        )

    user_key = str(user.id)
    cached = _user_s3_clients.get(user_key)

    # Return cached client if still valid (5 min TTL)
    if cached and (time.time() - cached[1]) < 300:
        return cached[0]

    client = boto3.client(
        "s3",
        endpoint_url=user.s3_endpoint_url,
        aws_access_key_id=user.s3_access_key,
        aws_secret_access_key=user.s3_secret_key,
        region_name=user.s3_region or "us-east-1",
        config=BotoConfig(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    )
    _user_s3_clients[user_key] = (client, time.time())
    return client


def _get_user_bucket(user: User) -> str:
    """Get the user's bucket name, with fallback."""
    return user.s3_bucket_name or "paione-files"


# ── Endpoints ──


@router.get("/storage/status")
async def storage_status(user: User = Depends(get_current_user)):
    """Check object storage connection status."""
    if not _user_s3_configured(user):
        return {
            "connected": False,
            "error": "S3-Konfiguration fehlt - bitte Zugangsdaten in den Einstellungen eingeben",
            "endpoint": None,
            "bucket": None,
        }
    try:
        client = _get_user_s3_client(user)
        bucket = _get_user_bucket(user)
        client.head_bucket(Bucket=bucket)
        return {
            "connected": True,
            "error": None,
            "endpoint": user.s3_endpoint_url,
            "bucket": bucket,
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
            "endpoint": user.s3_endpoint_url,
            "bucket": _get_user_bucket(user),
        }


@router.get("/storage/list")
async def list_files(
    prefix: str = Query(default="", description="Folder path prefix"),
    user: User = Depends(get_current_user),
):
    """List files and folders at a given prefix."""
    client = _get_user_s3_client(user)
    bucket = _get_user_bucket(user)

    try:
        user_prefix = f"users/{user.id}/{prefix}".lstrip("/")
        resp = client.list_objects_v2(
            Bucket=bucket,
            Prefix=user_prefix,
            Delimiter="/",
            MaxKeys=1000,
        )

        strip = f"users/{user.id}/"

        folders = []
        for cp in resp.get("CommonPrefixes", []):
            p = cp["Prefix"]
            name = p[len(user_prefix):].rstrip("/")
            if name:
                path = p[len(strip):] if p.startswith(strip) else p
                folders.append({"name": name, "path": path, "type": "folder"})

        files = []
        for obj in resp.get("Contents", []):
            key = obj["Key"]
            if key == user_prefix:
                continue
            name = key[len(user_prefix):]
            if "/" in name:
                continue
            mime, _ = mimetypes.guess_type(name)
            path = key[len(strip):] if key.startswith(strip) else key
            files.append({
                "name": name,
                "path": path,
                "type": "file",
                "size": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
                "content_type": mime or "application/octet-stream",
            })

        return {
            "prefix": prefix,
            "folders": folders,
            "files": files,
            "total": len(folders) + len(files),
        }
    except HTTPException:
        raise
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
    client = _get_user_s3_client(user)
    bucket = _get_user_bucket(user)

    content = await file.read()
    if len(content) > 100 * 1024 * 1024:  # 100 MB limit
        raise HTTPException(status_code=413, detail="Datei zu gross (max 100 MB)")

    base = path.strip("/")
    filename = file.filename or "upload"
    key = f"users/{user.id}/{base}/{filename}" if base else f"users/{user.id}/{filename}"
    ct = file.content_type or "application/octet-stream"

    # Ensure UTF-8 charset for text content types (fixes Umlaut encoding)
    if ct.startswith("text/") and "charset" not in ct:
        ct += "; charset=utf-8"

    client.put_object(Bucket=bucket, Key=key, Body=content, ContentType=ct)

    strip = f"users/{user.id}/"
    display_path = key[len(strip):] if key.startswith(strip) else key
    return {
        "path": display_path,
        "size": len(content),
        "content_type": ct,
    }


@router.post("/storage/upload-url")
async def get_upload_url(
    req: UploadUrlRequest,
    user: User = Depends(get_current_user),
):
    """Get a presigned URL for direct browser upload."""
    client = _get_user_s3_client(user)
    bucket = _get_user_bucket(user)

    key = f"users/{user.id}/{req.key.lstrip('/')}"
    url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": req.content_type},
        ExpiresIn=3600,
    )
    return {"url": url, "key": key, "expires_in": 3600}


@router.get("/storage/download")
async def download_file(
    path: str = Query(..., description="File path"),
    user: User = Depends(get_current_user),
):
    """Download a file directly."""
    client = _get_user_s3_client(user)
    bucket = _get_user_bucket(user)

    key = f"users/{user.id}/{path.lstrip('/')}"
    try:
        resp = client.get_object(Bucket=bucket, Key=key)
        data = resp["Body"].read()
        ct = resp.get("ContentType", "application/octet-stream")
        # Ensure UTF-8 charset for text downloads (fixes Umlaut rendering)
        if ct.startswith("text/") and "charset" not in ct:
            ct += "; charset=utf-8"
        filename = path.split("/")[-1]
        return Response(
            content=data,
            media_type=ct,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise HTTPException(status_code=404, detail="Datei nicht gefunden")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/download-url")
async def get_download_url(
    path: str = Query(..., description="File path"),
    user: User = Depends(get_current_user),
):
    """Get a presigned download URL."""
    client = _get_user_s3_client(user)
    bucket = _get_user_bucket(user)

    key = f"users/{user.id}/{path.lstrip('/')}"
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=3600,
    )
    return {"url": url, "key": key, "expires_in": 3600}


@router.post("/storage/folder")
async def create_folder(
    req: FolderRequest,
    user: User = Depends(get_current_user),
):
    """Create a new folder."""
    client = _get_user_s3_client(user)
    bucket = _get_user_bucket(user)

    key = f"users/{user.id}/{req.path.lstrip('/')}"
    if not key.endswith("/"):
        key += "/"

    client.put_object(Bucket=bucket, Key=key, Body=b"", ContentType="application/x-directory")

    strip = f"users/{user.id}/"
    display_path = key[len(strip):] if key.startswith(strip) else key
    return {"path": display_path}


@router.post("/storage/move")
async def move_object(
    req: MoveRequest,
    user: User = Depends(get_current_user),
):
    """Move or rename a file/folder."""
    client = _get_user_s3_client(user)
    bucket = _get_user_bucket(user)

    src = f"users/{user.id}/{req.src.lstrip('/')}"
    dst = f"users/{user.id}/{req.dst.lstrip('/')}"

    client.copy_object(
        Bucket=bucket,
        CopySource={"Bucket": bucket, "Key": src},
        Key=dst,
    )
    client.delete_object(Bucket=bucket, Key=src)

    strip = f"users/{user.id}/"
    return {
        "from": src[len(strip):] if src.startswith(strip) else src,
        "to": dst[len(strip):] if dst.startswith(strip) else dst,
    }


@router.delete("/storage/delete")
async def delete_object(
    path: str = Query(..., description="Path to delete"),
    recursive: bool = Query(default=False, description="Delete folder recursively"),
    user: User = Depends(get_current_user),
):
    """Delete a file or folder."""
    client = _get_user_s3_client(user)
    bucket = _get_user_bucket(user)

    key = f"users/{user.id}/{path.lstrip('/')}"

    if recursive:
        prefix = key if key.endswith("/") else key + "/"
        deleted = 0
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
            if objects:
                client.delete_objects(Bucket=bucket, Delete={"Objects": objects})
                deleted += len(objects)
        return {"deleted": deleted, "path": path}
    else:
        client.delete_object(Bucket=bucket, Key=key)
        return {"deleted": 1, "path": path}


@router.get("/storage/stats")
async def get_storage_stats(user: User = Depends(get_current_user)):
    """Get storage statistics: file count, folder count, total size."""
    if not _user_s3_configured(user):
        return {"files": 0, "folders": 0, "total_size": 0}

    try:
        client = _get_user_s3_client(user)
        bucket = _get_user_bucket(user)
        user_prefix = f"users/{user.id}/"
        total_files = 0
        total_folders: set[str] = set()
        total_size = 0

        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=user_prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.endswith("/"):
                    total_folders.add(key)
                else:
                    total_files += 1
                    total_size += obj.get("Size", 0)
                # Track parent folders
                relative = key.replace(user_prefix, "", 1)
                parts = relative.split("/")
                for i in range(len(parts) - 1):
                    total_folders.add("/".join(parts[: i + 1]))

        return {"files": total_files, "folders": len(total_folders), "total_size": total_size}
    except Exception as e:
        logger.error("Storage stats error: %s", e)
        return {"files": 0, "folders": 0, "total_size": 0}


@router.get("/storage/preview")
async def preview_file(
    path: str = Query(..., description="File path to preview"),
    user: User = Depends(get_current_user),
):
    """Preview a text file (max 100 KB). Returns plain text content."""
    client = _get_user_s3_client(user)
    bucket = _get_user_bucket(user)

    key = f"users/{user.id}/{path.lstrip('/')}"
    try:
        resp = client.get_object(Bucket=bucket, Key=key)
        data = resp["Body"].read()
        if len(data) > 100 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Datei zu gross fuer Vorschau (max 100 KB)",
            )
        text = data.decode("utf-8")
        return Response(content=text, media_type="text/plain; charset=utf-8")
    except HTTPException:
        raise
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=415, detail="Binaerdatei — keine Vorschau moeglich"
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise HTTPException(status_code=404, detail="Datei nicht gefunden")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Preview error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/config")
async def get_storage_config(user: User = Depends(get_current_user)):
    """Get user's S3 storage configuration (secret key masked)."""
    return {
        "endpoint_url": user.s3_endpoint_url or "",
        "access_key": user.s3_access_key or "",
        "secret_key": _mask_key(user.s3_secret_key) if user.s3_secret_key else "",
        "bucket_name": user.s3_bucket_name or "",
        "region": user.s3_region or "",
        "configured": _user_s3_configured(user),
    }


@router.put("/storage/config")
async def update_storage_config(
    req: StorageConfigRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save S3 storage configuration to user profile in DB."""
    if req.endpoint_url is not None:
        user.s3_endpoint_url = req.endpoint_url or None
    if req.access_key is not None:
        user.s3_access_key = req.access_key or None
    if req.secret_key and not req.secret_key.startswith("*") and "..." not in req.secret_key:
        user.s3_secret_key = req.secret_key
    if req.bucket_name is not None:
        user.s3_bucket_name = req.bucket_name or None
    if req.region is not None:
        user.s3_region = req.region or None

    db.add(user)
    await db.commit()

    # Invalidate cached S3 client for this user
    _user_s3_clients.pop(str(user.id), None)

    logger.info("Storage config updated by user %s", user.id)
    return {
        "status": "ok",
        "configured": _user_s3_configured(user),
    }


@router.post("/storage/test")
async def test_storage_connection(user: User = Depends(get_current_user)):
    """Test S3 connection with user's config."""
    if not _user_s3_configured(user):
        return {"connected": False, "error": "Nicht konfiguriert - bitte erst Zugangsdaten eingeben"}
    try:
        client = _get_user_s3_client(user)
        bucket = _get_user_bucket(user)
        client.head_bucket(Bucket=bucket)
        return {
            "connected": True,
            "error": None,
            "endpoint": user.s3_endpoint_url,
            "bucket": bucket,
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}
