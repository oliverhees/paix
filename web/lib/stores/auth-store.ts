/**
 * Auth Store — simplified for single-user mode.
 *
 * Always authenticated. Loads user profile from API on init.
 */

import { create } from "zustand";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/types/auth";

interface AuthState {
  /** The user profile. */
  user: AuthUser | null;
  /** Whether we are currently loading the user profile. */
  isLoading: boolean;
  /** Whether the initial load has completed. */
  isInitialized: boolean;
  /** Last error message. */
  error: string | null;

  /** Always true in single-user mode. */
  isAuthenticated: () => boolean;

  /** Load user profile from API. Call on app mount. */
  initialize: () => Promise<void>;

  /** Clear any error message. */
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  isAuthenticated: () => true,

  initialize: async () => {
    if (get().isInitialized) return;

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
      // Even on error, mark as initialized — single user mode
      set({
        user: null,
        isLoading: false,
        isInitialized: true,
        error: "Could not load user profile",
      });
    }
  },

  clearError: () => set({ error: null }),
}));
