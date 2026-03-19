/**
 * PAIONE API Client — fetch wrapper for communicating with the FastAPI backend.
 *
 * Single-user mode: no authentication tokens needed.
 */

import type {
  UserMeResponse,
} from "@/lib/types/auth";

const API_BASE_URL =
  typeof window !== "undefined"
    ? "/api/v1" // Client-side: use Next.js rewrite proxy (avoids CORS)
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1");

interface ApiOptions extends RequestInit {
  /** Skip JSON parsing (for streaming responses). */
  raw?: boolean;
}

interface ApiError {
  detail?: string;
  code?: string;
  message?: string;
}

export class ApiClientError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiClientError";
    this.status = status;
    this.detail = detail;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // ─── Core Request Method ───

  /**
   * Make an API request.
   */
  async request<T = unknown>(
    endpoint: string,
    options: ApiOptions = {}
  ): Promise<T> {
    const { raw, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new ApiClientError(
        response.status,
        error.detail || error.message || `Request failed: ${response.status}`
      );
    }

    if (raw) {
      return response as unknown as T;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ─── Convenience Methods ───

  async get<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  /**
   * Upload a file via multipart/form-data (does NOT set Content-Type header
   * so the browser can set the boundary automatically).
   */
  async upload<T = unknown>(endpoint: string, formData: FormData): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new ApiClientError(
        response.status,
        error.detail || error.message || `Upload failed: ${response.status}`
      );
    }
    return response.json();
  }

  // ─── User Methods ───

  async getMe(): Promise<UserMeResponse> {
    return this.get<UserMeResponse>("/auth/me");
  }

  async getSetupStatus(): Promise<{ setup_complete: boolean }> {
    return this.get<{ setup_complete: boolean }>("/auth/setup-status");
  }

  async setup(data: {
    name: string;
    email: string;
    password: string;
    anthropic_api_key?: string;
    locale?: string;
  }): Promise<{ status: string; user_id: string }> {
    return this.post<{ status: string; user_id: string }>("/auth/setup", data);
  }

  // ─── Domain-Specific Methods ───

  /** Health check. */
  async health() {
    return this.get("/health");
  }

  /** Send a chat message. */
  async sendMessage(message: string, sessionId?: string) {
    return this.post("/chat", { message, session_id: sessionId });
  }

  /** Get chat sessions. */
  async getChatSessions(limit = 20, offset = 0) {
    return this.get(`/chat/sessions?limit=${limit}&offset=${offset}`);
  }

  /** Get today's calendar events. */
  async getCalendarToday() {
    return this.get("/calendar/today");
  }

  /** Get daily briefing. */
  async getDailyBriefing(date?: string) {
    const params = date ? `?date=${date}` : "";
    return this.get(`/calendar/briefing${params}`);
  }

  /** Get all TELOS dimensions. */
  async getTelos() {
    return this.get("/telos");
  }

  /** Search memory. */
  async searchMemory(query: string, type?: string, limit = 10) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (type) params.set("type", type);
    return this.get(`/memory/search?${params}`);
  }
}

/** Singleton API client instance. */
export const api = new ApiClient(API_BASE_URL);
