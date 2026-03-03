# PAI-X Agent Configs

Agent-spezifische Konfigurationen, TELOS-Schema und Skill-Definitionen.

## Struktur (geplant)
```
agents/
├── telos/                 # TELOS Schema-Definitionen
│   ├── schema.yaml        # Die 10 TELOS-Dimensionen
│   └── oliver_initial.yaml # Initiale TELOS-Befuellung fuer Oliver
├── skills/                # Skill Definitions
│   ├── calendar_briefing.yaml
│   ├── pre_meeting_alert.yaml
│   ├── content_pipeline.yaml
│   ├── idea_capture.yaml
│   ├── document_creation.yaml
│   └── research.yaml
└── prompts/               # System Prompts
    ├── base_system.md     # Basis-System-Prompt fuer PAI-X
    ├── intent_router.md   # Intent Classification Prompt
    └── skill_prompts/     # Pro-Skill System Prompts
```

## Hinweis
Skills folgen der UNIX-Philosophie: Jeder Skill macht genau eine Sache.
Skills sind komposierbar und koennen von anderen Skills aufgerufen werden.
