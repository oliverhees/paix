# Decision Log: Auth + API Client Layer

**Date**: 2026-02-26
**Mission**: Auth + API Client Layer for PAI-X Frontend

## Decisions Made

### 1. Template Choice: v2 (Card-based) over v1 (Split-screen)
**Decision**: Used the Card-based login/register template (v2) instead of the split-screen with image (v1).
**Reason**: v2 is cleaner, more minimal, and doesn't require image assets. Better fit for a personal AI assistant.

### 2. Token Storage: localStorage
**Decision**: Store JWT tokens in localStorage (not httpOnly cookies).
**Reason**: The existing API client already uses Bearer token auth. Using cookies would require changing the backend CORS/cookie setup. localStorage is simpler and works with the existing architecture. The trade-off is XSS vulnerability, but the app doesn't accept untrusted user content.

### 3. Auth Guard: Client-Side (not Middleware)
**Decision**: Primary auth protection is via client-side AuthGuard component, not Next.js middleware.
**Reason**: Since tokens are in localStorage, the server (middleware) cannot access them. Middleware is kept as a pass-through for now. AuthGuard wraps the dashboard layout and handles redirect logic.

### 4. Register does NOT auto-login
**Decision**: After registration, user is redirected to /login. No auto-login.
**Reason**: Matches the backend API design (register returns user data, not tokens). Explicit login after register is a better UX pattern for security.

### 5. Token Refresh: Automatic + Deduplicated
**Decision**: 401 responses automatically trigger a token refresh using the stored refresh_token. Concurrent refresh requests are deduplicated.
**Reason**: Prevents multiple simultaneous refreshes which would invalidate each other. Standard production pattern.

### 6. Removed OAuth Buttons (Google/GitHub)
**Decision**: Removed the Google and GitHub OAuth buttons from the template.
**Reason**: Backend does not support OAuth. Only email/password auth is available. Adding non-functional buttons would be misleading.

### 7. Auth Store in lib/stores/ (not root store/)
**Decision**: Placed auth-store.ts in lib/stores/ alongside existing chat-store.ts and telos-store.ts.
**Reason**: Following existing project convention. All Zustand stores are in lib/stores/.
