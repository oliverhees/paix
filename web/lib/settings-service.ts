/**
 * Settings Service — profile, notifications, skills and werkzeuge management.
 * Connects to FastAPI backend endpoints.
 *
 * Backend endpoints:
 *   GET    /auth/me                    — User profile
 *   GET    /notifications/settings     — Notification settings
 *   PUT    /notifications/settings     — Update notification settings
 *   POST   /notifications/test         — Send test notification
 *   GET    /notifications              — List notifications
 *   PUT    /notifications/{id}/read    — Mark notification read
 *   POST   /notifications/read-all     — Mark all read
 *   GET    /skills                     — List skills
 *   POST   /skills                     — Create skill
 *   PUT    /skills/{id}                — Update skill config
 *   DELETE /skills/{id}                — Delete skill
 *   GET    /werkzeuge                  — List MCP servers
 *   POST   /werkzeuge                  — Register MCP server
 *   PUT    /werkzeuge/{id}             — Update MCP server
 *   DELETE /werkzeuge/{id}             — Delete MCP server
 */

import { api } from "@/lib/api";
import type { UserMeResponse } from "@/lib/types/auth";

// ─── Notification Types ───

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  read: boolean;
  action_url: string | null;
  created_at: string | null;
}

export interface NotificationSettings {
  daily_briefing_enabled: boolean;
  daily_briefing_time: string;
  pre_meeting_enabled: boolean;
  pre_meeting_minutes: number;
  follow_up_enabled: boolean;
  follow_up_hours: number;
  deadline_warning_enabled: boolean;
  deadline_warning_hours: number;
  channels: Record<string, boolean>;
  telegram_chat_id: string | null;
}

export interface NotificationSettingsUpdate {
  daily_briefing_time?: string;
  pre_meeting_minutes?: number;
  channels?: Record<string, boolean>;
}

// ─── MCP / Werkzeuge Types ───

export interface McpToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface McpServer {
  id: string;
  name: string;
  description: string;
  transport_type: "stdio" | "sse" | "streamable_http";
  config: Record<string, unknown>;
  tools: (string | McpToolSchema)[];
  active: boolean;
  created_at: string | null;
}

export interface McpServerRequest {
  name: string;
  description?: string;
  transport_type: string;
  config?: Record<string, unknown>;
  tools?: string[];
}

export interface McpServerUpdateRequest {
  name?: string;
  description?: string;
  transport_type?: string;
  config?: Record<string, unknown>;
  tools?: string[];
  active?: boolean;
}

// ─── API Werkzeug Types ───

export interface ApiEndpointDef {
  name: string;
  description: string;
  method: string;
  path: string;
  parameters: Record<string, unknown>;
}

export interface ApiWerkzeug {
  id: string;
  name: string;
  description: string;
  base_url: string;
  auth: Record<string, unknown>;
  headers: Record<string, unknown>;
  endpoints: ApiEndpointDef[];
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApiWerkzeugRequest {
  name: string;
  description?: string;
  base_url: string;
  auth?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  endpoints?: ApiEndpointDef[];
}

export interface ApiWerkzeugUpdateRequest {
  name?: string;
  description?: string;
  base_url?: string;
  auth?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  endpoints?: ApiEndpointDef[];
  active?: boolean;
}

// ─── Skill Types ───

export interface SkillParameterDef {
  type: string;
  required: boolean;
  description: string;
}

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  active: boolean;
  autonomy_level: number;
  last_execution: string | null;
  execution_count: number;
  success_rate: number;
  parameters?: Record<string, SkillParameterDef>;
  skill_md?: string | null;
  category?: string | null;
  icon?: string | null;
  output_path?: string | null;
}

export interface SkillDetail {
  id: string;
  name: string;
  description: string;
  active: boolean;
  autonomy_level: number;
  config: Record<string, unknown>;
  parameters: Record<string, SkillParameterDef>;
  system_prompt: string;
  allowed_tools?: string[];
  is_custom?: boolean;
  skill_md?: string | null;
  category?: string | null;
  icon?: string | null;
  output_path?: string | null;
}

