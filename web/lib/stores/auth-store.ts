/**
 * Auth Store — Zustand store for authentication state.
 *
 * Manages user session, login/register/logout flows,
 * and token lifecycle with the PAI-X API.
 */

import { create } from "zustand";
import { api, ApiClientError } from "@/lib/api";
import type { AuthUser } from "@/lib/types/auth";

interface AuthState {
  /** The authenticated user, or null if not logged in. */
  user: AuthUser | null;
  /** Whether we are currently checking/restoring the session. */
  isLoading: boolean;
  /** Whether the initial session check has completed. */
  isInitialized: boolean;
  /** Last auth error message. */
  error: string | null;

  // ─── Computed ───
  /** Whether the user is currently authenticated. */
  isAuthenticated: () => boolean;

  // ─── Actions ───
  /**
   * Initialize auth state — check if we have a valid token
   * and load the user profile. Call this on app mount.
   */
  initialize: () => Promise<void>;

  /**
   * Login with email and password.
   */
  login: (email: string, password: string) => Promise<void>;

  /**
   * Register a new account. Does NOT auto-login.
   */
  register: (email: string, password: string, name: string) => Promise<void>;

  /**
   * Logout — clear tokens and user state.
   */
  logout: () => Promise<void>;

  /**
   * Clear any error message.
   */
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  isAuthenticated: () => get().user !== null,

  initialize: async () => {
    // Don't re-initialize if already done
    if (get().isInitialized) return;

    // Only attempt if we have tokens stored
    if (!api.hasTokens()) {
      set({ isInitialized: true, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const me = await api.getMe();
      set({
        user: {
          id: me.id,
          email: me.email,
          name: me.name,
          avatar_url: me.avatar_url,
          timezone: me.timezone,
        },
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch {
      // Token invalid or expired — clear everything
      api.clearTokens();
      set({
        user: null,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.login({ email, password });
      // Fetch user profile after successful login
      const me = await api.getMe();
      set({
        user: {
          id: me.id,
          email: me.email,
          name: me.name,
          avatar_url: me.avatar_url,
          timezone: me.timezone,
        },
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.detail
          : "An unexpected error occurred.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.register({ email, password, name });
      set({ isLoading: false, error: null });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.detail
          : "An unexpected error occurred.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await api.logout();
    } finally {
      set({
        user: null,
        isLoading: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
