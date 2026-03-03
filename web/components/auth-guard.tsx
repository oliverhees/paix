"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * AuthGuard — client-side authentication guard for protected routes.
 *
 * Renders children only when the user is authenticated.
 * Redirects to /login if not authenticated after initialization.
 * Includes error handling and timeout to prevent white page on slow/failed auth.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, isInitialized, initialize } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const init = async () => {
      try {
        await initialize();
      } catch (err) {
        console.error("[AuthGuard] Initialization failed:", err);
        if (!resolvedRef.current) {
          setError("Authentifizierung fehlgeschlagen");
        }
      }
    };

    init();

    // Timeout: if auth check takes > 10s, something is wrong
    timeout = setTimeout(() => {
      if (!resolvedRef.current) {
        console.error("[AuthGuard] Initialization timeout");
        setError("Verbindung zum Server dauert zu lange");
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized || isLoading) return;

    resolvedRef.current = true;
    if (!user) {
      router.replace("/login");
    } else {
      setIsReady(true);
    }
  }, [user, isInitialized, isLoading, router]);

  if (error) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-4"
        style={{ backgroundColor: "#09090b", color: "#fafafa" }}
      >
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Seite neu laden
        </button>
      </div>
    );
  }

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
