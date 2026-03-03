import { create } from "zustand";
import {
  settingsService,
  type NotificationSettings,
  type SkillItem,
} from "@/lib/settings-service";
import type { UserMeResponse } from "@/lib/types/auth";

// ─── State ───

interface SettingsState {
  // Profile
  profile: UserMeResponse | null;
  profileLoading: boolean;

  // Notification Settings
  notificationSettings: NotificationSettings | null;
  notificationSettingsLoading: boolean;

  // Skills
  skills: SkillItem[];
  skillsLoading: boolean;

  // General
  error: string | null;
  loadedFromApi: boolean;

  // Actions — Profile
  fetchProfile: () => Promise<void>;

  // Actions — Notification Settings
  fetchNotificationSettings: () => Promise<void>;
  updateNotificationSettings: (
    update: Partial<NotificationSettings>
  ) => Promise<void>;
  sendTestNotification: (channel: string) => Promise<void>;

  // Actions — Skills
  fetchSkills: () => Promise<void>;
  updateSkillAutonomy: (skillId: string, level: number) => Promise<void>;
  toggleSkillActive: (skillId: string) => Promise<void>;
}

// ─── Mock Fallback ───

const MOCK_PROFILE: UserMeResponse = {
  id: "mock-user-1",
  email: "oliver@hrcodelabs.de",
  name: "Oliver Hees",
  avatar_url: null,
  timezone: "Europe/Berlin",
  created_at: null,
  persona_name: null,
  persona_prompt: null,
};

const MOCK_NOTIFICATION_SETTINGS: NotificationSettings = {
  daily_briefing_enabled: true,
  daily_briefing_time: "07:30",
  pre_meeting_enabled: true,
  pre_meeting_minutes: 60,
  follow_up_enabled: false,
  follow_up_hours: 24,
  deadline_warning_enabled: true,
  deadline_warning_hours: 48,
  channels: {
    telegram: false,
    pwa_push: true,
    email: false,
  },
  telegram_chat_id: null,
};

const MOCK_SKILLS: SkillItem[] = [
  {
    id: "calendar_briefing",
    name: "Calendar & Briefing",
    description: "Proaktives Terminmanagement und taegliches Briefing",
    active: true,
    autonomy_level: 5,
    last_execution: null,
    execution_count: 0,
    success_rate: 0,
  },
  {
    id: "content_pipeline",
    name: "Content Pipeline",
    description: "LinkedIn und Blog Content erstellen und planen",
    active: true,
    autonomy_level: 2,
    last_execution: null,
    execution_count: 0,
    success_rate: 0,
  },
  {
    id: "meeting_prep",
    name: "Meeting Preparation",
    description: "Automatische Meeting-Vorbereitung mit Kontext",
    active: true,
    autonomy_level: 4,
    last_execution: null,
    execution_count: 0,
    success_rate: 0,
  },
  {
    id: "follow_up",
    name: "Follow-Up Tracker",
    description: "Offene Aufgaben und Follow-Ups verfolgen",
    active: true,
    autonomy_level: 3,
    last_execution: null,
    execution_count: 0,
    success_rate: 0,
  },
  {
    id: "idea_capture",
    name: "Idea Capture",
    description: "Ideen erfassen, kategorisieren und vernetzen",
    active: true,
    autonomy_level: 3,
    last_execution: null,
    execution_count: 0,
    success_rate: 0,
  },
];

// ─── Store ───

export const useSettingsStore = create<SettingsState>((set, get) => ({
  profile: null,
  profileLoading: false,
  notificationSettings: null,
  notificationSettingsLoading: false,
  skills: [],
  skillsLoading: false,
  error: null,
  loadedFromApi: false,

  // ── Profile ──

  fetchProfile: async () => {
    set({ profileLoading: true });
    try {
      const profile = await settingsService.getProfile();
      set({ profile, profileLoading: false, loadedFromApi: true });
    } catch (error) {
      console.warn("[Settings] Profile API unavailable, using mock:", error);
      set({ profile: MOCK_PROFILE, profileLoading: false });
    }
  },

  // ── Notification Settings ──

  fetchNotificationSettings: async () => {
    set({ notificationSettingsLoading: true });
    try {
      const response = await settingsService.getNotificationSettings();
      set({
        notificationSettings: response.settings,
        notificationSettingsLoading: false,
        loadedFromApi: true,
      });
    } catch (error) {
      console.warn(
        "[Settings] Notification settings API unavailable, using mock:",
        error
      );
      set({
        notificationSettings: MOCK_NOTIFICATION_SETTINGS,
        notificationSettingsLoading: false,
      });
    }
  },

  updateNotificationSettings: async (update) => {
    const current = get().notificationSettings;
    if (!current) return;

    // Optimistic update
    set({
      notificationSettings: { ...current, ...update },
    });

    try {
      const response = await settingsService.updateNotificationSettings(update);
      set({ notificationSettings: response.settings });
    } catch (error) {
      console.warn("[Settings] Failed to update notification settings:", error);
      // Optimistic update already applied
    }
  },

  sendTestNotification: async (channel) => {
    try {
      await settingsService.sendTestNotification(channel);
    } catch (error) {
      console.warn("[Settings] Failed to send test notification:", error);
    }
  },

  // ── Skills ──

  fetchSkills: async () => {
    set({ skillsLoading: true });
    try {
      const response = await settingsService.getSkills();
      set({ skills: response.skills, skillsLoading: false, loadedFromApi: true });
    } catch (error) {
      console.warn("[Settings] Skills API unavailable, using mock:", error);
      set({ skills: MOCK_SKILLS, skillsLoading: false });
    }
  },

  updateSkillAutonomy: async (skillId, level) => {
    // Optimistic update
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === skillId ? { ...s, autonomy_level: level } : s
      ),
    }));

    try {
      await settingsService.updateSkill(skillId, { autonomy_level: level });
    } catch (error) {
      console.warn(`[Settings] Failed to update skill ${skillId}:`, error);
    }
  },

  toggleSkillActive: async (skillId) => {
    const skill = get().skills.find((s) => s.id === skillId);
    if (!skill) return;

    const newActive = !skill.active;

    // Optimistic update
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === skillId ? { ...s, active: newActive } : s
      ),
    }));

    try {
      await settingsService.updateSkill(skillId, { active: newActive });
    } catch (error) {
      console.warn(`[Settings] Failed to toggle skill ${skillId}:`, error);
    }
  },
}));
