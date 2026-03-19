# Skill-Workflows & Verkettung — Architektur-Plan

## Ist-Zustand (Was wir haben)

### Skills
- SkillConfig: DB-Row pro User+Skill mit SKILL.md, Tools, Parameters
- SkillExecution: Log pro Skill-Run (status, output, duration, tool_calls)
- Skill-Execution: LLM mit echtem Tool Use (web_search, web_fetch, storage_*, create_artifact)
- AI Skill Generator: "Mit KI erstellen" Dialog mit System-Capabilities Awareness
- Globaler Verlauf: Chronologische Execution-Liste mit Expandierung

### Routinen (haben wir schon!)
- RoutineChain: DAG-basierte Verkettung mit Cycle-Detection
- Trigger-Options: on_success, on_failure, always
- Result-Passing: Output von Source als Input der Target
- Context-Mapping: Field Mapping zwischen Routinen
- Cron-Scheduling, Webhook-Trigger, manuelle Ausloesung
- Skills pro Routine zuordbar (RoutineSkill)

### Was FEHLT
1. Skill = Verzeichnis (Templates, Examples, References)
2. Skill ruft Skill direkt auf (nicht ueber Routinen-Umweg)
3. Visueller Workflow-Editor
4. Skill-Marketplace
5. Monitoring-Dashboard

---

## Architektur-Entscheidung: Skills vs. Routinen vs. Workflows

### Option A: Skills erweitern (Skill ruft Skill auf)
Skills bekommen einen `call_skill` Tool → der Agent kann im SKILL.md schreiben:
"Rufe nach dem Briefing den Skill 'artikel-erstellen' auf mit dem Briefing als Input."

**Pro:** Einfach, flexibel, Agent entscheidet wann er verketten will
**Contra:** Schwer vorhersagbar, kein visueller Graph, Agent koennte Loops bauen

### Option B: Routinen ALS Skill-Workflows nutzen (empfohlen)
Routinen haben schon Chains, Cron, Webhooks, Cost Controls. Wir muessen nur:
- UI vereinfachen (Routine = "Workflow" umbenennen fuer User)
- Visuellen Chain-Editor bauen
- Skills besser in Routinen integrieren

**Pro:** 80% der Infrastruktur existiert, DAG + Cycle-Detection, Cost Controls
**Contra:** Naming-Verwirrung (Routine vs. Workflow vs. Skill)

### Option C: Hybrid — Beides
- Skills bekommen `call_skill` Tool fuer ad-hoc Verkettung
- Routinen/Workflows fuer geplante, wiederkehrende Pipelines
- UI zeigt beides als "Workflows" oder "Automationen"

### EMPFEHLUNG: Option C (Hybrid)

---

## Plan — Phase 1: Skill-Erweiterungen (Quick Wins)

### 1.1 `call_skill` Tool (Backend)
Neues Tool in `_get_skill_tools()`:
```
call_skill(skill_id, input, parameters) → string
```
Der Agent kann innerhalb eines Skills einen anderen Skill aufrufen.
Rekursionsschutz: Max 3 Ebenen tief.

### 1.2 Skills als Verzeichnisse (S3-basiert)
Statt nur `skill_md` Text → Verzeichnisstruktur im S3:
```
users/{uid}/skills/{skill-id}/
  SKILL.md           # Hauptanweisungen (required)
  template.md        # Output-Template (optional)
  examples/          # Beispiel-Outputs
  references/        # Referenz-Dateien (z.B. research-playbook.md)
```
- Beim Skill-Ausfuehren: References automatisch in den System-Prompt laden
- Template: Agent nutzt es als Vorlage fuer den Output
- Examples: Few-Shot Learning

### 1.3 Skill-Config erweitern
Neue Felder auf SkillConfig:
- `trigger_on_complete` — Skill-ID der nach Abschluss aufgerufen wird
- `input_source` — "manual" | "previous_skill" | "storage_path"
- `output_path` — Standard-Speicherpfad fuer Ergebnisse
- `category` — Gruppierung (research, writing, automation, ...)
- `icon` — Emoji oder Icon-Name

---

## Plan — Phase 2: Workflow-UI

### 2.1 Routinen zu "Workflows" umbenennen
- Frontend: "Routinen" → "Workflows" in der Sidebar
- Konzept: Ein Workflow = Routine + Chain + Skills
- Bestehendes RoutineChain System nutzen

### 2.2 Visueller Chain-Editor
- Einfache Node-Liste (nicht gleich React Flow / Node-Graph)
- Jeder Step: Skill-Auswahl, Trigger (on_success/on_failure), Input-Mapping
- "Schritt hinzufuegen" Button
- Vorschau der Pipeline als vertikale Timeline

### 2.3 Workflow-Templates
Vorgefertigte Workflows:
- "Daily Briefing → Artikel → Publish"
- "Research → Summary → Notification"
- "Daten sammeln → Analyse → Report"

---

## Plan — Phase 3: Monitoring & Analytics

### 3.1 Workflow-Dashboard
- Timeline-View: Wann lief was
- Fehlerrate pro Skill/Workflow
- Durchschnittliche Dauer
- Token-Verbrauch / Kosten
- Letzte 24h / 7 Tage / 30 Tage

### 3.2 Alerting
- Fehler-Notification via Telegram/Browser/In-App
- "Skill X ist 3x hintereinander fehlgeschlagen"
- Cost-Alert: "Monatliches Budget zu 80% verbraucht"

