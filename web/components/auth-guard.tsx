"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * AuthGuard — simplified for single-user mode.
 *
 * Checks setup status first. If no user exists, redirects to /setup.
 * Otherwise initializes user profile on mount, then renders children.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isInitialized, initialize } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch("/api/v1/auth/setup-status");
        const data = await res.json();
        if (!data.setup_complete) {
          router.replace("/setup");
          return;
        }
      } catch {
        // If check fails, continue to app (backend may be starting)
      }
      setCheckingSetup(false);
      initialize();
    }
    checkSetup();
  }, [initialize, router]);

  useEffect(() => {
    if (!checkingSetup && isInitialized && !isLoading) {
      setIsReady(true);
    }
  }, [checkingSetup, isInitialized, isLoading]);

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
