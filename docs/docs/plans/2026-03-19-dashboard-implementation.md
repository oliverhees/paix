# PAIONE Dashboard — Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete AI Operating System dashboard with 15 views, real-time monitoring, and human-readable status for non-technical users.

**Architecture:** React 19 SPA (Vite + shadcn/ui) communicates with Express backend via REST + WebSocket. Real-time events (logs, tasks, status) stream over WebSocket. Each view is a standalone React component in `SYSTEM/ui/src/components/views/`. Backend API endpoints in `SYSTEM/src/ui/server.ts`. All status messages are human-readable — translated via i18n system.

**Tech Stack:** React 19, Vite, Tailwind v4, shadcn/ui, WebSocket (native), Lucide icons, Express REST API

**Reference Projects:**
- OpenClaw Mission Control (design patterns for Tasks, Calendar, Memory, Team, Feedback)
- PAIX `/media/oliver/Platte 2 (Netac)2/Eigene Projekte/paix/web/` (code patterns for TELOS, Skills, Werkzeuge, Routines, Settings, Marketplace)

---

## Current State

### What exists (DONE):
- Dashboard shell: Sidebar (14 nav items, collapsible), Chat View with session panel, Placeholder views
- Backend: 165 tests, config, db, providers, channels, hooks, i18n, assembler, TELOS, Graphiti
- API endpoints: `/api/health`, `/api/config`, `/api/sessions`, `/api/messages/:id`, `/api/setup/status`, `/api/setup/complete`
- WebSocket: `WebSocketChatServer` with session tracking, streaming, rate limiting
- shadcn/ui components installed: sidebar, tooltip, scroll-area, tabs, separator, badge, input, textarea, dialog, dropdown-menu, avatar, card, sheet, skeleton

### What's needed:
- 13 new view components (Overview, TELOS, Persona, Skills, Routines, MCP, Settings, Files, Graphiti, Channels, Agents, Marketplace, Feedback)
- 2 enhanced views (Logs, Task Board — highest priority)
- ~25 new API endpoints
- WebSocket event system for real-time updates
- Human-readable log translation layer
- Status badge system across all sidebar items

---

## Sprint 0: Infrastructure (WebSocket Events + API Foundation)

> **Must complete before any view work.** This provides the real-time backbone all views depend on.

### Task 0.1: WebSocket Event System

**Files:**
- Create: `SYSTEM/src/ui/ws-events.ts` — Event types, broadcast helpers
- Modify: `SYSTEM/src/ui/websocket.ts` — Add event broadcasting
- Create: `SYSTEM/ui/src/hooks/use-ws-events.ts` — React hook for consuming events
- Create: `SYSTEM/ui/src/lib/api.ts` — REST API client

**What it does:** Extends the existing WebSocketChatServer to broadcast system events (log entries, task updates, status changes) to all connected dashboard clients. The React hook subscribes to specific event types.

**Event types:**
```typescript
type WsEventType =
  | 'log'           // New log entry
  | 'task_update'   // Task status changed
  | 'status'        // System status change
  | 'session_update'// Chat session changed
  | 'cost_update'   // Cost tracking
  | 'channel_status'// Channel connected/disconnected
  | 'agent_update'  // Agent started/stopped
  | 'notification'  // User notification
```

- [ ] Step 1: Create `ws-events.ts` with event type definitions and `broadcastEvent()` helper
- [ ] Step 2: Modify `WebSocketChatServer` to support event broadcasting alongside chat messages
- [ ] Step 3: Create React hook `useWsEvents(eventType)` that returns latest events
- [ ] Step 4: Create `api.ts` REST client with typed endpoints
- [ ] Step 5: Test: verify events broadcast to connected clients
- [ ] Step 6: Commit

### Task 0.2: Human-Readable Log Translation

**Files:**
- Create: `SYSTEM/src/ui/log-translator.ts` — Translates technical logs to human-readable
- Modify: `SYSTEM/src/hooks/engine.ts` — Emit log events on hook fire
- Add to: `SYSTEM/src/i18n/locales/en.json` + `de.json` — Log message translations