### 3.3 Execution-Detail-View
- Voller Chat-Verlauf der Execution (nicht nur Summary)
- Tool-Call Timeline mit Dauer pro Call
- Input/Output pro Step in der Chain
- "Im Chat oeffnen" Button (haben wir schon)

---

## Plan — Phase 4: Marketplace

### 4.1 Skill-Packaging
- Export: Skill als ZIP/JSON (SKILL.md + templates + examples + config)
- Import: ZIP hochladen → Skill installieren
- Versionierung: v1.0, v1.1, etc.

### 4.2 Marketplace-Backend
- Oeffentliche Skill-Registry (eigene DB-Tabelle oder separater Service)
- Kategorien: Research, Writing, Automation, Analytics, Communication
- Bewertungen / Downloads / Favoriten
- Kuratierung: User reicht ein → wir pruefen → veroeffentlichen

### 4.3 Marketplace-UI
- Browse: Kategorien, Suche, Beliebt, Neu
- Skill-Detailseite: Beschreibung, Screenshots, Bewertungen
- "Installieren" Button → SkillConfig fuer den User erstellen
- "Eigenen Skill einreichen" Flow

---

## Priorisierung

| Phase | Feature | Aufwand | Mehrwert | Abhaengigkeiten |
|-------|---------|---------|----------|-----------------|
| 1.1 | call_skill Tool | Klein | Hoch | Keine |
| 1.2 | Skills als Verzeichnisse | Mittel | Hoch | S3 funktioniert |
| 1.3 | Skill-Config erweitern | Klein | Mittel | Keine |
| 2.1 | Routinen → Workflows | Klein | Mittel | Keine |
| 2.2 | Visueller Chain-Editor | Gross | Hoch | RoutineChain existiert |
| 2.3 | Workflow-Templates | Mittel | Hoch | 2.1 + 2.2 |
| 3.1 | Monitoring Dashboard | Mittel | Hoch | SkillExecution existiert |
| 3.2 | Alerting | Klein | Mittel | Telegram/Notifications |
| 3.3 | Execution-Detail-View | Mittel | Hoch | 3.1 |
| 4.1 | Skill-Packaging | Mittel | Hoch | 1.2 |
| 4.2 | Marketplace-Backend | Gross | Sehr hoch | 4.1 |
| 4.3 | Marketplace-UI | Gross | Sehr hoch | 4.2 |

## Plan — Phase 1.4: "Skill planen" Button (Quick Win)

### Konzept
Direkt beim Skill ein Button "Planen" → oeffnet Dialog:
- Cron-Auswahl (taeglich um X Uhr, woechentlich, etc.)
- Erstellt automatisch eine Routine mit dem Skill zugeordnet
- Der Skill wird dann per Celery Beat zum gewaehlten Zeitpunkt ausgefuehrt

### Bestehendes System nutzen
- RoutineSkill verknuepft Routine mit Skill (existiert)
- RoutineRun loggt die Ausfuehrung (existiert)
- Celery Beat + APScheduler triggern Cron-Jobs (existiert)

### Was gebaut werden muss
- "Planen" Button im Skill-UI (Frontend)
- Dialog: Cron-Auswahl (Presets: taeglich 8:00, taeglich 18:00, woechentlich Montag, custom)
- Backend: POST /skills/{skill_id}/schedule → erstellt Routine + RoutineSkill
- Execution: Routine-Engine fuehrt den Skill aus (skill_service.execute())

### Killer-Kombination
"Ich will mein Aiianer Briefing jeden Morgen um 7:30 automatisch" →
Skill "aiianer-daily-briefing" + Routine (cron: 0 7 30 * * *) →
Celery Beat fuehrt aus → Briefing landet im S3 → Notification per Telegram

---

## Empfohlene Reihenfolge fuer naechste Session

1. **Phase 1.1**: `call_skill` Tool (30 Min) — sofortiger Mehrwert
2. **Phase 1.4**: "Skill planen" Button (45 Min) — Skill per Cron ausfuehren
3. **Phase 1.3**: Skill-Config erweitern (30 Min) — Basis fuer alles Weitere
4. **Phase 2.1**: Routinen → Workflows Rename (15 Min) — UX Klarheit
5. **Phase 3.1**: Monitoring Dashboard (1-2h) — Sichtbarkeit
6. **Phase 1.2**: Skills als Verzeichnisse (1h) — Maechtigere Skills
7. **Phase 2.2**: Visueller Chain-Editor (2-3h) — Killer Feature

---

## Technische Notizen

### call_skill Rekursionsschutz
```python
# In execute():
_execution_depth = 0  # Track recursion

async def call_skill_tool(skill_id, input, parameters):
    nonlocal _execution_depth
    if _execution_depth >= 3:
        return "Error: Maximum skill nesting depth (3) reached"
    _execution_depth += 1
    result = await skill_service.execute(db, user_id, skill_id, input, parameters)
    _execution_depth -= 1
    return result.get("output", "")
```

### Bestehende RoutineChain Felder (schon in DB!)
- source_routine_id, target_routine_id
- trigger_condition: "success" | "always" | "failure"
- pass_result: Boolean
- context_mapping: JSONB (Field Mapping)
- delay_seconds: Int (Wartezeit zwischen Steps)
- Cycle-Detection via BFS bereits implementiert

### S3 Skill-Verzeichnis Konvention
```
users/{uid}/skills/{skill-id}/SKILL.md
users/{uid}/skills/{skill-id}/template.md
users/{uid}/skills/{skill-id}/examples/sample-output.md
users/{uid}/skills/{skill-id}/references/research-playbook.md
```