export interface SkillUpdateRequest {
  active?: boolean;
  autonomy_level?: number;
  config?: Record<string, unknown>;
  allowed_tools?: string[];
  skill_md?: string;
}

export interface SkillCreateRequest {
  name: string;
  description: string;
  system_prompt?: string;
  allowed_tools?: string[];
  parameters?: Record<string, SkillParameterDef>;
  metadata?: Record<string, string>;
  skill_md?: string;
}

export interface SkillExecuteRequest {
  input?: string;
  parameters?: Record<string, string>;
}

export interface SkillToolCall {
  name: string;
  input: Record<string, unknown>;
  round?: number;
}

export interface SkillExecutionResult {
  id: string;
  skill_id: string;
  status: string;
  output: string;
  duration_ms: number;
  tool_calls?: SkillToolCall[];
}

export interface SkillLogEntry {
  id: string;
  status: string;
  input_summary: string | null;
  output_summary: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string | null;
}

// ─── Skill Execution (Global History) Types ───

export interface SkillExecutionEntry {
  id: string;
  skill_id: string;
  skill_name: string;
  status: string;
  input_summary: string | null;
  output_summary: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string | null;
}

// ─── Skill Generation Types ───

export interface SkillGenerateMessage {
  role: string;
  content: string;
}

export interface SkillGenerateResponse {
  type: "question" | "skill_ready";
  message: string;
  skill?: SkillCreateRequest;
  messages: SkillGenerateMessage[];
}

// ─── Service ───

class SettingsService {
  // ── Profile ──

  async getProfile(): Promise<UserMeResponse> {
    return api.get<UserMeResponse>("/auth/me");
  }

  // ── Notifications ──

  async getNotifications(
    unreadOnly = false,
    limit = 20
  ): Promise<{ notifications: NotificationItem[] }> {
    const params = new URLSearchParams({
      limit: String(limit),
    });
    if (unreadOnly) params.set("unread_only", "true");
    return api.get<{ notifications: NotificationItem[] }>(
      `/notifications?${params}`
    );
  }

  async markNotificationRead(
    notificationId: string
  ): Promise<{ message: string }> {
    return api.put<{ message: string }>(
      `/notifications/${notificationId}/read`
    );
  }

  async markAllNotificationsRead(): Promise<{ message: string }> {
    return api.post<{ message: string }>("/notifications/read-all");
  }

  async getNotificationSettings(): Promise<{
    settings: NotificationSettings;
  }> {
    return api.get<{ settings: NotificationSettings }>(
      "/notifications/settings"
    );
  }

  async updateNotificationSettings(
    update: NotificationSettingsUpdate
  ): Promise<{ settings: NotificationSettings }> {
    return api.put<{ settings: NotificationSettings }>(
      "/notifications/settings",
      update
    );
  }

  async sendTestNotification(
    channel: string
  ): Promise<{ message: string }> {
    return api.post<{ message: string }>("/notifications/test", {
      channel,
    });
  }

  // ── Telegram Linking ──

  async createTelegramLink(): Promise<{
    code: string;
    expires_in: number;
    bot_name: string;
    bot_link: string;
    instruction: string;
  }> {
    return api.post("/notifications/telegram/link", {});
  }

  async disconnectTelegram(): Promise<{ message: string }> {
    return api.delete<{ message: string }>("/notifications/telegram/link");
  }

  // ── Skills ──

  async getSkills(): Promise<{ skills: SkillItem[] }> {
    return api.get<{ skills: SkillItem[] }>("/skills");
  }

  async getSkill(skillId: string): Promise<{ skill: SkillDetail }> {
    return api.get<{ skill: SkillDetail }>(`/skills/${skillId}`);
  }

  async updateSkill(
    skillId: string,
    update: SkillUpdateRequest
  ): Promise<{ skill: SkillItem }> {
    return api.put<{ skill: SkillItem }>(`/skills/${skillId}`, update);
  }

  async executeSkill(
    skillId: string,
    request: SkillExecuteRequest
  ): Promise<{ execution: SkillExecutionResult }> {
    return api.post<{ execution: SkillExecutionResult }>(
      `/skills/${skillId}/execute`,
      request
    );
  }

