# PAI-X — Projektbeschreibung

**HR Code Labs GbR · Oliver Hees · Hamburg · Februar 2026**

---

## Was ist PAI-X?

PAI-X ist ein web-basierter Personal AI Assistant — ein digitaler Chief of Staff, der dich kennt, für dich denkt und proaktiv handelt. Nicht ein weiterer Chatbot. Nicht ein weiteres Dashboard. Ein System das arbeitet.

Die Grundidee kommt von **PAI (Personal AI Infrastructure)** — einem brillanten Open-Source-Projekt von Daniel Miessler. PAI löst das Problem, dass alle KI-Assistenten reaktiv sind und den Nutzer nicht kennen. Es tut das mit einem eleganten Set an Konzepten: TELOS (Wer bin ich?), Skills (Was kann ich?), Memory (Was weiß ich?), Learning (Wie werde ich besser?).

Das Problem: PAI läuft auf Claude Code — einem Terminal-Tool für Entwickler. Kein Dashboard. Kein Mobile. Kein Nicht-Entwickler wird es je benutzen.

**PAI-X löst genau das.** Gleiche Konzepte, komplett neu implementiert als Web-App + PWA mit einem professionellen Dashboard.

---

## Das Problem das PAI-X löst

Stell dir vor, du bist unterwegs beim Spazierengehen und hast eine Idee. Mit einem normalen KI-Assistenten: Du tippst sie irgendwo ein — oder verlierst sie. Mit PAI-X: Du öffnest die App, sprichst die Idee ein. Gespeichert. Kategorisiert. Mit deinen laufenden Projekten verknüpft. Nächste Woche erinnert dich PAI-X daran und schlägt vor, wie sie sich zu Projekt X verbinden lässt.

Du hast morgen einen wichtigen Termin mit Rudolf. Mit einem normalen KI-Assistenten: Du weißt nichts, wenn du nichts tust. Mit PAI-X: Eine Stunde vorher kommt ein Push auf dein Handy — "Du hast gleich Rudolf. Beim letzten Mal habt ihr über X gesprochen. Noch offen: Action Item A. Soll ich die Unterlagen raussuchen?"

Du willst aus einem YouTube-Video einen Blogpost machen. Mit einem normalen KI-Assistenten: Copy-Paste, mehrere Tools, manuelles Formatieren, manuelles Ablegen, manuelles Planen. Mit PAI-X: URL reingeben. Transkript. Zusammenfassung. Blogpost in deinem Stil. LinkedIn-Version. In deinem Drive abgelegt. Bereit für Review und Posting.

Das ist der Unterschied.

---

## Was PAI-X besonders macht

### Es kennt dich — wirklich

Das TELOS-System (adaptiert aus PAI) ist das Herzstück. Zehn strukturierte Dimensionen die beschreiben wer du bist: deine Mission, deine Ziele, deine aktiven Projekte, deine Überzeugungen, deine Strategien, deine Ideen, was du gelernt hast.

Das ist kein Formular das du einmal ausfüllst und vergisst. Es ist ein lebendiges Dokument das PAI-X kontinuierlich aktualisiert — jede Idee die du einsprichst landet dort, jede neue Erkenntnis aus einem Gespräch, jede veränderte Priorität. Und es fließt in jede KI-Antwort ein. Der Assistent weiß wer du bist, bevor du anfängst zu tippen.

### Es erinnert sich — dauerhaft

Nicht über einzelne Gespräche hinweg mit rudimentärem Memory. Sondern über Monate und Jahre, mit echten Relationen zwischen Personen, Projekten, Meetings, Ideen.

Graphiti, ein Temporaler Knowledge Graph, ist das Backend. Er speichert nicht nur *was* — sondern *wann* und *wie sich etwas verändert hat*. "Was haben wir beim letzten Termin mit Rudolf besprochen?" ist eine echte Query, keine Hoffnung.

### Es handelt proaktiv

Das ist der fundamentale Unterschied zu allem was existiert. PAI-X wartet nicht.

Jeden Morgen um 07:30: Briefing. Jeden Termin 60 Minuten vorher: Kontext. Jede Deadline drei Tage vorher: Warnung. Jede Woche: Ideen-Synthese. Wenn du fünf Tage nicht gepostet hast: Erinnerung mit fertigem Entwurf.

Das ist kein Alarm-System. Das ist ein Assistent der mitdenkt.

### Es läuft im Browser und auf dem Handy

Kein Terminal. Kein Kommandozeile. Kein technisches Vorwissen nötig.

Eine Web-App die als PWA installierbar ist — auf iPhone, auf Android, auf dem Desktop. Das bedeutet Push-Notifications, Offline-Funktionen, native App-Erfahrung ohne App-Store.

