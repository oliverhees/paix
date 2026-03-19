"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * AuthGuard — simplified for single-user mode.
 *
 * Initializes user profile on mount, then renders children.
 * No login redirect — always shows the app.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isInitialized, initialize } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isInitialized && !isLoading) {
      setIsReady(true);
    }
  }, [isInitialized, isLoading]);

  if (!isReady) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: "#09090b" }}
      >
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        <p className="text-sm" style={{ color: "#a1a1aa" }}>
          Laden...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
