/**
 * Auth type definitions — simplified for single-user mode.
 * See: api/routers/auth.py
 */

// ─── Response Types ───

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
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
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
