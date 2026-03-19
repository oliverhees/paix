"""Local file storage service — replaces S3 for PAIONE."""

import os
import logging
import mimetypes
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class LocalStorageService:
    """File storage on local disk instead of S3."""

    def __init__(self):
        self.base_path = Path(os.environ.get("STORAGE_PATH", "DATA/storage"))
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info("LocalStorageService initialized: %s", self.base_path)

    def _user_path(self, user_id: str) -> Path:
        """Get user-scoped storage directory."""
        p = self.base_path / "users" / str(user_id)
        p.mkdir(parents=True, exist_ok=True)
        return p

    def _full_path(self, user_id: str, key: str) -> Path:
        """Get full path for a file key."""
        return self._user_path(user_id) / key.lstrip("/")

    async def list_objects(self, user_id: str, prefix: str = "") -> dict:
        """List files and folders at prefix."""
        base = self._user_path(user_id)
        target = base / prefix.lstrip("/") if prefix else base

        if not target.exists():
            return {"files": [], "folders": []}

        files = []
        folders = []

        for item in sorted(target.iterdir()):
            rel = str(item.relative_to(base))
            if item.is_dir():
                folders.append({"name": item.name, "path": rel + "/"})
            else:
                stat = item.stat()
                files.append({
                    "name": item.name,
                    "path": rel,
                    "size": stat.st_size,
                    "last_modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    "content_type": mimetypes.guess_type(item.name)[0] or "application/octet-stream",
                })

        return {"files": files, "folders": folders}

    async def upload_file(self, user_id: str, key: str, data: bytes, content_type: str = "application/octet-stream") -> dict:
        """Save file to disk."""
        path = self._full_path(user_id, key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return {"key": key, "size": len(data)}

    async def download_file(self, user_id: str, key: str) -> tuple[bytes, str]:
        """Read file from disk."""
        path = self._full_path(user_id, key)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {key}")
        ct = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return path.read_bytes(), ct

    async def delete_object(self, user_id: str, key: str):
        """Delete a file."""
        path = self._full_path(user_id, key)
        if path.exists():
            path.unlink()

    async def delete_recursive(self, user_id: str, key: str) -> int:
        """Delete a folder and all its contents recursively."""
        import shutil
        path = self._full_path(user_id, key)
        if not path.exists():
            return 0
        if path.is_file():
            path.unlink()
            return 1
        count = sum(1 for _ in path.rglob("*") if _.is_file())
        shutil.rmtree(path)
        return count

    async def create_folder(self, user_id: str, key: str):
        """Create a folder."""
        path = self._full_path(user_id, key)
        path.mkdir(parents=True, exist_ok=True)

    async def move_object(self, user_id: str, src: str, dst: str):
        """Move/rename a file."""
        src_path = self._full_path(user_id, src)
        dst_path = self._full_path(user_id, dst)
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        src_path.rename(dst_path)

    async def get_stats(self, user_id: str) -> dict:
        """Get storage statistics."""
        base = self._user_path(user_id)
        total_files = 0
        total_folders = 0
        total_size = 0

        for item in base.rglob("*"):
            if item.is_file():
                total_files += 1
                total_size += item.stat().st_size
            elif item.is_dir():
                total_folders += 1

        return {"files": total_files, "folders": total_folders, "total_size": total_size}


# Singleton
local_storage = LocalStorageService()