**What it does:** Every system event (hook fired, provider called, extraction started, etc.) gets translated to a human-readable message. "Context assembly started" → "PAIONE is preparing your conversation context...". Emitted as WebSocket 'log' events.

**Translation examples:**
```
[TECHNICAL]                          → [HUMAN-READABLE]
PRE_PROCESS hook fired               → "Processing your message..."
assembleContext started               → "Preparing conversation context..."
Anthropic completion started          → "PAIONE is thinking..."
Anthropic completion finished         → "Response ready"
Graphiti extraction started           → "Saving to memory..."
POST_RESPONSE hook fired              → "Learning from conversation..."
Error: provider failed                → "Something went wrong — retrying..."
```

- [ ] Step 1: Create `log-translator.ts` with translation map (EN + DE)
- [ ] Step 2: Add human-readable log keys to i18n locale files
- [ ] Step 3: Wire hook engine to emit translated log events via WebSocket
- [ ] Step 4: Wire orchestrator pipeline stages to emit status events
- [ ] Step 5: Test: send message, verify human-readable log events arrive
- [ ] Step 6: Commit

### Task 0.3: Status Badge System

**Files:**
- Create: `SYSTEM/src/ui/status-monitor.ts` — Tracks system component health
- Create: `SYSTEM/ui/src/components/layout/StatusBadge.tsx` — Dot indicator component
- Modify: `SYSTEM/ui/src/components/layout/AppSidebar.tsx` — Add badges to nav items

**What it does:** Each sidebar nav item shows a colored dot indicating component health:
- 🟢 Green = healthy/active
- 🟡 Yellow = degraded/warning
- 🔴 Red = error/offline
- ⚪ Gray = inactive/not configured

Status is determined server-side and pushed via WebSocket `status` events.

**Status map:**
```
Chat       → always green (WebSocket connected)
Overview   → green (API healthy)
Persona    → green if files exist, gray if empty
TELOS      → green if files exist, gray if empty
Knowledge  → green if Graphiti healthy, gray if offline
Agents     → green if running, gray if none
Skills     → green if skills loaded
Routines   → green if scheduler active
Channels   → green if connected, yellow if partial, gray if none
Tools      → green if MCP configured
Files      → always green
Settings   → always green
Logs       → always green (streaming)
```

- [ ] Step 1: Create `status-monitor.ts` that checks each component's health
- [ ] Step 2: Create `StatusBadge.tsx` component (colored dot, 3 sizes)
- [ ] Step 3: Add status badges to sidebar nav items
- [ ] Step 4: Wire status-monitor to emit WebSocket status events every 10s
- [ ] Step 5: Create `useSystemStatus()` hook in React
- [ ] Step 6: Test: verify badges render and update
- [ ] Step 7: Commit

### Task 0.4: Additional API Endpoints

**Files:**
- Modify: `SYSTEM/src/ui/server.ts` — Add all new endpoints
- Create: `SYSTEM/src/ui/api-routes.ts` — Extracted route handlers for cleanliness

**New endpoints (grouped by view):**
```
# Overview
GET  /api/stats              → { sessions, messages, costs, uptime, tokens }

# Logs
GET  /api/logs               → Recent log entries (paginated)
GET  /api/logs/stream        → SSE stream of live logs (alternative to WS)

# Tasks
GET  /api/tasks              → All tasks with status
POST /api/tasks              → Create task
PUT  /api/tasks/:id          → Update task status
DELETE /api/tasks/:id        → Delete task

# Persona
GET  /api/persona            → All 5 persona files content
PUT  /api/persona/:file      → Update one persona file

# TELOS
GET  /api/telos              → All 10 dimension files
PUT  /api/telos/:dimension   → Update one dimension

# Skills
GET  /api/skills             → List installed skills
POST /api/skills/:name/run   → Execute a skill

# Routines
GET  /api/routines           → List scheduled routines
POST /api/routines           → Create routine
PUT  /api/routines/:id       → Update routine
DELETE /api/routines/:id     → Delete routine

# MCP/Tools
GET  /api/tools              → List configured MCP servers
POST /api/tools              → Add MCP server
PUT  /api/tools/:id          → Update MCP server config
DELETE /api/tools/:id        → Remove MCP server

# Settings
GET  /api/settings           → All settings
PUT  /api/settings           → Update settings batch

# Files
GET  /api/files/*            → Read file/directory
PUT  /api/files/*            → Write file

# Channels
GET  /api/channels           → Channel status list
POST /api/channels/:name/connect    → Connect channel
POST /api/channels/:name/disconnect → Disconnect channel

# Graphiti
GET  /api/knowledge/search   → Search knowledge graph
GET  /api/knowledge/facts    → List recent facts
GET  /api/knowledge/stats    → Graph statistics

# Agents
GET  /api/agents             → Running agents
POST /api/agents             → Spawn agent
DELETE /api/agents/:id       → Stop agent
```

