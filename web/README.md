# PAI-X Web Frontend

Next.js 16 Frontend mit shadcn/ui Dashboard-Template.

## Tech-Stack
- Next.js 16 (App Router, Server Components, React 19)
- TypeScript 5.x (strict)
- Tailwind CSS 3.x
- shadcn/ui (aus Dashboard-Template)
- Zustand 4.x (State Management)
- TanStack Query 5.x (Server State)
- Socket.io Client 4.x (Real-time Chat)
- next-pwa + Workbox (PWA / Offline)

## Struktur (geplant)
```
web/
├── app/                   # App Router
│   ├── (dashboard)/       # Dashboard-Routen
│   │   ├── page.tsx       # Dashboard Home
│   │   ├── chat/          # Chat Interface
│   │   ├── telos/         # TELOS Editor
│   │   ├── content/       # Content Pipeline
│   │   ├── memory/        # Memory Browser
│   │   ├── skills/        # Skills Manager
│   │   └── settings/      # Einstellungen
│   └── api/               # API Routes (Next.js)
├── components/
│   ├── ui/                # shadcn Template (unveraendert)
│   └── pai/               # PAI-X Komponenten (abgeleitet)
└── lib/                   # Utilities, Hooks
```

## Hinweis
Das shadcn/ui Dashboard-Template wird als Basis geclont.
Ausschliesslich Template-Komponenten verwenden — keine externen UI-Libraries.
