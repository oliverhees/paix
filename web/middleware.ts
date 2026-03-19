/**
 * Next.js Middleware — single-user mode, no auth checks.
 *
 * Redirects /login and /register to / since there is no login.
 * Sets cache headers to prevent stale page caching.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Static/API paths that should be ignored by middleware. */
const IGNORED_PREFIXES = [
  "/api/",
  "/_next/",
  "/favicon.ico",
  "/manifest.json",
  "/images/",
  "/icons/",
];

/** Old auth routes that should redirect to home. */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

/** Routes that are always publicly accessible (no auth/redirect checks). */
const PUBLIC_ROUTES = ["/setup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets and API routes
  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow public routes through without any checks
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Redirect old auth routes to dashboard
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Set cache headers
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