- [ ] Step 1: Create `api-routes.ts` with route handler functions
- [ ] Step 2: Wire Stats endpoint (aggregate from db)
- [ ] Step 3: Wire Persona CRUD endpoints (read/write USER/groups/persona/)
- [ ] Step 4: Wire TELOS CRUD endpoints (read/write USER/groups/telos/)
- [ ] Step 5: Wire Settings endpoints (from db settings table)
- [ ] Step 6: Wire Files endpoints (fs read/write with path validation)
- [ ] Step 7: Wire remaining endpoints as stubs (return mock data for now)
- [ ] Step 8: Test: verify each endpoint returns expected shape
- [ ] Step 9: Commit

---

## Sprint 1: Tier 1 — Real-Time Monitoring Core

> **The heart of the dashboard.** These 3 views make PAIONE feel alive.

### Task 1.1: Live Logs View

**Files:**
- Create: `SYSTEM/ui/src/components/views/LogsView.tsx`

**Design (from OpenClaw + custom):**
```
┌─────────────────────────────────────────────────────┐
│ 📋 Live Logs                    [Filter ▾] [Clear]  │
├─────────────────────────────────────────────────────┤
│ ● Connected — streaming live                        │
│─────────────────────────────────────────────────────│
│ 14:23:01  ✅  Response ready                    ai  │
│ 14:23:00  🧠  PAIONE is thinking...           ai  │
│ 14:22:59  📝  Processing your message...     hook  │
│ 14:22:58  💬  New message received           chat  │
│ 14:22:45  🧠  Saving to memory...         graphiti │
│ 14:22:30  ✅  System check passed           system │
│ ...                                                 │
│─────────────────────────────────────────────────────│
│ Filters: [All] [AI] [Chat] [System] [Errors]       │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Auto-scrolling log feed (WebSocket `log` events)
- Color-coded levels: info=blue, success=green, warn=yellow, error=red
- Emoji icons per category (AI 🧠, Chat 💬, System ⚙️, Memory 🧠, Error ❌)
- Filter by category tabs
- Human-readable messages (not raw technical logs)
- Timestamp column
- Module badge column
- Clear button, pause/resume auto-scroll
- "Connected" / "Disconnected" status indicator

- [ ] Step 1: Create LogsView.tsx with header (title, filter buttons, clear)
- [ ] Step 2: Add WebSocket connection via `useWsEvents('log')`
- [ ] Step 3: Render log entries with timestamp, icon, message, module badge
- [ ] Step 4: Implement auto-scroll with pause on manual scroll-up
- [ ] Step 5: Add filter tabs (All, AI, Chat, System, Errors)
- [ ] Step 6: Add connection status indicator
- [ ] Step 7: Wire to Shell router
- [ ] Step 8: Playwright screenshot verify
- [ ] Step 9: Commit

### Task 1.2: Task Board View (Kanban)

**Files:**
- Create: `SYSTEM/ui/src/components/views/TaskBoardView.tsx`

**Design (from OpenClaw Tasks screenshot):**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📊  0 This week  3 In progress  29 Total  34% Completion       │
│ [+ New Task]  [Agent: All ▾]  [Project: All ▾]                 │
├───────────────┬───────────────┬───────────────┬─────────────────┤
│ ● Backlog (4) │ ● In Progress │ ● Done (22)   │ Live Activity   │
│               │   (3)         │               │                 │
│ ┌───────────┐ │ ┌───────────┐ │ ┌───────────┐ │ No recent       │
│ │Task Card  │ │ │Task Card  │ │ │Task Card  │ │ activity        │
│ │Title      │ │ │Title      │ │ │Title      │ │                 │
│ │Desc...    │ │ │Desc...    │ │ │Desc...    │ │ Events will     │
│ │🤖 Agent   │ │ │🤖 Agent   │ │ │🤖 Agent   │ │ appear here     │
│ │19d ago    │ │ │18d ago    │ │ │17d ago    │ │ as agents work  │
│ └───────────┘ │ └───────────┘ │ └───────────┘ │                 │
│ ┌───────────┐ │ ┌───────────┐ │               │                 │
│ │Task Card  │ │ │Task Card  │ │               │                 │
│ └───────────┘ │ └───────────┘ │               │                 │
└───────────────┴───────────────┴───────────────┴─────────────────┘
```

