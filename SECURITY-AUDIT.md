# PAI-X Security Audit

**Date:** 2026-02-27
**Auditor:** Team 6 (Automated)
**Scope:** Full-stack application (FastAPI backend + Next.js frontend)

---

## 1. Dependency Audit

### Python Dependencies (api/)

| Package | Required Version | Known Issues |
|---------|-----------------|--------------|
| fastapi | >=0.115.0 | No known CVEs in this range |
| pydantic | >=2.0 | No known CVEs |
| pydantic-settings | >=2.0 | No known CVEs |
| sqlalchemy | >=2.0 | No known CVEs |
| asyncpg | >=0.29.0 | No known CVEs |
| bcrypt | >=4.0 | No known CVEs. Direct usage (not via passlib) -- GOOD |
| python-jose | >=3.3 | INFO: python-jose is in maintenance mode. Consider migrating to PyJWT for long-term support |
| passlib | >=1.7 | INFO: passlib is listed in requirements but not used in code (bcrypt is used directly). Can be removed |
| httpx | >=0.27 | No known CVEs |
| redis | >=5.0 | No known CVEs |
| celery | >=5.3 | No known CVEs |
| anthropic | >=0.25 | No known CVEs |
| langchain | >=0.2 | No known CVEs |
| langgraph | >=0.2 | No known CVEs |
| graphiti-core | >=0.3 | No known CVEs |

### NPM Dependencies (web/)

```
npm audit result: 0 vulnerabilities
Total dependencies: 635 (260 prod, 337 dev, 81 optional)
```

**Status: CLEAN** -- No known vulnerabilities in npm dependency tree.

---

## 2. Authentication Security Review

### 2.1 JWT Configuration

| Setting | Value | Assessment |
|---------|-------|------------|
| JWT Secret | `"change-me-in-production"` (default) | **MEDIUM** -- Default secret is insecure |
| Algorithm | HS256 | OK for single-service architecture |
| Access Token Expiry | 30 minutes | GOOD -- standard value |
| Refresh Token Expiry | 7 days | OK -- within acceptable range |
| Token Type Validation | Yes (`type: "access"` / `"refresh"`) | GOOD |
| JTI (JWT ID) | Included in both token types | GOOD -- enables future token revocation |

### 2.2 JWT Secret Finding

**MEDIUM** | Default JWT secret `"change-me-in-production"` is used when `JWT_SECRET` env var is not set.

- **File:** `api/config.py`, line 39
- **Risk:** If deployed without setting the environment variable, all tokens are signed with a known secret. Any attacker could forge valid JWTs.
- **Recommendation:** Enforce a non-default secret at startup. Add a startup check that raises an error if `jwt_secret == "change-me-in-production"` and `environment != "development"`.

### 2.3 Password Hashing

**GOOD** -- bcrypt is used directly via the `bcrypt` library (not passlib wrapper).

- `hash_password()` uses `bcrypt.gensalt()` with default work factor (12 rounds)
- `verify_password()` uses `bcrypt.checkpw()` for constant-time comparison
- Passwords are never logged or returned in responses
- Minimum password length enforced: 8 characters (`min_length=8`)
- Maximum password length enforced: 128 characters (`max_length=128`) -- prevents bcrypt DoS

### 2.4 Token Storage (Frontend)

**LOW** | JWT tokens are stored in `localStorage`.

- **Files:** `web/lib/api.ts`, lines 56-57, 69, 74, 86-87
- **Keys:** `pai_access_token`, `pai_refresh_token`
- **Risk:** localStorage is accessible to any JavaScript running on the page. If an XSS vulnerability exists, tokens can be stolen.
- **Mitigation:** React auto-escapes by default. Only one instance of `dangerouslySetInnerHTML` found (see XSS section).
- **Recommendation:** For higher security, consider httpOnly cookies with SameSite=Strict. This would require a BFF (Backend-for-Frontend) pattern or proxy.

### 2.5 Token Refresh Mechanism

**GOOD** -- Well-implemented refresh flow.