  async getSkillLogs(
    skillId: string,
    limit = 10
  ): Promise<{ logs: SkillLogEntry[] }> {
    return api.get<{ logs: SkillLogEntry[] }>(
      `/skills/${skillId}/logs?limit=${limit}`
    );
  }

  async getSkillExecutions(
    limit = 20,
    offset = 0
  ): Promise<{ executions: SkillExecutionEntry[]; total: number }> {
    return api.get<{ executions: SkillExecutionEntry[]; total: number }>(
      `/skills/executions?limit=${limit}&offset=${offset}`
    );
  }

  async createSkill(
    data: SkillCreateRequest
  ): Promise<{ skill: SkillDetail }> {
    return api.post<{ skill: SkillDetail }>("/skills", data);
  }

  async deleteSkill(skillId: string): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/skills/${skillId}`);
  }

  async generateSkill(
    messages: SkillGenerateMessage[]
  ): Promise<SkillGenerateResponse> {
    return api.post<SkillGenerateResponse>("/skills/generate", { messages });
  }

  async scheduleSkill(
    skillId: string,
    cronExpression: string,
    timezone = "Europe/Berlin",
    description = ""
  ): Promise<{ routine_id: string; name: string; cron: string }> {
    return api.post<{ routine_id: string; name: string; cron: string }>(
      `/skills/${skillId}/schedule`,
      { cron_expression: cronExpression, timezone, description }
    );
  }

  // ── Werkzeuge (MCP Servers) ──

  async getWerkzeuge(): Promise<{ werkzeuge: McpServer[] }> {
    return api.get<{ werkzeuge: McpServer[] }>("/werkzeuge");
  }

  async createWerkzeug(
    data: McpServerRequest
  ): Promise<{ werkzeug: McpServer; discovered_tools: number; discovery_error: string | null }> {
    return api.post<{ werkzeug: McpServer; discovered_tools: number; discovery_error: string | null }>("/werkzeuge", data);
  }

  async updateWerkzeug(
    id: string,
    data: McpServerUpdateRequest
  ): Promise<{ werkzeug: McpServer }> {
    return api.put<{ werkzeug: McpServer }>(`/werkzeuge/${id}`, data);
  }

  async deleteWerkzeug(id: string): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/werkzeuge/${id}`);
  }

  async discoverWerkzeugTools(
    id: string
  ): Promise<{ werkzeug: McpServer; discovered_tools: number }> {
    return api.post<{ werkzeug: McpServer; discovered_tools: number }>(
      `/werkzeuge/${id}/discover`
    );
  }

  async testWerkzeugConnection(
    id: string
  ): Promise<{
    success: boolean;
    tools_count: number;
    tools: string[];
    error: string | null;
  }> {
    return api.post<{
      success: boolean;
      tools_count: number;
      tools: string[];
      error: string | null;
    }>(`/werkzeuge/${id}/test`);
  }

  // ── API Werkzeuge ──

  async getApiWerkzeuge(): Promise<{ api_werkzeuge: ApiWerkzeug[] }> {
    return api.get<{ api_werkzeuge: ApiWerkzeug[] }>("/api-werkzeuge");
  }

  async createApiWerkzeug(
    data: ApiWerkzeugRequest
  ): Promise<{ api_werkzeug: ApiWerkzeug }> {
    return api.post<{ api_werkzeug: ApiWerkzeug }>("/api-werkzeuge", data);
  }

  async updateApiWerkzeug(
    id: string,
    data: ApiWerkzeugUpdateRequest
  ): Promise<{ api_werkzeug: ApiWerkzeug }> {
    return api.put<{ api_werkzeug: ApiWerkzeug }>(`/api-werkzeuge/${id}`, data);
  }

  async deleteApiWerkzeug(id: string): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/api-werkzeuge/${id}`);
  }

  async testApiWerkzeugConnection(
    id: string
  ): Promise<{ success: boolean; status_code: number | null; error: string | null }> {
    return api.post<{
      success: boolean;
      status_code: number | null;
      error: string | null;
    }>(`/api-werkzeuge/${id}/test`);
  }
}

export const settingsService = new SettingsService();
