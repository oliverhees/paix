/**
 * Auth type definitions — derived from FastAPI backend schemas.
 * See: api/routers/auth.py
 */

// ─── Request Types ───

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

// ─── Response Types ───

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

export interface RegisterResponse {
  id: string;
  email: string;
  name: string;
  created_at: string | null;
}

export interface UserMeResponse {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  timezone: string;
  created_at: string | null;
  persona_name?: string | null;
  persona_prompt?: string | null;
  persona_personality?: string | null;
  persona_about_user?: string | null;
  persona_communication?: string | null;
  brave_search_api_key?: string | null;
}

// ─── Agent State ───

export interface AgentStateEntry {
  key: string;
  value: any;
  scope: "global" | "session";
  updated_at: string | null;
}

export interface AgentStateResponse {
  entries: AgentStateEntry[];
}

// ─── Auth State ───

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  timezone: string;
}