- Refresh tokens are stored in the `auth_sessions` database table
- Server-side revocation: logout deletes all refresh tokens for the user
- Expiry is checked both in JWT claims AND in the database record
- Concurrent refresh requests are deduplicated (client-side `refreshPromise` guard)
- Failed refresh clears all tokens and forces re-login

### 2.6 CORS Configuration

**INFO** | CORS is configured for development origins only.

```python
cors_origins: list[str] = [
    "http://localhost:3000",
    "http://localhost:80",
]
```

- `allow_credentials=True` -- allows cookies/auth headers
- `allow_methods=["*"]` -- allows all HTTP methods
- `allow_headers=["*"]` -- allows all headers
- **Recommendation:** For production, restrict `cors_origins` to actual production domain(s). Consider restricting `allow_methods` and `allow_headers` to only what is needed.

### 2.7 Rate Limiting

**MEDIUM** | No rate limiting is implemented on any endpoint.

- **Risk:** The `/auth/login` endpoint is vulnerable to brute-force attacks. An attacker can attempt unlimited password guesses.
- **Risk:** The `/auth/register` endpoint allows unlimited account creation.
- **Recommendation:** Add rate limiting middleware (e.g., `slowapi` or custom Redis-based limiter). Suggested limits:
  - `/auth/login`: 5 attempts per minute per IP
  - `/auth/register`: 3 registrations per hour per IP
  - `/chat`: 60 requests per minute per user

---

## 3. OWASP Top 10 Quick Check

### 3.1 A01:2021 -- Broken Access Control

| Check | Status | Notes |
|-------|--------|-------|
| Auth on protected routes | GOOD | All protected endpoints use `Depends(get_current_user)` |
| User data isolation | GOOD | Chat sessions check `session.user_id != user.id` |
| Admin/role separation | N/A | No admin roles implemented yet |
| Internal API protection | GOOD | Internal endpoints require `X-Internal-Key` header |
| 401/403 handling | GOOD | Proper status codes with `WWW-Authenticate` header |

### 3.2 A02:2021 -- Cryptographic Failures

| Check | Status | Notes |
|-------|--------|-------|
| Password hashing | GOOD | bcrypt with default 12 rounds |
| JWT signing | GOOD (if secret is changed) | HS256 with configurable secret |
| TLS/HTTPS | N/A | Handled at infrastructure layer (nginx/Coolify) |
| Sensitive data in responses | GOOD | Password hashes never returned |

### 3.3 A03:2021 -- Injection

| Check | Status | Notes |
|-------|--------|-------|
| SQL Injection | GOOD | SQLAlchemy ORM with parameterized queries throughout |
| NoSQL Injection | N/A | No direct NoSQL usage (Graphiti abstracts FalkorDB) |
| Command Injection | GOOD | No shell commands or subprocess calls |
| Template Injection | N/A | No server-side templates |

### 3.4 A04:2021 -- Insecure Design

| Check | Status | Notes |
|-------|--------|-------|
| Input validation | GOOD | Pydantic models validate all request bodies |
| Email validation | GOOD | `EmailStr` type used for email fields |
| Error messages | GOOD | Login returns generic "Invalid email or password" (no user enumeration) |
| Account deactivation | GOOD | `is_active` check on login and token validation |

### 3.5 A05:2021 -- Security Misconfiguration

| Check | Status | Notes |
|-------|--------|-------|
| Debug mode | INFO | `debug=True` default exposes Swagger UI at `/api/v1/docs` |
| Default credentials | MEDIUM | JWT secret has insecure default (see 2.2) |
| CORS | INFO | Localhost-only origins (see 2.6) |
| Error details | GOOD | No stack traces leaked to clients |

### 3.6 A06:2021 -- Vulnerable and Outdated Components

| Check | Status | Notes |
|-------|--------|-------|
| Python deps | GOOD | No known CVEs |
| NPM deps | GOOD | `npm audit` reports 0 vulnerabilities |
| python-jose | INFO | In maintenance mode; consider PyJWT migration |
| passlib | INFO | Listed but unused; can be removed |

### 3.7 A07:2021 -- Identification and Authentication Failures