**Features:**
- Top stat bar: tasks this week, in progress, total, completion %
- Filter row: new task button, agent filter, project filter
- 3 Kanban columns: Backlog, In Progress, Done
- Task cards: title, description preview, agent badge, timestamp
- Live Activity panel on the right (WebSocket task_update events)
- Drag-and-drop between columns (optional, defer to later)

- [ ] Step 1: Create TaskBoardView.tsx with stat bar (4 stat cards)
- [ ] Step 2: Add filter row (New Task button, dropdowns)
- [ ] Step 3: Create TaskCard component (title, desc, agent badge, time)
- [ ] Step 4: Create 3 Kanban columns with scroll
- [ ] Step 5: Add Live Activity panel (right side)
- [ ] Step 6: Wire to `/api/tasks` endpoint
- [ ] Step 7: Wire WebSocket `task_update` events for live updates
- [ ] Step 8: Wire to Shell router (maps to "overview" nav item)
- [ ] Step 9: Playwright screenshot verify
- [ ] Step 10: Commit

### Task 1.3: Overview Dashboard

**Files:**
- Create: `SYSTEM/ui/src/components/views/OverviewView.tsx`

**Design:**
```
┌──────────────────────────────────────────────────────────┐
│ ⚡ PAIONE Dashboard                                      │
├──────┬──────┬──────┬──────┬──────┬──────┐               │
│Status│Uptime│ Cost │Tokens│Chats │Active│               │
│ ✅OK │ 2h  │€0.03│ 1.2K │  5   │Tasks │               │
│      │      │     │      │      │  3   │               │
├──────┴──────┴──────┴──────┴──────┴──────┘               │
│                                                          │
│ ┌─── Recent Activity ──────────────────────────────────┐ │
│ │ 14:23 💬 Oliver: "Help me plan..."        → Sonnet  │ │
│ │ 14:20 🧠 TELOS updated (goals)                      │ │
│ │ 14:15 ✅ Task "Build UI" completed                   │ │
│ │ 14:10 📱 WhatsApp connected                          │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─── Context Budget ──┐  ┌─── Channels ─────────────┐  │
│ │ Temporal    50/50   │  │ 🌐 Web      ✅ Connected │  │
│ │ Persona   340/1500  │  │ 📱 WhatsApp ⚪ Not set  │  │
│ │ TELOS     280/1000  │  │ 💬 Telegram ⚪ Not set  │  │
│ │ Graphiti    0/3000  │  │ 🎮 Discord  ⚪ Not set  │  │
│ │ ━━━━━━━━━ 12%      │  └───────────────────────────┘  │
│ └─────────────────────┘                                  │
└──────────────────────────────────────────────────────────┘
```