---

## Die technische Grundlage

PAI-X ist kein Hobby-Projekt. Es ist auf einem produktionsreifen Stack aufgebaut:

**Frontend**: Next.js 16 mit dem shadcn/ui Dashboard-Template. Ausschließlich die Komponenten des Templates werden genutzt — das garantiert Konsistenz und Wartbarkeit.

**Backend**: FastAPI + LangGraph. FastAPI für die API-Layer, LangGraph für die Multi-Agent-Orchestrierung. LangGraph ermöglicht echte zustandsbasierte Workflows — kein simples Request-Response, sondern komplexe mehrstufige Aufgaben.

**Memory**: Graphiti + FalkorDB. Der Temporale Knowledge Graph gibt PAI-X ein echtes, relationales, zeitbewusstes Gedächtnis.

**Automatisierung**: n8n (self-hosted). Für alle Automatisierungen — Cron-Jobs, Kalender-Updates, E-Mail-Versand, Social-Media-Posting. Alles DSGVO-konform auf Hetzner in Deutschland.

**Voice**: LiveKit + Whisper + ElevenLabs. Bidirektionaler Voice-Chat, Sprachaufnahmen auch offline.

**Hosting**: Hetzner Cloud, Nürnberg/Falkenstein. Alle Daten in Deutschland. DSGVO-konform by design.

---

## Wo PAI-X hinführt

PAI-X wird zunächst für Oliver Hees persönlich entwickelt — als Pilot-Nutzer Nummer 0. Das ist keine Einschränkung, das ist Strategie.

Die besten Produkte entstehen wenn der Entwickler der erste echte Nutzer ist. Jede Pain Point die Oliver findet, jede Funktion die er vermisst, jeder Workflow der noch nicht stimmt — alles fließt direkt in das Produkt.

Ab Phase 4 wird PAI-X zur Grundlage für **Agent One** — den proaktiven KI-Assistenten für §203-Berufsträger in Deutschland. Steuerberater (53.800 Kanzleien), Rechtsanwälte (47.300), Ärzte. Menschen die unter strenger Schweigepflicht arbeiten, die keine Daten in US-Clouds schicken können, die aber trotzdem von KI profitieren wollen.

Das ist ein Markt der bisher keine gute Lösung hat. PAI-X wird sie bauen.

---

## Projektstruktur

```
paix/                          # Mono-Repo
├── web/                       # Next.js 16 Frontend
│   ├── app/                   # App Router
│   │   ├── (dashboard)/       # Dashboard-Routen
│   │   │   ├── page.tsx       # Dashboard Home
│   │   │   ├── chat/          # Chat Interface
│   │   │   ├── telos/         # TELOS Editor
│   │   │   ├── content/       # Content Pipeline
│   │   │   ├── memory/        # Memory Browser
│   │   │   ├── skills/        # Skills Manager
│   │   │   └── settings/      # Einstellungen
│   │   └── api/               # API Routes (Next.js)
│   ├── components/
│   │   ├── ui/                # shadcn Template (unverändert)
│   │   └── pai/               # PAI-X Komponenten (abgeleitet)
│   └── lib/                   # Utilities, Hooks
│
├── api/                       # FastAPI Backend
│   ├── routers/               # API Endpoints
│   ├── agents/                # LangGraph Agents
│   ├── skills/                # Skill Implementierungen
│   ├── memory/                # Graphiti Integration
│   └── mcp/                   # MCP Server Clients
│
├── agents/                    # Agent-spezifische Configs
│   ├── telos/                 # TELOS Schema
│   ├── skills/                # Skill Definitions
│   └── prompts/               # System Prompts
│
└── infra/                     # Docker, Nginx, Deployment
    ├── docker-compose.yml
    └── nginx/
```

---

## Timeline

| Phase | Zeitraum | Meilenstein |
|---|---|---|
| Phase 1: Foundation | Wochen 1–4 | MVP: Chat + Kalender + Briefing täglich nutzbar |
| Phase 2: Content & Voice | Wochen 5–8 | Content Pipeline + Voice vollständig |
| Phase 3: Teams & Intelligence | Wochen 9–14 | Multi-Agent Teams + vollständiges Dashboard |
| Phase 4: Agent One | Ab Woche 15 | Erstes B2B-Produkt, Benjamin Arras als Pilot |

---

## Zitat das es auf den Punkt bringt

> *"Der beste KI-Assistent ist nicht der der am meisten weiß. Es ist der der am besten versteht wer du bist — und der für dich handelt, bevor du fragst."*

Das ist PAI-X.

---

*HR Code Labs GbR · Oliver Hees · Hamburg · 2026*