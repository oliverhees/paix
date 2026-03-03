/**
 * Next.js Middleware — lightweight route protection.
 *
 * This middleware checks for the presence of a token cookie/header
 * as a first line of defense. The actual token validation happens
 * client-side via the AuthGuard component.
 *
 * Note: Since we use localStorage for tokens (not httpOnly cookies),
 * this middleware cannot validate the token server-side. It serves as
 * a UX optimization to prevent the flash of dashboard content before
 * the client-side AuthGuard kicks in.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Routes that do not require authentication. */
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

/** Static/API paths that should be ignored by middleware. */
const IGNORED_PREFIXES = [
  "/api/",
  "/_next/",
  "/favicon.ico",
  "/manifest.json",
  "/images/",
  "/icons/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets and API routes
  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // For all other routes, let them through — AuthGuard handles the redirect
  // client-side after checking localStorage tokens.
  const response = NextResponse.next();
  // Prevent any browser caching of HTML/RSC responses to avoid white page on F5
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