- [ ] Step 1: Create OverviewView.tsx with 6 stat cards row
- [ ] Step 2: Add Recent Activity feed (from WebSocket events)
- [ ] Step 3: Add Context Budget card (token usage bars)
- [ ] Step 4: Add Channels status card
- [ ] Step 5: Wire to `/api/stats` and `/api/health` endpoints
- [ ] Step 6: Wire WebSocket for live stat updates
- [ ] Step 7: Replace current placeholder for "overview" route
- [ ] Step 8: Playwright screenshot verify
- [ ] Step 9: Commit

---

## Sprint 2: Tier 2 — Identity & Automation

### Task 2.1: TELOS Editor

**Files:**
- Create: `SYSTEM/ui/src/components/views/TelosView.tsx`
- Reference: `paix/web/app/(dashboard)/telos/page.tsx` (563 lines)

**Design:** 10 dimension cards in a grid. Each card has: dimension name, entry count, token count, expand to edit entries. Live-save on blur.

- [ ] Step 1: Create TelosView.tsx with 10 dimension cards grid
- [ ] Step 2: Each card: icon, name, entry count, token usage bar
- [ ] Step 3: Click card → expand inline editor with entries
- [ ] Step 4: Add/edit/delete entries per dimension
- [ ] Step 5: Token counter showing budget usage
- [ ] Step 6: Wire to `/api/telos` CRUD endpoints
- [ ] Step 7: Auto-save on edit blur
- [ ] Step 8: Commit

### Task 2.2: Persona Editor

**Files:**
- Create: `SYSTEM/ui/src/components/views/PersonaView.tsx`

**Design:** 5 tabbed editor (identity, rules, skills, preferences, pinned). Left: tab list. Right: markdown editor with preview toggle.

- [ ] Step 1: Create PersonaView.tsx with 5 tabs
- [ ] Step 2: Each tab: textarea editor with current content
- [ ] Step 3: Token counter per file + total budget bar
- [ ] Step 4: Save button with loading state
- [ ] Step 5: Wire to `/api/persona` CRUD endpoints
- [ ] Step 6: Commit

### Task 2.3: Skills Manager

**Files:**
- Create: `SYSTEM/ui/src/components/views/SkillsView.tsx`
- Reference: `paix/web/app/(dashboard)/skills/page.tsx` (3554 lines — large, extract key patterns)

**Design:** Skill card grid with search. Click → detail dialog with execute, schedule, history.

- [ ] Step 1: Create SkillsView.tsx with search bar + filter tabs
- [ ] Step 2: Skill cards grid (name, description, last run, status badge)
- [ ] Step 3: Click card → detail dialog (description, arguments, history)
- [ ] Step 4: Execute skill button with output display
- [ ] Step 5: Wire to `/api/skills` endpoint
- [ ] Step 6: Commit

### Task 2.4: Routines/Scheduler

**Files:**
- Create: `SYSTEM/ui/src/components/views/RoutinesView.tsx`
- Reference: `paix/web/app/(dashboard)/routines/page.tsx` (1215 lines)
- Reference: OpenClaw Calendar screenshot

**Design:** Top: "Always Running" cron badges. Middle: Week calendar grid. Bottom: "Next Up" list.

- [ ] Step 1: Create RoutinesView.tsx with header + "New Routine" button
- [ ] Step 2: "Always Running" section with active cron job badges
- [ ] Step 3: Week calendar grid (Mo-Su) with colored routine blocks
- [ ] Step 4: "Next Up" list with countdown timers
- [ ] Step 5: Create/edit routine dialog (name, cron, skill, enabled toggle)
- [ ] Step 6: Wire to `/api/routines` CRUD endpoints
- [ ] Step 7: Commit

---

## Sprint 3: Tier 3 — Connections & System

### Task 3.1: MCP/Tools Manager

**Files:**
- Create: `SYSTEM/ui/src/components/views/McpView.tsx`
- Reference: `paix/web/app/(dashboard)/werkzeuge/page.tsx` (1818 lines)

**Design:** MCP server cards with connection status, tool list per server, enable/disable toggles.

- [ ] Step 1: Create McpView.tsx with "Add Server" button
- [ ] Step 2: Server cards (name, URL, status badge, tool count)
- [ ] Step 3: Expand server → tool list with enable/disable switches
- [ ] Step 4: Add/edit server dialog
- [ ] Step 5: Wire to `/api/tools` CRUD endpoints
- [ ] Step 6: Commit

