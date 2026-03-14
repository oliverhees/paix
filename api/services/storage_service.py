"""Hetzner Object Storage Service — S3-compatible file storage.

Provides a high-level interface over boto3 for:
- Upload / download / delete files
- List objects with prefix-based "folder" navigation
- Presigned URL generation for direct browser uploads
- Folder creation / deletion
"""

import io
import logging
import mimetypes
from datetime import datetime
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """S3-compatible object storage client for Hetzner."""

    def __init__(self):
        self._client = None
        self._bucket = None

    @property
    def configured(self) -> bool:
        return bool(
            settings.s3_endpoint_url
            and settings.s3_access_key
            and settings.s3_secret_key
            and settings.s3_bucket_name
        )

    def _ensure_client(self):
        if self._client is not None:
            return
        if not self.configured:
            raise RuntimeError("Object Storage not configured. Set S3_* env vars.")
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=BotoConfig(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
        )
        self._bucket = settings.s3_bucket_name

    # ── List ──

    async def list_objects(
        self,
        prefix: str = "",
        delimiter: str = "/",
        max_keys: int = 1000,
    ) -> dict:
        """List objects and common prefixes (folders) under a prefix."""
        self._ensure_client()
        prefix = prefix.lstrip("/")

        params = {
            "Bucket": self._bucket,
            "Prefix": prefix,
            "Delimiter": delimiter,
            "MaxKeys": max_keys,
        }

        resp = self._client.list_objects_v2(**params)

        folders = []
        for cp in resp.get("CommonPrefixes", []):
            p = cp["Prefix"]
            name = p[len(prefix):].rstrip("/")
            if name:
                folders.append({"name": name, "path": p, "type": "folder"})

        files = []
        for obj in resp.get("Contents", []):
            key = obj["Key"]
            # Skip the prefix itself (folder marker)
            if key == prefix:
                continue
            name = key[len(prefix):]
            # Skip nested objects (should be handled by delimiter)
            if "/" in name:
                continue
            mime, _ = mimetypes.guess_type(name)
            files.append({
                "name": name,
                "path": key,
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

    # ── Upload ──

    async def upload_file(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> dict:
        """Upload a file to storage."""
        self._ensure_client()
        key = key.lstrip("/")

        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

        return {
            "path": key,
            "size": len(data),
            "content_type": content_type,
        }

    # ── Download ──

    async def download_file(self, key: str) -> tuple[bytes, str]:
        """Download a file. Returns (data, content_type)."""
        self._ensure_client()
        key = key.lstrip("/")

        try:
            resp = self._client.get_object(Bucket=self._bucket, Key=key)
            data = resp["Body"].read()
            ct = resp.get("ContentType", "application/octet-stream")
            return data, ct
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"File not found: {key}")
            raise

    # ── Delete ──

    async def delete_object(self, key: str) -> bool:
        """Delete a single object."""
        self._ensure_client()
        key = key.lstrip("/")

        self._client.delete_object(Bucket=self._bucket, Key=key)
        return True

    async def delete_prefix(self, prefix: str) -> int:
        """Delete all objects under a prefix (folder deletion)."""
        self._ensure_client()
        prefix = prefix.lstrip("/")
        if not prefix.endswith("/"):
            prefix += "/"

        deleted = 0
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
            objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
            if objects:
                self._client.delete_objects(
                    Bucket=self._bucket,
                    Delete={"Objects": objects},
                )
                deleted += len(objects)

        return deleted

    # ── Move / Copy ──

    async def move_object(self, src_key: str, dst_key: str) -> dict:
        """Move (copy + delete) an object."""
        self._ensure_client()
        src_key = src_key.lstrip("/")
        dst_key = dst_key.lstrip("/")

        self._client.copy_object(
            Bucket=self._bucket,
            CopySource={"Bucket": self._bucket, "Key": src_key},
            Key=dst_key,
        )
        self._client.delete_object(Bucket=self._bucket, Key=src_key)

        return {"from": src_key, "to": dst_key}

    # ── Folder ──

    async def create_folder(self, path: str) -> dict:
        """Create a folder marker (empty object with trailing slash)."""
        self._ensure_client()
        path = path.lstrip("/")
        if not path.endswith("/"):
            path += "/"

        self._client.put_object(
            Bucket=self._bucket,
            Key=path,
            Body=b"",
            ContentType="application/x-directory",
        )

        return {"path": path}

    # ── Presigned URLs ──

    async def get_upload_url(
        self,
        key: str,
        content_type: str = "application/octet-stream",
        expires_in: int = 3600,
    ) -> dict:
        """Generate a presigned PUT URL for direct browser upload."""
        self._ensure_client()
        key = key.lstrip("/")

        url = self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self._bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

        return {"url": url, "key": key, "expires_in": expires_in}

    async def get_download_url(
        self, key: str, expires_in: int = 3600
    ) -> dict:
        """Generate a presigned GET URL for direct browser download."""
        self._ensure_client()
        key = key.lstrip("/")

        url = self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )

        return {"url": url, "key": key, "expires_in": expires_in}

    # ── Status ──

    async def get_status(self) -> dict:
        """Check storage connection and bucket status."""
        if not self.configured:
            return {
                "connected": False,
                "error": "S3-Konfiguration fehlt (S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME)",
                "endpoint": None,
                "bucket": None,
            }
        try:
            self._ensure_client()
            self._client.head_bucket(Bucket=self._bucket)
            return {
                "connected": True,
                "error": None,
                "endpoint": settings.s3_endpoint_url,
                "bucket": self._bucket,
            }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e),
                "endpoint": settings.s3_endpoint_url,
                "bucket": self._bucket,
            }


storage_service = StorageService()
