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

export interface McpServer {
  id: string;
  name: string;
  description: string;
  transport_type: "stdio" | "sse" | "streamable_http";
  config: Record<string, unknown>;
  tools: string[];
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

export interface SkillExecutionResult {
  id: string;
  skill_id: string;
  status: string;
  output: string;
  duration_ms: number;
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

  // ── Werkzeuge (MCP Servers) ──

  async getWerkzeuge(): Promise<{ servers: McpServer[] }> {
    return api.get<{ servers: McpServer[] }>("/werkzeuge");
  }

  async createWerkzeug(
    data: McpServerRequest
  ): Promise<{ server: McpServer }> {
    return api.post<{ server: McpServer }>("/werkzeuge", data);
  }

  async updateWerkzeug(
    id: string,
    data: McpServerUpdateRequest
  ): Promise<{ server: McpServer }> {
    return api.put<{ server: McpServer }>(`/werkzeuge/${id}`, data);
  }

  async deleteWerkzeug(id: string): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/werkzeuge/${id}`);
  }
}

export const settingsService = new SettingsService();
