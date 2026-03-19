# PAIONE Dashboard — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Overview

PAIONE's web dashboard is the primary user interface — an "AI Operating System" UI. It provides chat, configuration, identity management, automation, monitoring, and visualization in a single cohesive application.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Icon-Rail + Expandable Panel | More space for content, modern feel (VS Code/Discord pattern) |
| Tech Stack | React + Vite + shadcn/ui + Tailwind | Full shadcn/ui MCP compatibility, fast builds, standard React |
| Chat Layout | Chat + Toggleable Info-Panel | Transparency (model, costs, TELOS, Graphiti) without cluttering |
| Theme | Dark with orange (#f97316) accent | Matches paione.ai branding |
| Styling | shadcn/ui components + Tailwind | Consistent, accessible, installable via MCP |

## Layout Architecture

```
┌──────────────────────────────────────────────────────┐
│ Icon-Rail │ Sub-Panel (contextual) │ Main View       │ Info-Panel  │
│ (48px)    │ (220px, toggleable)    │ (flex-1)        │ (280px, opt)│
│           │                        │                 │             │
│ Fixed     │ Changes per view:      │ View content    │ Chat-only:  │
│ navigation│ - Chat: session list   │                 │ Model, cost │
│           │ - Settings: nav tree   │                 │ tokens,     │
│           │ - Files: file tree     │                 │ TELOS dims  │
│           │ - Agents: agent list   │                 │ Graphiti    │
└──────────────────────────────────────────────────────┘
```

## Icon-Rail Navigation (14 views)

### Main
| Icon | Label | View |
|------|-------|------|
| 💬 | Chat | Multi-session chat with streaming |
| 📊 | Overview | Health, costs, stats dashboard |

### Identity
| Icon | Label | View |
|------|-------|------|
| 🎭 | Persona | 5-file persona editor |
| 🧭 | TELOS | 10-dimension identity editor |
| 🧠 | Knowledge | Graphiti graph explorer |

### Automation
| Icon | Label | View |
|------|-------|------|
| 🤖 | Agents | Hands management, running tasks |
| ⚡ | Skills | Skill browser, editor, chaining |
| ⏰ | Routines | Cron jobs, scheduled actions |

### Connections
| Icon | Label | View |
|------|-------|------|
| 📱 | Channels | WhatsApp, Telegram, Discord, Slack |
| 🔌 | Tools | MCP servers, API integrations |

### System (bottom-pinned)
| Icon | Label | View |
|------|-------|------|
| 📁 | Files | USER/ file explorer |
| ⚙️ | Settings | All configuration options |
| 📋 | Logs | Live logs, error history |

### Special
| Icon | Label | View |
|------|-------|------|
| 🧙 | Wizard | Setup wizard (first-time only) |

## Chat View Detail

### Three-Column Layout
1. **Session List** (sub-panel): New Chat button, session history sorted by date
2. **Chat Area** (main): Messages with markdown rendering, streaming cursor, timestamps
3. **Info Panel** (toggleable, default collapsed):
   - Current model + tier
   - Session cost (€)
   - Token usage (used / context window)
   - Context breakdown: Temporal, Persona, TELOS (with active dimensions), Graphiti (with fact count)
   - Toggle button in chat header

### Chat Features
- Multiple concurrent sessions
- Streaming responses (token-by-token)
- Markdown rendering (code blocks, tables, lists)
- Message timestamps
- Model indicator per message
- Session search/filter

## Tech Stack

```
React 19           — UI framework
Vite               — Build tool (dev + production)
shadcn/ui          — Component library (via MCP)
Tailwind CSS 4     — Styling
React Router       — Client-side routing
WebSocket (native) — Real-time chat
```

### Project Structure

```
SYSTEM/ui/
├── src/
│   ├── main.tsx           — Entry point
│   ├── App.tsx            — Root layout + router
│   ├── components/
│   │   ├── layout/
│   │   │   ├── IconRail.tsx
│   │   │   ├── SubPanel.tsx
│   │   │   ├── InfoPanel.tsx
│   │   │   └── Shell.tsx
│   │   ├── ui/            — shadcn/ui components
│   │   └── views/
│   │       ├── ChatView.tsx
│   │       ├── OverviewView.tsx
│   │       ├── PersonaView.tsx
│   │       ├── TelosView.tsx
│   │       ├── ChannelsView.tsx
│   │       ├── AgentsView.tsx
│   │       ├── SkillsView.tsx
│   │       ├── McpView.tsx
│   │       ├── GraphitiView.tsx
│   │       ├── FilesView.tsx
│   │       ├── SettingsView.tsx
│   │       ├── LogsView.tsx
│   │       ├── RoutinesView.tsx
│   │       └── WizardView.tsx
│   ├── hooks/             — Custom React hooks
│   ├── lib/               — Utilities, API client
│   └── styles/
│       └── globals.css    — Tailwind + custom theme
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── components.json        — shadcn/ui config
├── tsconfig.json
└── package.json
```

### Express Integration

Vite builds to `SYSTEM/ui/dist/`. Express serves this as static files. In development, Vite dev server runs on port 5173 with proxy to Express API on port 3000.

## Implementation Sub-Projects (in order)

### SP1: Dashboard Shell
- React + Vite + Tailwind + shadcn/ui scaffold
- Icon-Rail with all 14 icons
- Client-side router with placeholder views
- Dark theme with orange accent
- Responsive (collapses icon-rail on mobile)

### SP2: Chat View
- Multi-session chat with WebSocket
- Streaming display
- Markdown rendering
- Toggleable info panel
- Session CRUD

### SP3: Overview Dashboard
- Health status cards
- Cost tracking charts
- Active channels indicator
- Recent sessions list
- Token usage overview

### SP4: Identity Editors
- Persona: 5-file tabbed editor with markdown preview
- TELOS: 10-dimension cards with token budget indicator
- Live preview of what the AI "sees"

### SP5: Settings System
- Categorized settings (General, Models, Privacy, Notifications, Advanced)
- Search/filter across all settings
- Immediate save via API
- Reset to defaults

### SP6: Channels + MCP/Tools
- Channel cards with connection status
- QR code scanning for WhatsApp
- MCP server configuration
- Tool enable/disable toggles

### SP7: Agents + Skills + Routines
- Agent spawn/monitor/stop
- Skill browser with search
- Skill chaining (visual flow)
- Cron routine editor

### SP8: Knowledge + Files + Logs
- Graphiti graph visualization (force-directed)
- Fact browser/editor
- USER/ file explorer with inline editor
- Live log viewer with level filter

## API Requirements

The Express backend needs additional endpoints for the dashboard:

```
GET    /api/health              — existing
GET    /api/config              — existing
GET    /api/sessions            — existing
GET    /api/messages/:id        — existing
POST   /api/settings            — update settings
GET    /api/settings            — get all settings
GET    /api/costs               — cost tracking data
GET    /api/channels            — channel status
POST   /api/channels/:name      — connect/disconnect channel
GET    /api/persona             — persona files content
PUT    /api/persona/:file       — update persona file
GET    /api/telos               — telos files content
PUT    /api/telos/:dimension    — update telos file
GET    /api/files/*             — file explorer
PUT    /api/files/*             — file editor
GET    /api/logs                — recent logs
GET    /api/agents              — running agents
POST   /api/agents              — spawn agent
DELETE /api/agents/:id          — stop agent
GET    /api/skills              — installed skills
GET    /api/routines            — scheduled routines
POST   /api/routines            — create routine
```

## Out of Scope (for now)
- Multi-user authentication (single-user in Phase 1-4)
- Mobile native app (responsive web is sufficient)
- Plugin marketplace (Phase 5+)
- Video/voice chat
