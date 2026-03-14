/**
 * Storage Service — File management via S3-compatible object storage.
 * Connects to FastAPI backend storage endpoints.
 */

import { api } from "@/lib/api";

// ─── Types ───

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

export interface PresignedUrl {
  url: string;
  key: string;
  expires_in: number;
}

export interface StorageConfig {
  endpoint_url: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
  region: string;
  configured: boolean;
}

// ─── Service ───

class StorageService {
  async getConfig(): Promise<StorageConfig> {
    return api.get<StorageConfig>("/storage/config");
  }

  async updateConfig(config: Omit<StorageConfig, "configured">): Promise<{ status: string; configured: boolean }> {
    return api.put<{ status: string; configured: boolean }>("/storage/config", config);
  }

  async testConnection(): Promise<StorageStatus> {
    return api.post<StorageStatus>("/storage/test", {});
  }

  async getStatus(): Promise<StorageStatus> {
    return api.get<StorageStatus>("/storage/status");
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

    const token = api.getAccessToken();
    const response = await fetch("/api/v1/storage/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Upload fehlgeschlagen" }));
      throw new Error(err.detail || `Upload failed: ${response.status}`);
    }

    return response.json();
  }

  async getUploadUrl(key: string, contentType: string = "application/octet-stream"): Promise<PresignedUrl> {
    return api.post<PresignedUrl>("/storage/upload-url", {
      key,
      content_type: contentType,
    });
  }

  async getDownloadUrl(path: string): Promise<PresignedUrl> {
    return api.get<PresignedUrl>(`/storage/download-url?path=${encodeURIComponent(path)}`);
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