| Check | Status | Notes |
|-------|--------|-------|
| Brute force protection | MISSING | No rate limiting on login (see 2.7) |
| Password policy | GOOD | 8-128 chars enforced |
| Session management | GOOD | Refresh tokens stored in DB, revocable |
| Multi-factor auth | N/A | Not implemented |

### 3.8 A08:2021 -- Software and Data Integrity Failures

| Check | Status | Notes |
|-------|--------|-------|
| JWT integrity | GOOD | Tokens are signed and verified |
| CI/CD security | N/A | Not reviewed in this audit |
| Dependency integrity | GOOD | package-lock.json present |

### 3.9 A09:2021 -- Security Logging and Monitoring Failures

| Check | Status | Notes |
|-------|--------|-------|
| Auth event logging | LOW | No explicit logging of login attempts, failures, or token refreshes |
| Audit trail | MISSING | No audit log for sensitive operations |
| Error logging | INFO | Exceptions are silently caught in many places (`except Exception: pass`) |

### 3.10 A10:2021 -- Server-Side Request Forgery (SSRF)

| Check | Status | Notes |
|-------|--------|-------|
| External service calls | LOW | Graphiti service URL is configurable via env var; ensure it points to trusted hosts only |
| User-controlled URLs | GOOD | No user-provided URLs are fetched server-side |

---

## 4. XSS Analysis

### dangerouslySetInnerHTML Usage

**LOW** | Found 1 instance in application code:

- **File:** `web/components/ui/custom/prompt/code-block.tsx`, line 62
- **Context:** Renders syntax-highlighted code blocks using the `shiki` library
- **Risk:** If the `highlightedHtml` value contains unsanitized user input, XSS is possible
- **Mitigation:** Shiki is a well-known syntax highlighter that HTML-escapes code content before highlighting. Risk is low as long as only code content (not arbitrary HTML) is passed to the highlighter.
- **Recommendation:** Verify that the input to the Shiki highlighter is always code content from chat responses, never raw user HTML input.

### React Auto-Escaping

**GOOD** -- React auto-escapes all JSX expressions by default. No other instances of `dangerouslySetInnerHTML` found in application code (only in `node_modules` and `.next` build output).

---

## 5. Findings Summary

| # | Severity | Finding | Recommendation |
|---|----------|---------|----------------|
| 1 | **MEDIUM** | JWT secret defaults to `"change-me-in-production"` | Add startup check that blocks boot with default secret in non-dev environments |
| 2 | **MEDIUM** | No rate limiting on auth endpoints | Add `slowapi` or Redis-based rate limiter (5 login attempts/min/IP) |
| 3 | **LOW** | JWT tokens stored in localStorage (XSS-accessible) | Consider httpOnly cookies for token storage |
| 4 | **LOW** | No security event logging (login attempts, failures) | Add structured logging for auth events |
| 5 | **LOW** | 1x `dangerouslySetInnerHTML` in code-block component | Verify Shiki output is properly escaped |
| 6 | **LOW** | Silent exception handling (`except Exception: pass`) in multiple endpoints | Add proper error logging; avoid swallowing exceptions silently |
| 7 | **INFO** | Swagger UI exposed when `debug=True` (default) | Ensure `DEBUG=false` in production |
| 8 | **INFO** | CORS configured for localhost only | Add production origins before deployment |
| 9 | **INFO** | `python-jose` in maintenance mode | Plan migration to `PyJWT` |
| 10 | **INFO** | `passlib` in requirements.txt but unused | Remove to reduce dependency surface |

---

## 6. Overall Assessment

**Risk Level: LOW-MEDIUM**

The application follows security best practices in most areas:
- Proper password hashing with bcrypt
- Parameterized SQL queries via SQLAlchemy ORM
- JWT with type validation and refresh token rotation
- Server-side refresh token revocation
- Pydantic input validation on all endpoints
- React XSS auto-escaping

The two MEDIUM findings (default JWT secret and missing rate limiting) should be addressed before production deployment. Neither is exploitable in a development environment with no external access.

No CRITICAL or HIGH severity findings were identified.