### Task 3.2: Settings

**Files:**
- Create: `SYSTEM/ui/src/components/views/SettingsView.tsx`
- Reference: `paix/web/app/(dashboard)/settings/page.tsx` (2347 lines)

**Design:** Multi-tab settings: General, API Keys, Models, Language, Theme, Notifications, Advanced.

- [ ] Step 1: Create SettingsView.tsx with tab navigation
- [ ] Step 2: General tab (assistant name, locale, timezone)
- [ ] Step 3: API Keys tab (Anthropic, OpenRouter, Ollama — masked inputs)
- [ ] Step 4: Models tab (fast/balanced/powerful model selectors)
- [ ] Step 5: Theme tab (dark/light toggle, accent color)
- [ ] Step 6: Advanced tab (log level, ports, debug mode)
- [ ] Step 7: Save/reset buttons per section
- [ ] Step 8: Wire to `/api/settings` endpoints
- [ ] Step 9: Commit

### Task 3.3: Files Explorer

**Files:**
- Create: `SYSTEM/ui/src/components/views/FilesView.tsx`
- Reference: `paix/web/app/(dashboard)/dateien/page.tsx` (857 lines)

**Design:** Left: file tree (USER/ directory). Right: file content editor.

- [ ] Step 1: Create FilesView.tsx with split layout
- [ ] Step 2: Left panel: directory tree (collapsible folders)
- [ ] Step 3: Right panel: file content viewer/editor
- [ ] Step 4: Save button with confirmation
- [ ] Step 5: Wire to `/api/files/*` endpoints
- [ ] Step 6: Commit

### Task 3.4: Graphiti/Knowledge Explorer

**Files:**
- Create: `SYSTEM/ui/src/components/views/GraphitiView.tsx`

**Design (from OpenClaw Memory screenshot):** Left: search + fact list. Right: fact detail view with markdown rendering.

- [ ] Step 1: Create GraphitiView.tsx with split layout
- [ ] Step 2: Left panel: search bar + fact list (grouped by date)
- [ ] Step 3: Right panel: selected fact detail with markdown
- [ ] Step 4: Fact metadata (score, timestamp, entities)
- [ ] Step 5: Wire to `/api/knowledge/*` endpoints (graceful degradation if offline)
- [ ] Step 6: Commit

---

## Sprint 4: Tier 4 — Advanced Views

### Task 4.1: Channels Manager

**Files:**
- Create: `SYSTEM/ui/src/components/views/ChannelsView.tsx`

**Design:** Channel cards (Web, WhatsApp, Telegram, Discord, Slack). Each: logo, name, status badge, connect/disconnect button.

- [ ] Step 1: Create ChannelsView.tsx with channel cards grid
- [ ] Step 2: Each card: channel icon, name, status (connected/disconnected/pending)
- [ ] Step 3: Connect button → setup dialog (QR for WhatsApp, token for others)
- [ ] Step 4: Wire to `/api/channels` endpoints
- [ ] Step 5: Commit

### Task 4.2: Agents/Team View

**Files:**
- Create: `SYSTEM/ui/src/components/views/AgentsView.tsx`

**Design (from OpenClaw Team screenshot):** Org chart with user card at top, agent cards below. Each agent: avatar, role, description, skill tags.

- [ ] Step 1: Create AgentsView.tsx with header (user card)
- [ ] Step 2: Active agents grid with status badges
- [ ] Step 3: Agent cards (name, role, description, skill tags, "Role Card →")
- [ ] Step 4: Spawn/stop agent buttons
- [ ] Step 5: Wire to `/api/agents` endpoints + WebSocket `agent_update`
- [ ] Step 6: Commit

### Task 4.3: Marketplace

**Files:**
- Create: `SYSTEM/ui/src/components/views/MarketplaceView.tsx`
- Reference: `paix/web/app/(dashboard)/marketplace/page.tsx` (332 lines — small)

