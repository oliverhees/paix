/**
 * PAI-X API Client — fetch wrapper for communicating with the FastAPI backend.
 *
 * Features:
 * - JWT Bearer token auth
 * - Automatic token refresh on 401
 * - Typed response handlers
 * - Configurable base URL via NEXT_PUBLIC_API_URL
 */

import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  RefreshResponse,
  RegisterResponse,
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
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Hydrate tokens from localStorage (client-side only)
    if (typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("pai_access_token");
      this.refreshToken = localStorage.getItem("pai_refresh_token");
    }
  }

  // ─── Token Management ───

  /**
   * Set tokens after login/refresh.
   */
  setTokens(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    if (typeof window !== "undefined") {
      localStorage.setItem("pai_access_token", accessToken);
    }
    if (refreshToken) {
      this.refreshToken = refreshToken;
      if (typeof window !== "undefined") {
        localStorage.setItem("pai_refresh_token", refreshToken);
      }
    }
  }

  /**
   * Clear all tokens (logout).
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("pai_access_token");
      localStorage.removeItem("pai_refresh_token");
    }
  }

  /**
   * Get the current access token.
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if we have tokens stored.
   */
  hasTokens(): boolean {
    return this.accessToken !== null;
  }

  // ─── Core Request Method ───

  /**
   * Make an API request with automatic token refresh on 401.
   */
  async request<T = unknown>(
    endpoint: string,
    options: ApiOptions = {}
  ): Promise<T> {
    const response = await this._doRequest<T>(endpoint, options);
    return response;
  }

  private async _doRequest<T = unknown>(
    endpoint: string,
    options: ApiOptions = {},
    isRetry = false
  ): Promise<T> {
    const { raw, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    // Handle 401 — attempt token refresh (but only once)
    if (response.status === 401 && !isRetry && this.refreshToken) {
      const newToken = await this._refreshAccessToken();
      if (newToken) {
        return this._doRequest<T>(endpoint, options, true);
      }
      // Refresh failed — clear tokens and throw
      this.clearTokens();
      throw new ApiClientError(401, "Session expired. Please log in again.");
    }

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

  /**
   * Refresh the access token using the stored refresh token.
   * Deduplicates concurrent refresh requests.
   */
  private async _refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        });

        if (!response.ok) {
          this.clearTokens();
          return null;
        }

        const data: RefreshResponse = await response.json();
        this.setTokens(data.access_token);
        return data.access_token;
      } catch {
        this.clearTokens();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
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
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers,
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

  // ─── Auth Methods ───

  async login(data: LoginRequest): Promise<TokenResponse> {
    const response = await this.post<TokenResponse>("/auth/login", data);
    this.setTokens(response.access_token, response.refresh_token);
    return response;
  }

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return this.post<RegisterResponse>("/auth/register", data);
  }

  async logout(): Promise<void> {
    try {
      await this.post("/auth/logout");
    } catch {
      // Ignore errors on logout — we clear tokens regardless
    }
    this.clearTokens();
  }

  async getMe(): Promise<UserMeResponse> {
    return this.get<UserMeResponse>("/auth/me");
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
