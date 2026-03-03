import { create } from "zustand";

interface UIState {
  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Whether the mobile sidebar sheet is open */
  mobileSidebarOpen: boolean;
  /** Active theme: system, light, or dark */
  activeTheme: "system" | "light" | "dark";
  /** Number of unread notifications */
  notificationCount: number;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setActiveTheme: (theme: "system" | "light" | "dark") => void;
  setNotificationCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  activeTheme: "dark",
  notificationCount: 3,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

  setActiveTheme: (theme) => set({ activeTheme: theme }),

  setNotificationCount: (count) => set({ notificationCount: count }),
}));