**Design:** Searchable grid of available skills and tools. Install button, ratings, categories.

- [ ] Step 1: Create MarketplaceView.tsx with search + category tabs
- [ ] Step 2: Item cards (name, description, rating, install count)
- [ ] Step 3: Install button with progress
- [ ] Step 4: Wire to marketplace API (or local skill discovery)
- [ ] Step 5: Commit

### Task 4.4: Feedback Dashboard

**Files:**
- Create: `SYSTEM/ui/src/components/views/FeedbackView.tsx`

**Design (from OpenClaw Feedback screenshot):** Stat cards (total, new, building, built). Feedback queue with "Build This" buttons. AI Builds panel.

- [ ] Step 1: Create FeedbackView.tsx with stat cards row
- [ ] Step 2: Feedback queue list with filter tabs (All, New, Building, Built)
- [ ] Step 3: Each item: description, status badge, date, "Build This" button
- [ ] Step 4: AI Builds panel (right side)
- [ ] Step 5: Commit

---

## Sprint 5: Polish & Integration

### Task 5.1: Notification Bell

**Files:**
- Modify: `SYSTEM/ui/src/components/views/ChatView.tsx` — Add to header
- Create: `SYSTEM/ui/src/components/layout/NotificationBell.tsx`

- [ ] Step 1: Create NotificationBell component (bell icon + unread count badge)
- [ ] Step 2: Dropdown panel with recent notifications
- [ ] Step 3: Wire to WebSocket `notification` events
- [ ] Step 4: Add to all view headers
- [ ] Step 5: Commit

### Task 5.2: Activity Feed (Global)

**Files:**
- Create: `SYSTEM/ui/src/components/layout/ActivityFeed.tsx`
- Reference: `paix/web/components/pai/activity-feed.tsx`

- [ ] Step 1: Create ActivityFeed as a collapsible right panel
- [ ] Step 2: Chronological list of all system events (human-readable)
- [ ] Step 3: Wire to all WebSocket event types
- [ ] Step 4: Commit

### Task 5.3: Sidebar Badge Integration

- [ ] Step 1: Add StatusBadge dots to every sidebar nav item
- [ ] Step 2: Unread count badges on Chat, Logs, Feedback
- [ ] Step 3: Wire badges to real-time status from `useSystemStatus()`
- [ ] Step 4: Commit

### Task 5.4: Production Build & Deployment

- [ ] Step 1: Ensure Vite production build succeeds
- [ ] Step 2: Configure Express to serve `SYSTEM/ui/dist/`
- [ ] Step 3: Update Docker Compose to build UI
- [ ] Step 4: Verify full stack works in Docker
- [ ] Step 5: Commit

---

## Dependencies

```
Sprint 0 (Infrastructure) ← must complete first
    ├── Sprint 1 (Monitoring) ← depends on WebSocket events + API
    ├── Sprint 2 (Identity) ← depends on API endpoints
    ├── Sprint 3 (System) ← depends on API endpoints
    └── Sprint 4 (Advanced) ← depends on API endpoints
Sprint 5 (Polish) ← after all views exist
```

Sprints 1-4 can run in parallel within each sprint (tasks are independent views).

## Effort Estimates

| Sprint | Tasks | Est. Time | Dependencies |
|--------|-------|-----------|-------------|
| Sprint 0 | 4 tasks | ~4 hours | None |
| Sprint 1 | 3 tasks | ~4 hours | Sprint 0 |
| Sprint 2 | 4 tasks | ~6 hours | Sprint 0 |
| Sprint 3 | 4 tasks | ~6 hours | Sprint 0 |
| Sprint 4 | 4 tasks | ~4 hours | Sprint 0 |
| Sprint 5 | 4 tasks | ~3 hours | All sprints |
| **Total** | **23 tasks** | **~27 hours** | |

## GitHub Issues

Each sprint should create GitHub Issues in the PAIONE project board:
- Sprint 0 → Phase 3: Model Routing + Learning milestone
- Sprints 1-4 → New "Dashboard" milestone
- Sprint 5 → Dashboard milestone (polish)
