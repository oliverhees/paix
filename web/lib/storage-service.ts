/**
 * Storage Service — File management via local disk storage.
 * Connects to FastAPI backend storage endpoints.
 */

import { api } from "@/lib/api";

// --- Types ---

export interface StorageItem {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  last_modified?: string;
  content_type?: string;
}

export interface StorageListResponse {
  prefix: string;
  folders: StorageItem[];
  files: StorageItem[];
  total: number;
}

export interface StorageStatus {
  connected: boolean;
  error: string | null;
  endpoint: string | null;
  bucket: string | null;
}

export interface UploadResult {
  path: string;
  size: number;
  content_type: string;
}

export interface StorageStats {
  files: number;
  folders: number;
  total_size: number;
}

export interface StorageConfig {
  type: string;
  path: string;
  configured: boolean;
}

// --- Service ---

class StorageService {
  async getStatus(): Promise<StorageStatus> {
    return api.get<StorageStatus>("/storage/status");
  }

  async getStats(): Promise<StorageStats> {
    return api.get<StorageStats>("/storage/stats");
  }

  async getConfig(): Promise<StorageConfig> {
    return api.get<StorageConfig>("/storage/config");
  }

  async previewFile(path: string): Promise<string> {
    const response = await fetch(
      `/api/v1/storage/preview?path=${encodeURIComponent(path)}`,
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Vorschau fehlgeschlagen" }));
      throw new Error(err.detail || `Preview failed: ${response.status}`);
    }
    return response.text();
  }

  async listFiles(prefix: string = ""): Promise<StorageListResponse> {
    const params = new URLSearchParams();
    if (prefix) params.set("prefix", prefix);
    return api.get<StorageListResponse>(`/storage/list?${params}`);
  }

  async uploadFile(file: File, path: string = ""): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);

    const response = await fetch("/api/v1/storage/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Upload fehlgeschlagen" }));
      throw new Error(err.detail || `Upload failed: ${response.status}`);
    }

    return response.json();
  }

  async createFolder(path: string): Promise<{ path: string }> {
    return api.post<{ path: string }>("/storage/folder", { path });
  }

  async moveObject(src: string, dst: string): Promise<{ from: string; to: string }> {
    return api.post<{ from: string; to: string }>("/storage/move", { src, dst });
  }

  async deleteObject(path: string, recursive: boolean = false): Promise<{ deleted: number; path: string }> {
    const params = new URLSearchParams({ path });
    if (recursive) params.set("recursive", "true");
    return api.delete<{ deleted: number; path: string }>(`/storage/delete?${params}`);
  }
}

export const storageService = new StorageService();
