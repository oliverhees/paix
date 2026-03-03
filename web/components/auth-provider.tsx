"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";

/** Public routes that don't require authentication. */
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];

/**
 * AuthProvider — initializes auth state on mount and redirects
 * unauthenticated users to /login for protected routes.
 *
 * Wrap this around any layout that needs authentication.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isInitialized, initialize } = useAuthStore();

  // Initialize auth state on first mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Redirect logic after initialization
  useEffect(() => {
    if (!isInitialized || isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (!user && !isPublicRoute) {
      // Not logged in, on a protected route -> redirect to login
      router.replace("/login");
    } else if (user && isPublicRoute) {
      // Logged in, on a public route -> redirect to dashboard
      router.replace("/");
    }
  }, [user, isInitialized, isLoading, pathname, router]);

  // Show nothing while checking auth (prevents flash of wrong content)
  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
