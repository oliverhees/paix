# PAI-X — Product Requirements Document (PRD)

**Version:** 1.0  
**Datum:** Februar 2026  
**Autor:** Oliver Hees · HR Code Labs GbR  
**Status:** Draft — Interne Diskussion  
**Grundlage:** PAI v2.5 (Daniel Miessler) — adaptiert, erweitert, ohne Claude Code Dependency  

---

## Inhaltsverzeichnis

1. [Executive Summary](#1-executive-summary)
2. [Vision & Mission](#2-vision--mission)
3. [Problemanalyse](#3-problemanalyse)
4. [Zielgruppe & Personas](#4-zielgruppe--personas)
5. [Produktkonzept](#5-produktkonzept)
6. [Systemarchitektur](#6-systemarchitektur)
7. [TELOS — Identity Layer](#7-telos--identity-layer)
8. [Skills System](#8-skills-system)
9. [Memory System](#9-memory-system)
10. [Proaktivitäts-Engine](#10-proaktivitäts-engine)
11. [Interface & Dashboard](#11-interface--dashboard)
12. [Voice System](#12-voice-system)
13. [Agent Teams](#13-agent-teams)
14. [Learning System](#14-learning-system)
15. [Tech Stack & Infrastruktur](#15-tech-stack--infrastruktur)
16. [UI Framework — shadcn/ui Template](#16-ui-framework--shadcnui-template)
17. [Sicherheit & Datenschutz](#17-sicherheit--datenschutz)
18. [MVP Definition](#18-mvp-definition)
19. [Implementierungs-Roadmap](#19-implementierungs-roadmap)
20. [Metriken & Erfolgskriterien](#20-metriken--erfolgskriterien)
21. [Risiken & Mitigationen](#21-risiken--mitigationen)
22. [Abgrenzung zu bestehenden Systemen](#22-abgrenzung-zu-bestehenden-systemen)
23. [Zukunftsvision — Agent One Ableitung](#23-zukunftsvision--agent-one-ableitung)

---

## 1. Executive Summary

**PAI-X** (Personal AI Infrastructure Extended) ist ein web-basierter Personal AI Assistant, der sich verhält wie ein digitaler Chief of Staff. Im Gegensatz zu bestehenden KI-Assistenten (ChatGPT, Claude.ai, Perplexity) ist PAI-X kein reaktiver Chatbot, der auf Anfragen wartet — er kennt den Nutzer, seine Ziele, seine Projekte, seine Kontakte und handelt **proaktiv**.

PAI-X kombiniert die konzeptionellen Stärken des Open-Source-Projekts **PAI v2.5** von Daniel Miessler (TELOS, Skills, Memory, Hook-System, Continuous Learning) mit einer vollständig web-basierten, PWA-fähigen Oberfläche, die ohne Kommandozeile oder technisches Vorwissen bedienbar ist.

Das Produkt wird zunächst für **Oliver Hees persönlich** entwickelt (Pilot-Nutzer Nummer 0), bevor es in Phase 4 als kommerzielles Produkt für §203-Berufsträger (Steuerberater, Anwälte, Ärzte) unter dem Markennamen **Agent One** vermarktet wird.

### Kern-Differenzierer

| Feature | PAI-X | Claude.ai | OpenClaw | PAI (Miessler) |
|---|---|---|---|---|
| Web + PWA | ✅ | ✅ | ❌ Terminal | ❌ Terminal |
| Proaktiv (Push) | ✅ | ❌ | ❌ | ❌ |
| Temporales Gedächtnis | ✅ Graphiti | ❌ | ❌ | ❌ flat files |
| TELOS Identity Layer | ✅ | ❌ | ❌ | ✅ Markdown |
| Voice (bidirektional) | ✅ LiveKit | ✅ | ❌ | ❌ |
| Agent Teams | ✅ | ❌ | ❌ | ✅ |
| DSGVO / Self-Hosted | ✅ | ❌ | teilweise | ✅ |
| §203 Extension | ✅ Phase 4 | ❌ | ❌ | ❌ |

---

## 2. Vision & Mission

### Vision

> *"Ein KI-Assistent, der sich verhält wie ein Chief of Staff — der nicht wartet, bis du fragst, sondern der für dich denkt, plant, delegiert und erinnert. Weil er dich wirklich kennt."*

### Mission

PAI-X soll die Art und Weise, wie Einzelpersonen und kleine Teams arbeiten, fundamental verändern. Nicht durch ein weiteres Tool, das man bedienen muss — sondern durch einen Assistenten, der die Arbeit für dich macht.

### Leitprinzipien

Die folgenden Prinzipien sind direkt von PAI v2.5 adaptiert und gelten als unveränderliche Grundlage für alle Produktentscheidungen:

1. **User Centricity** — PAI-X ist um den Nutzer herum gebaut, nicht um Technologie. Jede Feature-Entscheidung beginnt mit der Frage: Macht das den Nutzer mächtiger?
2. **Scaffolding > Model** — Die Systemarchitektur ist wichtiger als das verwendete Modell. Ein gut strukturiertes System mit Claude Haiku schlägt ein schlecht strukturiertes System mit Claude Opus.
3. **Deterministische Infrastruktur** — KI ist probabilistisch. Die Infrastruktur darf es nicht sein. Templates, Patterns und explizite Workflows wo möglich.
4. **Proaktivität als Kern** — Ein Assistent der wartet ist kein Assistent. PAI-X handelt bevor der Nutzer fragt.
5. **Continuous Learning** — Jede Interaktion ist eine Möglichkeit das System besser zu machen. Kein Output geht verloren.
6. **UNIX-Philosophie** — Jeder Skill macht genau eine Sache. Skills sind komposierbar.
7. **Mobile First** — Der primäre Use Case ist der Nutzer unterwegs. Desktop ist Secondary.
8. **DSGVO by Design** — Datenschutz ist keine Nachgedanke, sondern Grundbedingung.

---

## 3. Problemanalyse

### Das eigentliche Problem

Bestehende KI-Assistenten sind reaktiv. Sie warten auf Eingaben, vergessen alles nach dem Gespräch und kennen den Nutzer nicht. Das Ergebnis:

- **Kontextverlust**: Jedes neue Gespräch beginnt bei Null. Der Nutzer muss sich ständig wiederholen.
- **Keine Proaktivität**: Der Assistent erinnert nicht, plant nicht, delegiert nicht — er antwortet nur.
- **Kein Persönlichkeitsprofil**: Der Assistent kennt weder Ziele noch Präferenzen noch Geschichte.
- **Fehlende Integration**: Keine echte Verbindung zu Kalender, E-Mail, Drive — nur simuliert über Copy-Paste.
- **Terminal-Abhängigkeit**: Mächtige Tools wie Claude Code oder PAI sind nur für Entwickler nutzbar.
- **Keine Visualisierung**: Selbst wenn ein System Infos speichert, gibt es keine intuitive Oberfläche dafür.

### Was Nutzer eigentlich wollen

Basierend auf der Analyse von Anwendungsfällen aus dem Alltag von Oliver Hees:

```
Szenario A — Content Pipeline:
"Ich habe ein interessantes Video gesehen."
→ Teile den Link
→ Transkript wird erstellt
→ Assistent macht eine Zusammenfassung
→ Daraus wird ein Blogpost (in meinem Stil)
→ Daraus ein LinkedIn-Post
→ Abgelegt in meinem Drive
→ An den Content-Planer weitergegeben
→ Zum nächsten freien Slot eingeplant und gepostet

Szenario B — Terminvorbereitung:
"Ich habe morgen einen Termin mit Rudolf."
→ 1 Stunde vorher, ohne dass ich frage:
→ "Du hast in 60 Min. Termin mit Rudolf."
→ "Beim letzten Mal habt ihr über X, Y, Z gesprochen."
→ "Noch offen: Action Item A von dir, B von ihm."
→ "Brauchst du noch etwas?"

Szenario C — Ideen-Memory:
→ Unterwegs beim Spazierengehen
→ App aufmachen, einsprechen
→ "Ich habe gerade die Idee, PAI für Zahnärzte zu adaptieren."
→ Gespeichert, kategorisiert, mit Projekten verlinkt
→ Nächste Woche: "Deine Idee vom Spaziergang — hier sind 3 Anschlussgedanken"

Szenario D — Delegation:
"Der Termin mit Rudolf muss verschoben werden."
→ Assistent sucht nächsten freien Slot
→ Schreibt E-Mail an Rudolf mit Vorschlägen
→ Wartet auf Bestätigung
→ Bucht um, schickt Bestätigung
→ Oliver bekommt kurze Zusammenfassung
```

### Warum bestehende Lösungen scheitern

| Lösung | Warum nicht ausreichend |
|---|---|
| **Claude.ai** | Reaktiv, kein persistentes Gedächtnis über Sessions, kein proaktiver Push, keine Tool-Integration out of the box |
| **Claude Code** | Entwickler-Tool, Terminal-basiert, nicht für Mobile, kein Dashboard, nicht für Nicht-Entwickler |
| **ChatGPT** | Ähnlich Claude.ai, Memory rudimentär, keine echte Kalender/Mail-Integration |
| **Notion AI** | Auf Notion beschränkt, kein Proaktiv-Layer, keine Voice |
| **OpenClaw** | Kein Dashboard, kein Mobile, kein proaktiver Layer |
| **PAI (Miessler)** | Geniales Konzept, aber Terminal-only (Claude Code), nicht für Nicht-Entwickler |

---

## 4. Zielgruppe & Personas

### Primäre Zielgruppe (MVP)

**Oliver Hees** — Managing Director HR Code Labs GbR, Hamburg

- 44 Jahre, 20 Jahre Entwicklungserfahrung
- Betreibt AI Automation Consultancy + Community (200+ Mitglieder)
- YouTube (~2.700 Abonnenten), TikTok (~3.000 Follower)
- Technisch versiert, aber möchte kein weiteres Terminal-Tool
- Zeitkritisch: Mehrere parallele Projekte, Kunden, Content-Produktionen
- **Pain Point**: Ideen gehen verloren, Termine werden nicht vorbereitet, Content-Pipeline ist manuell und zeitaufwändig

### Sekundäre Zielgruppe (Phase 4 — Agent One)

**§203 StGB Berufsträger in Deutschland**

#### Persona 1: Der Steuerberater
- **Name**: Benjamin Arras (Realperson, Pilot-Kunde)
- **Situation**: Eigene Kanzlei, 2–5 Mitarbeiter, 80–150 Mandanten
- **Pain Points**: Fristenkalender, Mandanten-Kommunikation, Dokumentenablage, Meeting-Nachbereitung
- **Tech-Level**: Mittelmäßig — nutzt DATEV, Outlook, kein Terminal
- **Entscheidend**: Keine Daten in US-Cloud, DSGVO-konform, §203-sicher

#### Persona 2: Der Rechtsanwalt
- **Situation**: Boutique-Kanzlei, spezialisiert (z.B. Arbeitsrecht)
- **Pain Points**: Fallverwaltung, Fristenüberwachung, Mandanten-Briefings, Dokumentenerstellung
- **Besonderheit**: Anwaltliches Berufsgeheimnis, keine externe KI-Nutzung ohne Mandanteneinwilligung

#### Persona 3: Der Allgemeinarzt
- **Situation**: Einzelpraxis, 30–50 Patienten/Tag
- **Pain Points**: Patientenkommunikation, Befunddokumentation, Terminplanung
- **Besonderheit**: Medizinisches Berufsgeheimnis, Datenschutz auf höchstem Level

---

## 5. Produktkonzept

### PAI-X ist kein Chatbot. PAI-X ist ein System.

Der fundamentale Unterschied zu allen bestehenden Lösungen: PAI-X besteht aus mehreren zusammenwirkenden Schichten, die gemeinsam ein kohärentes System ergeben — nicht eine einzelne Funktion.

```
┌─────────────────────────────────────────────────────────────────┐
│                    NUTZER-INTERFACE                             │
│           Web-App (Next.js 16) + PWA (Mobile)                  │
│         Chat | Dashboard | Voice | Notifications               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  INTELLIGENCE LAYER                             │
│              FastAPI + LangGraph                                │
│    Routing → Skill-Auswahl → Orchestrierung → Delegation       │
└─────────────┬─────────────────────────────┬────────────────────┘
              │                             │
┌─────────────▼──────────┐    ┌────────────▼───────────────────┐
│   MEMORY LAYER         │    │   ACTION LAYER                 │
│   Graphiti + FalkorDB  │    │   n8n + MCP Servers            │
│   Temporal Knowledge   │    │   Gmail / Calendar / Drive     │
│   Graph                │    │   Contacts / Claude Code       │
│   Episodisch           │    │   LinkedIn / Telegram          │
│   Semantisch           │    │   NocoDB / Custom APIs         │
│   Temporal             │    │                                │
└────────────────────────┘    └────────────────────────────────┘
              │
┌─────────────▼──────────────────────────────────────────────────┐
│                     IDENTITY LAYER                             │
│                         TELOS                                  │
│   Mission | Goals | Projects | Beliefs | Models               │
│   Strategies | Narratives | Learned | Challenges | Ideas       │
└────────────────────────────────────────────────────────────────┘
```

### Die drei Kern-Fähigkeiten

**1. Kennt mich** (Identity + Memory)  
PAI-X weiß wer du bist, was du willst, wen du kennst und was zuletzt passiert ist. Nicht weil du es jedes Mal neu sagst, sondern weil es dauerhaft im System ist.

**2. Handelt für mich** (Skills + Actions)  
PAI-X führt Aufgaben vollständig aus — nicht halb. "Verschiebe den Termin mit Rudolf" bedeutet: E-Mail verfassen, schicken, Kalender umbuchen, Bestätigung abwarten, Oliver kurz informieren. Fertig.

**3. Denkt voraus** (Proaktivität + Learning)  
PAI-X wartet nicht. Er erinnert, plant, warnt, schlägt vor — bevor du fragst. Und er wird mit jeder Interaktion besser.

---

## 6. Systemarchitektur

### 6.1 Überblick — Die 5 Schichten

#### Schicht 1: Identity Layer (TELOS)

**Was**: Das Selbst-Modell des Nutzers — ein lebendiger, strukturierter Graph in Graphiti/FalkorDB.

**Warum**: Ohne ein tief verankertes Verständnis, wer der Nutzer ist und was er will, ist jede KI-Antwort generisch. TELOS macht aus einem generischen Assistenten einen persönlichen.

**Wie es später funktioniert**: TELOS wird beim ersten Setup durch ein geführtes Interview befüllt (30–60 Minuten). Danach aktualisiert der Agent TELOS kontinuierlich — neue Ideen aus Gesprächen, neue Learnings aus Projekten, neue Ziele wenn der Nutzer sie nennt. Der Nutzer kann TELOS jederzeit im Dashboard einsehen und editieren.

*Beispiel*: Oliver sagt in einem Gespräch: "Ich glaube, wir sollten Agent One zuerst auf Zahnarztpraxen fokussieren." → PAI-X erkennt das als neue strategische Überlegung → schreibt sie in den TELOS-Bereich `STRATEGIES.business` → verlinkt sie mit dem `PROJECTS.agent_one` Node → beim nächsten relevanten Gespräch ist dieser Kontext automatisch verfügbar.

#### Schicht 2: Intelligence Layer (FastAPI + LangGraph)

**Was**: Das Gehirn des Systems. Empfängt alle Anfragen (Text, Voice, proaktive Trigger), entscheidet was zu tun ist, orchestriert die Ausführung.

**Warum**: Ohne eine kluge Routing-Schicht würde jede Anfrage an ein generisches LLM gehen ohne Kontext, ohne Skill-Spezialisierung, ohne Erinnerung an den vorherigen Schritt.

**Wie es funktioniert**:
1. Anfrage kommt rein (Text/Voice/Cron-Trigger)
2. **Intent Classification** — Was will der Nutzer? Welcher Skill ist zuständig?
3. **Context Enrichment** — Graphiti wird abgefragt: Was wissen wir über dieses Thema? Welche Personen sind beteiligt? Was war der letzte Stand?
4. **Skill Routing** — Der passende Skill wird ausgewählt und mit vollem Kontext aufgerufen
5. **Orchestrierung** — Bei komplexen Tasks werden mehrere Agents/Skills koordiniert
6. **Output + Memory Update** — Ergebnis wird ausgegeben, relevante Informationen in Graphiti geschrieben

**LangGraph** wird für die Multi-Agent-Orchestrierung genutzt — ein bewährtes Framework das Stateful Workflows, Conditional Routing und parallele Agent-Ausführung ermöglicht.

#### Schicht 3: Memory Layer (Graphiti + FalkorDB)

**Was**: Das Langzeitgedächtnis des Systems. Ein Temporaler Knowledge Graph — nicht eine simple Datenbank, nicht flache Markdown-Dateien.

**Warum Graphiti statt flat files** (wie PAI es aktuell macht): PAI speichert Learnings in Markdown-Files (LEARNED.md, hot/warm/cold Tier). Das ist nett aber fundamentally limitiert:
- Keine Zeitdimension (wann wurde etwas gesagt/entschieden?)
- Keine Relationen zwischen Entitäten
- Keine komplexen Queries ("Alle offenen Themen mit Kunden seit Januar")
- Keine automatische Verknüpfung neuer Informationen mit Bestehendem

Graphiti löst all das. Es ist ein temporaler Knowledge Graph der speziell für AI Agents entwickelt wurde — entwickelt von Zep AI, open-source, self-hostable.

**Wie es funktioniert**: Jede Interaktion, jedes Meeting, jede Idee, jede Entscheidung wird als Node im Graph gespeichert. Nodes haben Zeitstempel, Gültigkeitsdauer und Relationen zu anderen Nodes. Das ermöglicht Queries wie:
- "Was haben wir beim letzten Termin mit Rudolf besprochen?" → sucht Meeting-Nodes mit Rudolf, sortiert nach Datum, gibt Zusammenfassung
- "Welche meiner Ideen hängen mit Agent One zusammen?" → Graph-Traversal von TELOS.IDEAS über Relations zu PROJECTS.agent_one
- "Was hat sich seit letzter Woche bei Projekt X verändert?" → Temporal Query auf Project-Node, zeigt Diff

#### Schicht 4: Action Layer (n8n + MCP)

**Was**: Die Hände des Systems. Verbindet PAI-X mit der Außenwelt — E-Mail, Kalender, Drive, Social Media, etc.

**Warum n8n**: n8n ist self-hostable, DSGVO-konform (alle Daten bleiben auf Hetzner in Deutschland), hat 400+ Integrationen und kann als MCP-Server agieren. Oliver hat bereits Erfahrung mit n8n und laufende Workflows.

**Warum MCP (Model Context Protocol)**: MCP ist Anthropics Standard für Tool-Integration. Es ermöglicht dem LLM direkten Zugriff auf strukturierte Tools mit definierten Input/Output-Schemas. Aktuell verbundene MCP-Server:
- Gmail (E-Mail lesen, verfassen, senden)
- Google Calendar (Termine anzeigen, erstellen, bearbeiten)
- Google Drive (Dateien suchen, lesen, ablegen)
- NocoDB (strukturierte Daten speichern und abfragen)
- n8n Workflow Builder (n8n-Flows triggern)

**Wie es funktioniert**: Der Intelligence Layer entscheidet, welche Aktion nötig ist → ruft den entsprechenden MCP-Server auf → der MCP-Server führt die Aktion aus → Ergebnis kommt zurück → wird in Memory gespeichert und dem Nutzer kommuniziert.

*Beispiel*: "Verschiebe den Termin mit Rudolf auf nächste Woche Dienstag."
1. Intelligence Layer erkennt: Termin-Verschiebung, Person: Rudolf
2. Graphiti: Wer ist Rudolf? (Steuerberater, E-Mail: rudolf@..., letzter Kontakt: 3.2.)
3. MCP Google Calendar: Suche aktuellen Termin mit Rudolf → gefunden: Donnerstag 10:00
4. MCP Google Calendar: Prüfe Verfügbarkeit nächster Dienstag → 14:00 frei
5. MCP Gmail: Verfasse E-Mail an Rudolf → "Lieber Rudolf, könnten wir unseren Termin auf Dienstag, 14:00 verschieben?"
6. MCP Gmail: Sende E-Mail
7. MCP Google Calendar: Erstelle neuen Termin (pending, bis Bestätigung)
8. Graphiti: Update Meeting-Node Rudolf — Status "Verschoben, awaiting confirmation"
9. Output: "Ich habe Rudolf eine E-Mail geschickt und einen Vorschlag für Dienstag 14:00 gemacht. Ich informiere dich wenn er antwortet."

#### Schicht 5: Interface Layer (Next.js 16 + shadcn/ui)

**Was**: Die Oberfläche. Web-App + PWA. Der einzige Teil den der Nutzer direkt sieht und anfasst.

**Warum Next.js 16**: Neueste Next.js-Version mit React 19, verbessertem App Router, nativer PWA-Unterstützung über next-pwa/Workbox, Server Components für Performance.

**Warum shadcn/ui Template**: Professionelles, konsistentes Design-System aus dem vorhandenen Template. Keine fremden Komponentenbibliotheken — ausschließlich die Komponenten aus dem Template werden genutzt, um Konsistenz zu gewährleisten.

**Warum PWA**: Die kritischsten Use Cases sind mobile:
- Unterwegs beim Spazierengehen eine Idee einsprechen
- Im Auto einen Termin verschieben lassen
- Beim Kaffee das Morgen-Briefing lesen
Eine native App würde denselben Tech-Stack brauchen plus App-Store-Overhead. PWA gibt 90% der nativen Erfahrung ohne den Aufwand.

---

## 7. TELOS — Identity Layer

### Konzept

TELOS (aus dem Griechischen: Zweck, Ziel) ist das Herzstück von PAI-X. Es ist das strukturierte Selbst-Modell des Nutzers — nicht als statische Konfiguration, sondern als lebendiger, sich entwickelnder Graph.

Das Konzept stammt direkt aus PAI v2.5 von Daniel Miessler, wo es als 10-File-System in Markdown implementiert ist. In PAI-X wird es als Graphiti-Graph implementiert, der:
- Menschlich lesbar im Dashboard visualisiert wird
- Vom Nutzer direkt editierbar ist
- Vom Agenten automatisch befüllt und aktualisiert wird
- Als Kontext in jede KI-Anfrage einfließt

### Die 10 TELOS-Dimensionen

#### 1. MISSION
**Was**: Der übergeordnete Lebens- und Arbeitszweck des Nutzers.  
**Wozu**: Gibt dem Agenten den "Nordstern" für alle Entscheidungen. Wenn ein Vorschlag nicht zur Mission passt, wird der Agent das sagen.  
**Wie befüllt**: Beim Setup-Interview (geführte Fragen). Selten geändert.  
**Beispiel Oliver**: "Menschen durch KI-Automatisierung mächtiger machen, insbesondere im deutschen Mittelstand — und dabei selbst finanziell unabhängig werden."

#### 2. GOALS
**Was**: Konkrete, messbare Ziele in verschiedenen Zeithorizonten.  
**Wozu**: Der Agent priorisiert Tasks, Empfehlungen und Informationen basierend auf den aktuellen Goals. "Sollte ich auf diese Konferenz gehen?" → Agent prüft gegen Goals.  
**Wie befüllt**: Setup + regelmäßige Reviews (wöchentlich, monatlich, quartalsweise).  
**Struktur**:
```
GOALS:
  90_days:
    - "Agent One Pilot mit Benjamin Arras starten"
    - "20 zahlende Community-Mitglieder (Premium)"
    - "€5.000 MRR aus Community + Consulting"
  1_year:
    - "Agent One: 50 zahlende Kunden"
    - "Vollständiger Exit aus Conversion Junkies"
  5_years:
    - "HR Code Labs GbR zu einer €1M ARR Company"
```

#### 3. PROJECTS
**Was**: Alle aktiven Projekte mit Status, Kontext, letzten Aktionen und nächsten Schritten.  
**Wozu**: Der Agent kann proaktiv auf Fortschritt hinweisen, Deadlines tracken und Kontext für jeden Kunden-/Projektbezug liefern.  
**Wie befüllt**: Manuell + automatisch (Agent schreibt neue Erkenntnisse aus Gesprächen rein).  
**Struktur**:
```
PROJECTS:
  agent_one:
    status: "70% complete"
    description: "Proaktiver KI-Assistent für §203-Berufsträger"
    pilot: "Benjamin Arras (Steuerberater)"
    last_update: "2026-02-20"
    next_steps:
      - "TELOS-Schema in Graphiti finalisieren"
      - "Erstes Chat-Interface bauen"
    blockers: []
```

#### 4. BELIEFS
**Was**: Die Grundüberzeugungen des Nutzers — über Business, Technologie, Menschen, Welt.  
**Wozu**: Der Agent filtert Empfehlungen durch diese Beliefs. Empfehlungen die diesen Überzeugungen widersprechen werden anders kommuniziert.  
**Beispiel**: "Ich glaube, dass gute Software einfach sein muss. Komplexität ist ein Zeichen von schlechtem Design." → Agent wird bei technischen Empfehlungen immer die einfachste Lösung bevorzugen.

#### 5. MODELS
**Was**: Mentale Modelle und Frameworks die der Nutzer anwendet.  
**Wozu**: Der Agent nutzt diese Frameworks wenn er Probleme analysiert oder Empfehlungen gibt.  
**Beispiel**: "First Principles Thinking", "Jobs to be Done", "Pareto-Prinzip (80/20)"

#### 6. STRATEGIES
**Was**: Aktuelle Strategien per Lebensbereich.  
**Wozu**: Gibt dem Agenten Kontext für strategische Entscheidungen in verschiedenen Bereichen.  
**Struktur**:
```
STRATEGIES:
  business: "Product-Led Growth + Community als Primary Distribution"
  content: "Wöchentlich 1 YouTube-Video + täglicher TikTok + 3x LinkedIn/Woche"
  health: "Tägliches Laufband + Calisthenics, 7-8h Schlaf"
  learning: "Ein neues KI-Tool pro Woche testen und dokumentieren"
```

#### 7. NARRATIVES
**Was**: Die Geschichte die der Nutzer über sich selbst erzählt — professionell und persönlich.  
**Wozu**: Hilft beim Erstellen von Bio-Texten, Über-mich-Seiten, Pitch-Decks, LinkedIn-Profilen.  
**Beispiel**: "Ich bin ein Entwickler mit 20 Jahren Erfahrung, der früh erkannt hat, dass KI alles verändert — und der jetzt anderen hilft, diese Veränderung als Chance zu nutzen."

#### 8. LEARNED
**Was**: Erkenntnisse aus Erfahrungen — kontinuierlich befüllt vom Agenten.  
**Wozu**: Verhindert, dass Fehler wiederholt werden. Verstärkt was funktioniert hat.  
**Wie befüllt**: Nach jedem Meeting, jedem abgeschlossenen Projekt, jedem Experiment schreibt der Agent relevante Learnings rein.  
**Beispiel**: "2026-02-15: PAI + Claude Code direkt in Produktion gehen ist zu komplex. Besser: Erst Konzept, dann MVP, dann iterieren."

#### 9. CHALLENGES
**Was**: Aktuelle Hindernisse und wie der Nutzer damit umgeht.  
**Wozu**: Der Agent kann bei Challenges aktiv helfen — Ressourcen suchen, Strategien vorschlagen, Fortschritt tracken.  
**Beispiel**: "Challenge: Zeit-Management zwischen Kunden-Projekten und eigenem Produkt-Build. Aktuell: Strikte Time-Blocking-Strategie."

#### 10. IDEAS
**Was**: Ideen-Pool — ungefiltert, aus allen Kanälen.  
**Wozu**: Ideen gehen nicht verloren. Der Agent verknüpft neue Ideen mit bestehenden Projekten und Zielen. Regelmäßige Synthese ("Diese 3 Ideen könnten zu einem Projekt werden").  
**Wie befüllt**: Voice-Notizen, Chat-Gespräche, manuell. Automatisch kategorisiert.

### TELOS im Dashboard

Im Dashboard wird TELOS als editierbares "Lebensdokument" visualisiert. Der Nutzer sieht:
- Eine Übersichtsseite mit allen 10 Dimensionen
- Jede Dimension ist inline editierbar (kein separates Formular)
- Zeitstempel zeigen wann was zuletzt aktualisiert wurde
- Grün markiert: Vom Agenten automatisch hinzugefügt (kann bestätigt oder gelöscht werden)
- Orange markiert: Veraltete Einträge die ein Review brauchen (z.B. Goal das längst erreicht wurde)

---

## 8. Skills System

### Konzept

Skills sind die modularen Fähigkeiten von PAI-X. Jeder Skill ist:
- **Selbstständig**: Kann unabhängig von anderen Skills funktionieren
- **Testbar**: Hat klare Input/Output-Definitionen
- **Komposierbar**: Skills können von anderen Skills aufgerufen werden
- **Ein- und ausschaltbar**: Im Dashboard konfigurierbar

Skills folgen einer klaren Routing-Hierarchie (aus PAI Prinzip 11):
1. **Deterministische Logik** (Keywords, Regex, klare Intent-Signale) → direktes Routing ohne LLM
2. **LLM Intent Classification** → wenn mehrdeutig
3. **Skill-Ausführung** mit vollem TELOS + Memory Kontext
4. **Output + Memory-Update** (Graphiti)

### Core Skills — Phase 1 (MVP)

#### Skill 1: Calendar & Briefing

**Zweck**: Proaktives Terminmanagement und tägliches Briefing.

**Wann es genutzt wird**:
- Täglich 07:30 Uhr (Cron-Trigger)
- 60 Minuten vor jedem Termin (proaktiver Push)
- Auf Anfrage: "Was steht heute/morgen/diese Woche an?"
- Auf Befehl: "Verschiebe den Termin mit X auf Y"

**Wie es funktioniert**:
```
TAGES-BRIEFING (07:30 Cron):
1. MCP Google Calendar: Hole alle Termine für heute
2. Graphiti: Für jeden Termin — lade Kontext (Person, letzte Interaktionen, offene Items)
3. Graphiti: Lade offene Tasks + Deadlines die heute relevant sind
4. TELOS: Goals die heute vorangebracht werden könnten
5. Synthesize: Erstelle strukturiertes Briefing
6. Push: Via PWA Notification + Telegram (konfigurierbar)

PRE-MEETING (60 Min vorher):
1. MCP Google Calendar: Erkenne kommenden Termin in 60 Min.
2. Graphiti: Person-Node laden (Beziehung, letzter Kontakt, offene Punkte)
3. Graphiti: Meeting-History mit dieser Person
4. Graphiti: Relevante Projekte/Topics
5. Push: "Du hast in 60 Min Termin mit [Name]. Hier ist der Kontext: ..."

TERMIN VERSCHIEBEN:
1. Intent: Erkennt "verschiebe Termin mit X auf Y"
2. Graphiti: Wer ist X? (E-Mail, Beziehung)
3. MCP Calendar: Finde aktuellen Termin mit X
4. MCP Calendar: Prüfe Verfügbarkeit für Y
5. MCP Gmail: Verfasse und sende Verschiebungs-E-Mail
6. MCP Calendar: Aktualisiere Termin (pending)
7. Graphiti: Update Meeting-Status
8. Output: Zusammenfassung der Aktion
```

**Output-Formate**:
- Morgen-Briefing: Strukturierte Karte im Dashboard + Push Notification
- Pre-Meeting: Push Notification mit Summary + Link zur Detail-Ansicht
- Termin-Aktionen: Kurze Bestätigungsnachricht + Detailprotokoll im Meeting-Log

#### Skill 2: Content Pipeline

**Zweck**: Vollautomatische Content-Erstellung aus beliebigen Quellen.

**Wann es genutzt wird**:
- Wenn eine URL geteilt wird (YouTube, Artikel, Website)
- Wenn ein Dokument hochgeladen wird (PDF, DOCX)
- Wenn Rohtext eingegeben wird
- Auf expliziten Befehl: "Mach daraus einen Blogpost"

**Wie es funktioniert**:
```
INPUT PROCESSING:
YouTube-URL → yt-dlp Audio → Whisper Transkription
Artikel-URL → Web Scraper → Text-Extraktion + Bereinigung
PDF/DOCX → Extraktion → Text
Text direkt → weiter

CONTENT STEPS (modular, jeder Schritt optional):
1. ZUSAMMENFASSUNG: Key Points, Kernaussagen, Essenz
2. BLOGPOST: Vollständiger Artikel in Oliver's Schreibstil
   (aus Memory: vergangene Blogposts → Stil-Analyse → konsistenter Output)
3. LINKEDIN: Angepasster Post (Hook + Value + CTA, <1.300 Zeichen)
4. TWITTER/X: Thread oder Single-Tweet
5. INSTAGRAM CAPTION: Visual-begleitend
6. ABLAGE: NocoDB-Eintrag + Drive-Datei

CONTENT TEAM ÜBERGABE (Phase 2):
7. STATUS → "Bereit für Review" im Content Pipeline Dashboard
8. SCHEDULING → Nächster freier Slot laut Content-Kalender
9. POSTING → Via n8n Flow (LinkedIn API, etc.)
10. TRACKING → Engagement-Daten zurück in Memory
```

**Output im Dashboard**:
- Content Pipeline View zeigt alle Assets in verschiedenen Stages
- Jedes Asset ist inline editierbar vor dem Posting
- Freigabe-Workflow: Draft → Review → Approved → Scheduled → Posted

#### Skill 3: Ideen & Voice Memory

**Zweck**: Kein guter Gedanke geht verloren. Erfassung, Kategorisierung und Vernetzung von Ideen aus allen Kanälen.

**Wann es genutzt wird**:
- Voice-Notiz in der PWA (primärer Mobile-Use-Case)
- Text-Eingabe: "Idee: ..."
- Automatisch erkannt in normalen Gesprächen

**Wie es funktioniert**:
```
VOICE-CAPTURE (PWA):
1. Nutzer öffnet App, tippt Mic-Button
2. Aufnahme startet (auch offline — Aufnahme in IndexedDB)
3. Bei Verbindung: Whisper-Transkription
4. Intent-Analyse: Ist das eine Idee, ein Task, eine Info über eine Person?
5. Kategorisierung:
   - Idee → TELOS.IDEAS
   - Task → Task-Manager
   - Person-Info → Person-Node in Graphiti aktualisieren
6. Verknüpfung mit existierenden Nodes (automatisch via Graphiti)
7. Bestätigung: "Idee gespeichert. Ich habe sie mit Projekt X verknüpft."

IDEEN-SYNTHESIS (wöchentlich, Cron):
1. Alle neuen IDEAS der letzten 7 Tage aus Graphiti holen
2. Verbindungen zwischen Ideen analysieren (LLM)
3. Potenzielle Projekte identifizieren
4. Push: "Du hattest diese Woche 7 neue Ideen. Hier sind 3 interessante Verbindungen: ..."
```

**Besonderheit Offline**: Die PWA kann Sprachaufnahmen offline speichern. Sobald wieder online, werden sie automatisch transkribiert und verarbeitet. Für den unterwegs-beim-Spazierengehen Use Case fundamental.

#### Skill 4: Document Creation & Management

**Zweck**: Dokumente erstellen, suchen, ablegen — ohne manuelles Schreiben oder Suchen.

**Wann es genutzt wird**:
- "Erstelle mir ein Angebot für Benjamin Arras"
- "Schreib eine Meeting-Zusammenfassung"
- "Finde das Dokument von letztem Monat über X"
- "Schick das Angebot an Rudolf als E-Mail"

**Wie es funktioniert**:
```
DOKUMENT ERSTELLEN:
1. Intent + Entity-Extraktion (Typ: Angebot, Person: Benjamin Arras)
2. Graphiti: Benjamin Arras Kontext laden (letzte Gespräche, Projekte, Preise)
3. Template-Auswahl (aus NocoDB Template-Library)
4. TELOS: Relevante Infos (Firmenname, Kontaktdaten, Leistungen)
5. LLM: Dokument generieren mit vollem Kontext
6. Output: DOCX + PDF generiert via Python-docx/ReportLab
7. Drive: Ablage in korrektem Ordner (auto-strukturiert)
8. NocoDB: Eintrag in Document-Log
9. Optional: E-Mail-Entwurf mit Anhang

DOKUMENT SUCHEN:
1. Intent: Suche ("Finde das Angebot von letztem Monat")
2. Graphiti: Semantische Suche in Document-Nodes
3. Drive MCP: Direkter Zugriff auf gefundene Dateien
4. Output: Link + Preview + Zusammenfassung
```

#### Skill 5: Research

**Zweck**: Tiefe Recherche zu beliebigen Themen — synthetisiert, nicht nur gesammelt.

**Wann es genutzt wird**:
- "Recherchiere Wettbewerber für Agent One im deutschen Markt"
- "Was sind die neuesten Entwicklungen in LangGraph?"
- "Erstelle mir ein Briefing über den deutschen Steuerberater-Markt"

**Wie es funktioniert**:
```
1. Query-Expansion: Aus Nutzerfrage mehrere Such-Queries ableiten
2. Web Search (Anthropic Search Tool im API-Call)
3. Relevanz-Filtering: Unwichtige Quellen aussortieren
4. Synthese: Alle Quellen zu kohärentem Dokument zusammenfassen
5. Struktur: Executive Summary + Key Points + Quellen
6. Ablage: In Graphiti als Research-Node (future reference)
7. Output: Formatiertes Briefing-Dokument
```

### Phase 2 Skills

- **Email Management**: Postfach scannen, priorisieren, Antworten vorschlagen, autonom beantworten (konfigurierbares Autonomie-Level)
- **Task Management**: Tasks aus Gesprächen extrahieren, tracken, erinnern
- **CRM**: Kontakt-Informationen automatisch aus Gesprächen und E-Mails aktualisieren
- **Meeting Summary**: Nach Meetings (Kalender + Transcript) automatisch Zusammenfassung + Action Items erstellen

### Phase 3 Skills

- **Financial Tracking**: Rechnungen, Zahlungen, MRR tracken
- **Health Tracking**: Fitness-Routine tracken, proaktive Erinnerungen
- **Learning**: Neue Technologien, Kurse, Bücher tracken und Learnings festhalten
- **Coding Agent**: Claude Code als Sub-Agent für Code-Tasks

---

## 9. Memory System

### Warum Graphiti

Das Memory System ist das, was PAI-X von allen anderen Lösungen unterscheidet. Die meisten KI-Systeme haben entweder kein persistentes Memory oder speichern Informationen flach (Markdown-Files, Vektordatenbank ohne Relationen).

**Graphiti** ist ein Open-Source Temporal Knowledge Graph Framework, entwickelt von Zep AI, designed speziell für AI Agents. Es kombiniert:

- **Property Graph** (wie Neo4j): Entitäten mit Attributen, verbunden durch typisierte Relationen
- **Temporale Dimension**: Jeder Node und jede Kante hat Zeitstempel — "wann war das gültig?"
- **Episode-basiert**: Neue Informationen werden als Episoden gespeichert, nicht als Überschreibungen
- **Semantische Suche**: Nodes können semantisch (nicht nur keyword-basiert) gefunden werden

### FalkorDB als Backend

FalkorDB ist eine spezialisierte Graph-Datenbank mit Cypher-Query-Sprache, optimiert für hohe Performance. Es ist open-source, self-hostable und DSGVO-konform wenn auf Hetzner gehostet.

### Node-Typen

```
Person:
  id: uuid
  name: string
  email: string
  role: string (z.B. "Steuerberater", "Pilot-Kunde")
  relationship: string (z.B. "Kunde", "Kollege", "Partner")
  preferences: {communication: "E-Mail", meeting_style: "Direkt"}
  last_contact: datetime
  created_at: datetime

Meeting:
  id: uuid
  title: string
  participants: [Person.id]
  date: datetime
  duration: int (minutes)
  summary: string
  key_points: [string]
  action_items: [{text: string, owner: Person.id, due: date, status: string}]
  mood: string (optional, aus Kontext erkannt)

Project:
  id: uuid
  name: string
  status: enum [active, paused, completed, cancelled]
  description: string
  start_date: date
  target_date: date
  completion: int (0-100%)
  last_update: datetime

Idea:
  id: uuid
  content: string
  source: enum [voice, chat, manual]
  category: string
  created_at: datetime
  related_projects: [Project.id]
  status: enum [raw, evaluated, parked, acting_on]

Task:
  id: uuid
  title: string
  description: string
  due_date: date
  priority: enum [urgent, high, medium, low]
  related_to: [Person.id | Project.id | Meeting.id]
  status: enum [open, in_progress, done, cancelled]

Document:
  id: uuid
  title: string
  type: enum [offer, contract, report, note, blogpost, ...]
  drive_url: string
  created_at: datetime
  related_to: [Person.id | Project.id]
  summary: string

ConversationEpisode:
  id: uuid
  timestamp: datetime
  channel: enum [chat, voice, email]
  summary: string
  entities_mentioned: [any Node.id]
  learnings: [string]
```

### Relationen

```
Person --[HAS_MEETING]--> Meeting
Person --[INVOLVED_IN]--> Project
Person --[ASSIGNED_TO]--> Task
Project --[HAS_TASK]--> Task
Project --[RELATED_TO]--> Idea
Meeting --[GENERATED]--> Task
Meeting --[DISCUSSED]--> Idea
Document --[CREATED_FOR]--> Person
Document --[BELONGS_TO]--> Project
ConversationEpisode --[MENTIONED]--> Person
ConversationEpisode --[MENTIONED]--> Project
ConversationEpisode --[GENERATED]--> Idea
```

### Memory-Zugriff im Intelligence Layer

Jede Anfrage an den Intelligence Layer löst automatisch einen Graphiti-Query aus:

```python
# Kontext-Enrichment für jede Anfrage
async def enrich_context(query: str, user_id: str) -> Context:
    # Entity-Erkennung in der Anfrage
    entities = await extract_entities(query)
    
    # Graphiti-Queries für jede erkannte Entität
    context_nodes = []
    for entity in entities:
        nodes = await graphiti.search(
            query=entity,
            user_id=user_id,
            max_results=10,
            time_weight=0.7  # Neuere Informationen wichtiger
        )
        context_nodes.extend(nodes)
    
    # TELOS als immer-verfügbaren Hintergrundkontext
    telos = await graphiti.get_telos(user_id)
    
    return Context(
        telos=telos,
        relevant_nodes=context_nodes,
        entities=entities
    )
```

### Memory-Update nach jeder Interaktion

```python
# Nach jeder abgeschlossenen Interaktion
async def update_memory(interaction: Interaction, output: Output):
    episode = ConversationEpisode(
        timestamp=now(),
        channel=interaction.channel,
        summary=await summarize(interaction),
        entities_mentioned=await extract_entities(interaction),
        learnings=await extract_learnings(interaction, output)
    )
    
    await graphiti.add_episode(episode)
    
    # TELOS-Updates wenn nötig
    if new_idea := await detect_idea(interaction):
        await graphiti.add_node(Idea(content=new_idea))
    
    if new_learning := await detect_learning(interaction):
        await graphiti.update_telos("LEARNED", new_learning)
```

---

## 10. Proaktivitäts-Engine

### Konzept

Proaktivität ist das Feature das PAI-X vom Chatbot zum Assistenten macht. Die Proaktivitäts-Engine ist ein separates System das kontinuierlich im Hintergrund läuft und proaktiv Aktionen auslöst — ohne dass der Nutzer etwas tun muss.

### Technische Implementierung

```
n8n Cron Scheduler
       │
       ▼
Proaktivitäts-Worker (FastAPI Background Task)
       │
       ├─── Graphiti Query: Was ist heute relevant?
       ├─── Calendar MCP: Welche Termine kommen?
       ├─── Task Query: Welche Deadlines laufen ab?
       ├─── TELOS Query: Welche Goals könnten heute vorangebracht werden?
       │
       ▼
Relevanz-Filter: Was davon ist wirklich wichtig genug für einen Push?
       │
       ▼
Output-Router:
       ├─── PWA Push Notification (primär)
       ├─── Telegram Message (Backup/konfigurierbar)
       ├─── Dashboard Notification (immer)
       └─── E-Mail (nur für kritische Items)
```

### Proaktive Trigger — Detailspezifikation

#### Trigger 1: Tages-Briefing
- **Auslöser**: Cron, täglich 07:30 (konfigurierbar)
- **Inhalt**:
  - Alle Termine des Tages mit Kontext
  - Top-3-Priorities (aus Goals + offenen Tasks)
  - Offene Action Items aus den letzten 7 Tagen
  - Eine "Idee des Tages" aus dem IDEAS-Pool
- **Kanal**: PWA Push + Dashboard Update + optional Telegram
- **Ton**: Kurz, präzise, motivierend

#### Trigger 2: Pre-Meeting Alert
- **Auslöser**: 60 Minuten vor jedem Kalender-Termin (konfigurierbar: 30/60/90 Min)
- **Inhalt**:
  - Wer kommt? (Person-Node aus Graphiti)
  - Was haben wir zuletzt besprochen? (letzte Meeting-Nodes mit dieser Person)
  - Offene Action Items von beiden Seiten
  - Relevante Projekte/Dokumente
  - Optional: Vorbereitungsfragen
- **Kanal**: PWA Push + Dashboard
- **Ton**: Sachlich, strukturiert

#### Trigger 3: Follow-up Erinnerung
- **Auslöser**: 48 Stunden nach Meeting-Ende, wenn Action Items noch offen sind
- **Inhalt**: "Dein Meeting mit X war vor 48h. Folgende Action Items sind noch offen: ..."
- **Kanal**: PWA Push + Dashboard
- **Abschaltbar**: Pro Meeting oder generell

#### Trigger 4: Deadline Warning
- **Auslöser**: 72 Stunden vor Deadline eines Tasks/Projekts
- **Inhalt**: Deadline-Warnung + aktueller Status + was noch nötig ist
- **Eskalation**: 24h vorher nochmal wenn noch nicht erledigt

#### Trigger 5: Ideen-Synthesis
- **Auslöser**: Jeden Sonntag 10:00 (konfigurierbar)
- **Inhalt**: Alle neuen Ideen der Woche + erkannte Verbindungen + potenzielle nächste Schritte
- **Wert**: Macht aus dem Ideen-Stream echte strategische Impulse

#### Trigger 6: Content-Lücken-Warnung
- **Auslöser**: Wenn 5+ Tage kein Content gepostet wurde (konfigurierbar)
- **Inhalt**: Erinnerung + 2-3 automatisch generierte Content-Entwürfe aus dem Content-Buffer
- **Kontext**: Aus TELOS.STRATEGIES.content + letzten geposteten Inhalten

#### Trigger 7: Goal-Progress-Review
- **Auslöser**: Jeden Freitag 17:00 (konfigurierbar)
- **Inhalt**: Wochenbilanz — welche Goals wurden vorangebracht? Was lag brach? Warum?
- **Wert**: Macht strategische Drift sichtbar bevor sie zum Problem wird

#### Trigger 8: Eingehende E-Mail Priorität
- **Auslöser**: Neue E-Mail die als "urgent" oder von priorisierten Kontakten klassifiziert wird
- **Inhalt**: Zusammenfassung der E-Mail + Antwortvorschlag
- **Konfigurierbar**: Welche Kontakte / welche Keywords lösen Push aus

### Autonomie-Level (konfigurierbar pro Nutzer)

PAI-X arbeitet mit konfigurierbaren Autonomie-Leveln — der Nutzer entscheidet wie viel er delegiert:

```
Level 1 — Informieren: "Es gibt einen Termin-Konflikt. Was soll ich tun?"
Level 2 — Vorschlagen: "Ich schlage vor, den Termin auf Dienstag zu verschieben. OK?"
Level 3 — Ausführen mit Bestätigung: "Ich habe eine E-Mail vorbereitet. Soll ich senden?"
Level 4 — Autonom mit Protokoll: "Ich habe den Termin verschoben. Hier ist was ich getan habe."
Level 5 — Vollautonomen: Nur bei kritischen Abweichungen informieren
```

Standard: Level 3. Kann pro Skill und pro Kontext konfiguriert werden.

---

## 11. Interface & Dashboard

### Design-Prinzipien

1. **Chat ist primär** — der Chat ist das Interface, nicht ein Feature
2. **Dashboard ist Überblick, nicht Konfiguration** — komplexe Einstellungen kommen in Settings, nicht in den Workflow
3. **Alles hat einen Kontext** — jede Karte, jede Ansicht zeigt woher die Information kommt
4. **Editierbar in-place** — kein Wechsel zwischen View und Edit Mode
5. **Mobile First** — jedes Element muss auf 375px Bildschirmbreite perfekt funktionieren
6. **PWA-Qualität** — installierbar, offline-fähig, native Feels

### UI Framework

**Ausschließlich shadcn/ui Komponenten aus dem vorhandenen Template.**

Das Template (`/media/oliver/Platte 2 (Netac)2/shadcn-ui-kit-dashboard/`) wird geclont und angepasst. Keine externen Komponenten außer den im Template enthaltenen werden genutzt. Neue Komponenten werden aus den Template-Komponenten abgeleitet (extending, not replacing).

**Begründung**: Konsistenz ist wichtiger als Vollständigkeit. Ein System das komplett konsistent in einem Design-System ist, wirkt professioneller als eines das viele verschiedene Komponenten-Libraries mischt.

### Core Views — Detailspezifikation

#### View 1: Chat Interface (Haupt-Interface)

**Layout**:
```
┌─────────────────────────────────────────────────┐
│  Sidebar (kollaps.)  │  Chat Area               │
│  Navigation          │                          │
│  Recent Chats        │  [Message History]       │
│  Quick Actions       │                          │
│                      │  [Context Panel]         │
│                      │  (optional, ausklappbar) │
│                      │                          │
│                      │  [Input: Text + Mic]     │
└─────────────────────────────────────────────────┘
```

**Features**:
- Real-time Streaming der Antworten (kein Warten auf vollständige Antwort)
- Kontext-Panel (ausklappbar rechts): Zeigt welche Memory-Nodes gerade genutzt werden
- Skill-Indicator: Welcher Skill ist aktiv? (kleines Badge)
- Voice-Button: Wechsel zwischen Text und Voice Input
- History: Vergangene Gespräche mit Suche
- Attachment: Dateien, URLs, Bilder direkt reinziehen
- Code-Blöcke mit Syntax-Highlighting
- Tabellen, Listen, Markdown korrekt gerendert

#### View 2: Dashboard Home

**Layout**: Card-Grid System aus dem shadcn Template

**Cards**:
- **Heute** (oben, full-width): Alle Termine des Tages, Timeline-Darstellung
- **Priorities** (links): Top-3-Tasks/Goals für heute
- **Recent** (rechts): Letzte Aktivitäten (Notizen, Dokumente, Gespräche)
- **Ideas** (unten links): Neue Ideen der letzten 7 Tage
- **Content Status** (unten rechts): Nächster geplanter Post + Status Pipeline

**Proaktive Notifications**: Am oberen Rand der Page — Bannersystem aus dem Template für aktive Proaktiv-Alerts

#### View 3: TELOS Editor

**Layout**: Tab-basiert, eine Dimension pro Tab

**Funktionalität**:
- Inline-Editing mit auto-save
- Versionshistorie (wer hat wann was geändert — Nutzer oder Agent?)
- Agent-Additions in Grün markiert mit Bestätigungs-Button
- Veraltete Einträge in Orange mit "Review needed"
- Graph-Visualisierung (optional aufklappbar): Zeigt Verbindungen zwischen TELOS-Nodes

#### View 4: Content Pipeline

**Layout**: Kanban-Board (shadcn Table oder Custom aus Template)

**Spalten**: 
```
Source → Transcript → Draft → Review → Approved → Scheduled → Posted
```

**Pro Asset**:
- Thumbnail/Vorschau
- Titel + Quelle
- Erstellt am + von welchem Skill
- Ziel-Kanal (LinkedIn, Blog, etc.)
- Geplantes Datum
- Aktionen: Bearbeiten, Freigeben, Löschen, Verschieben

**Detail-View**: Alle Versionen des Assets (Original → Transkript → Blogpost → LinkedIn-Version), alle inline editierbar

#### View 5: Memory Browser

**Layout**: Graph-Visualisierung + List-View (toggle)

**Features**:
- Interaktiver Graph: Nodes und Kanten, zoombar, klickbar
- Filter: Nach Node-Typ, Zeitraum, Person, Projekt
- Detail-Panel: Klick auf Node öffnet vollständige Informationen
- Zeitreise: Slider für "wie sah der Graph an Datum X aus?"
- Suche: Semantische Suche durch alle Memory-Nodes

#### View 6: Skills Manager

**Layout**: Card-Grid mit ein Skill pro Card

**Pro Skill-Card**:
- Name + Beschreibung
- Status: Aktiv/Inaktiv (Toggle)
- Letzte Ausführung + Ergebnis
- Performance-Metriken (Erfolgsquote, durchschnittliche Ausführungszeit)
- Konfiguration (Autonomie-Level, Trigger-Settings)
- Log: Letzte 10 Ausführungen

#### View 7: Agent Teams (Phase 2)

**Layout**: Team-Cards mit Mitglieder-Übersicht

**Pro Team**:
- Team-Name + Beschreibung
- Aktive Agents mit Status
- Aktuell laufende Tasks
- Letzte Outputs
- Performance-Metriken

#### View 8: Settings

**Kategorien**:
- **Profil**: Name, Zeitzone, Sprache, Avatar
- **Notifications**: Welche proaktiven Trigger sind aktiv, Kanäle, Zeiten
- **Integrationen**: Verbundene MCP-Server, Auth-Status, Permissions
- **Autonomie**: Default-Level pro Skill
- **Voice**: STT-Engine, TTS-Voice, Sprache
- **Appearance**: Dark/Light Mode, Dichte (Compact/Comfortable)
- **Billing** (Phase 4): Plan, Nutzung, Rechnungen

### PWA-Spezifika

**Manifest**:
```json
{
  "name": "PAI-X Personal Assistant",
  "short_name": "PAI-X",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "icons": [/* verschiedene Größen */],
  "start_url": "/chat",
  "scope": "/"
}
```

**Offline-Funktionen**:
- Chat-History lesbar (aus IndexedDB Cache)
- Sprachaufnahmen möglich (gespeichert in IndexedDB, sync bei Verbindung)
- Dashboard lesbar (cached letzte Version)
- Neue Anfragen: Queued, werden bei Verbindung ausgeführt

**Mobile-Optimierungen**:
- Bottom Navigation Bar statt Sidebar
- Touch-optimierte Tap-Targets (min. 44px)
- Haptic Feedback bei wichtigen Aktionen (wo API verfügbar)
- Voice-Button prominenter auf Mobile

---

## 12. Voice System

### Konzept

Voice ist kein Nice-to-have — es ist der primäre Mobile-Use-Case. Der Nutzer will beim Spazierengehen mit dem Assistenten sprechen, nicht tippen.

### Architektur

```
Input:
Mikrofon (Browser WebRTC API)
       │
       ▼
LiveKit (WebRTC Streaming)
       │
       ▼
Whisper STT (self-hosted, faster-whisper)
       │
       ▼
Text → Intelligence Layer (wie normaler Chat)
       │
       ▼
LLM Output (Text)
       │
       ▼
ElevenLabs TTS (oder OpenAI TTS als Fallback)
       │
       ▼
LiveKit → Browser → Lautsprecher
```

### STT (Speech-to-Text)

**Primär**: `faster-whisper` (self-hosted auf Hetzner)
- Open-source, DSGVO-konform
- Deutsch optimiert (whisper-large-v3)
- Latenz: ~500ms für 10 Sekunden Audio
- Kein API-Kosten, unbegrenzte Nutzung

**Fallback**: OpenAI Whisper API
- Wenn self-hosted ausfällt
- Höhere Latenz, API-Kosten, aber immer verfügbar

### TTS (Text-to-Speech)

**Primär**: ElevenLabs
- Natürliche Sprachausgabe, Deutsch-Support
- Konfigurierbare Stimme
- Prosody-Enhancement für natürlichere Sätze
- Kosten: ~$0.30 pro 1.000 Zeichen

**Fallback**: OpenAI TTS
- Günstiger, aber weniger natürlich

**Konfigurierbar**: Nutzer kann TTS-Engine und Stimme im Settings wählen

### LiveKit

LiveKit ist ein open-source WebRTC Server-Framework, das bidirektionale Audio/Video-Streams ermöglicht. Es wird self-hosted auf Hetzner betrieben.

**Warum LiveKit statt direktem WebRTC**:
- Abstrahiert WebRTC-Komplexität
- Handelt NAT-Traversal, STUN/TURN
- SDK für Web, iOS, Android (relevant für spätere native App)
- Oliver hat bereits LiveKit-Erfahrung aus Voice-Agent-Projekten

### Voice-Modi

**Modus 1: Push-to-Talk** (Standard Mobile)
- Mic-Button gedrückt halten zum Sprechen
- Loslassen → sofortige Transkription + Antwort

**Modus 2: Continuous Conversation** (Desktop/Headset)
- Aktivierungswort (konfigurierbar, z.B. "Hey PAI")
- VAD (Voice Activity Detection) erkennt Sprechpausen
- Natürlichere Konversation

**Modus 3: Voice-Notiz** (Mobile, Offline-fähig)
- Aufnahme auch ohne Server-Verbindung
- Keine Echtzeit-Antwort — reine Aufnahme
- Sync + Verarbeitung sobald online

---

## 13. Agent Teams

### Konzept (Phase 2-3)

Ab Phase 2 kann PAI-X Sub-Agent-Teams erstellen und managen. Das ermöglicht parallele, spezialisierte Arbeit — der Personal Assistant fungiert als Manager, die Teams als Ausführende.

### Team-Architektur

```
PAI-X Personal Assistant (Manager)
         │
         ├── Content Team
         │     ├── Research Agent (findet Themen)
         │     ├── Writer Agent (erstellt Content)
         │     ├── Editor Agent (überprüft Quality)
         │     └── Scheduler Agent (plant Posting)
         │
         ├── Client Team
         │     ├── CRM Agent (Kontakt-Updates)
         │     ├── Briefing Agent (Meeting-Vorbereitung)
         │     └── Follow-up Agent (Action Item Tracking)
         │
         ├── Research Team
         │     ├── Web Research Agent
         │     ├── Synthesis Agent
         │     └── Report Agent
         │
         └── Coding Team (via Claude Code MCP)
               └── Claude Code Agent
```

### Content Team — Detailspezifikation

**Aufgabe**: Täglich Content identifizieren, aufbereiten, planen und posten.

**Workflow**:
```
1. Research Agent (täglich 06:00):
   - Scannt RSS-Feeds (konfigurierbar)
   - Sucht nach relevanten Themen in Oliver's Nischen (AI, Automation, n8n)
   - Bewertet Relevanz (gegen TELOS.STRATEGIES.content)
   - Output: 5 potenzielle Themen für den Tag

2. Writer Agent (bei Approval):
   - Nimmt genehmigtes Thema
   - Recherchiert tiefgehend
   - Erstellt Full-Draft in Oliver's Stil (aus Memory)
   - Varianten: Blog + LinkedIn + Twitter

3. Editor Agent:
   - Prüft auf Qualität, Konsistenz, Ton
   - Gibt Feedback oder approved

4. Scheduler Agent:
   - Prüft Content-Kalender (NocoDB)
   - Plant in nächsten freien Slot
   - Postet via n8n Flow (LinkedIn API etc.)
   - Trackt Engagement zurück in Memory
```

**Human-in-the-Loop**: Der Nutzer kann konfigurieren wie viel Review er möchte:
- Full Auto: Content wird ohne Review gepostet
- Review Before Post: Nutzer muss approven
- Draft Only: Nur Entwürfe, Nutzer postet selbst

---

## 14. Learning System

### Konzept

PAI-X lernt kontinuierlich aus jeder Interaktion. Das Ziel: Jede Woche ist PAI-X ein kleines bisschen besser darin, Oliver zu verstehen und für ihn zu arbeiten.

Inspiriert von PAIs Scientific Method als Meta-Loop:
**Observe → Think → Plan → Execute → Verify → Learn → Repeat**

### Was gelernt wird

**1. Schreibstil**
- Alle Blogposts, LinkedIn-Posts, E-Mails die Oliver schreibt (oder bearbeitet) werden analysiert
- Vocabulary, Satzlänge, Struktur, Ton werden in Graphiti gespeichert
- Jeder neue Content-Output wird gegen dieses Profil geprüft

**2. Präferenzen**
- Oliver mag Bullet-Point-Briefings statt langen Texten? → wird erkannt, gespeichert, angewendet
- Oliver antwortet nie auf Slack-Vorschläge aber immer auf Telegram? → Kanal-Präferenz gelernt
- Oliver bearbeitet immer die Einleitung von Blogposts? → wird in Writer-Agent-Prompt verankert

**3. Routinen**
- Wenn Oliver dienstags immer Kunden-Follow-ups macht → wird automatisch als proaktiver Trigger hinzugefügt
- Wenn Oliver freitags immer das Wochenend-Review macht → Agent bereitet das automatisch vor

**4. Qualitätssignale**
- Explizit: 👍/👎 Buttons nach jeder Antwort
- Implizit: Hat Oliver den Output unverändert genutzt? Oder viel editiert? (= schlechtes Signal)
- Hat Oliver sofort nachgefragt "nochmal, aber anders"? = schlechtes Signal
- Hat Oliver direkt geantwortet und das Thema abgehakt? = gutes Signal

**5. Skill-Performance**
- Welche Skills liefern konsistent gute Ergebnisse?
- Welche Skills werden oft neu angefragt weil der erste Output nicht passte?
- Skill-Prompts werden basierend auf Performance angepasst (über n8n Automation + LLM)

### Learning Loop — Technische Implementierung

```python
# Nach jeder Interaktion
async def run_learning_loop(interaction_id: str):
    interaction = await get_interaction(interaction_id)
    
    # 1. Signal-Collection
    signals = LearningSignals(
        explicit_rating=interaction.user_rating,  # 👍/👎
        implicit_edit_distance=calculate_edit_distance(
            interaction.output,
            interaction.user_final_version
        ),
        follow_up_requests=count_follow_ups(interaction),
        time_to_action=interaction.time_until_user_acted
    )
    
    # 2. Signal in Graphiti speichern
    await graphiti.add_learning_signal(
        skill_id=interaction.skill_id,
        signals=signals,
        context=interaction.context
    )
    
    # 3. Aggregierte Learnings (wöchentlich via Cron)
    if is_weekly_learning_run():
        skill_learnings = await graphiti.aggregate_skill_performance(
            time_window="7d"
        )
        
        for skill_id, performance in skill_learnings.items():
            if performance.needs_improvement():
                # Skill-Prompt via LLM verbessern
                improved_prompt = await improve_skill_prompt(
                    skill_id=skill_id,
                    performance_data=performance,
                    example_failures=performance.worst_interactions
                )
                await update_skill_prompt(skill_id, improved_prompt)
    
    # 4. TELOS-Updates
    if new_preference := await detect_preference(interaction):
        await graphiti.update_telos("PREFERENCES", new_preference)
    
    if new_routine := await detect_routine(interaction):
        await add_proactive_trigger(new_routine)
```

---

## 15. Tech Stack & Infrastruktur

### Frontend

| Technologie | Version | Zweck |
|---|---|---|
| Next.js | 16 (latest) | React Framework, App Router, Server Components |
| React | 19 | UI Framework |
| TypeScript | 5.x | Type Safety |
| Tailwind CSS | 3.x | Styling (aus Template) |
| shadcn/ui | latest | Komponenten-System (aus Template) |
| next-pwa | latest | PWA-Support, Service Worker |
| Workbox | latest | Offline-Caching |
| Zustand | 4.x | State Management |
| React Query (TanStack) | 5.x | Server State, Caching |
| Socket.io Client | 4.x | Real-time Chat Streaming |

### Backend

| Technologie | Version | Zweck |
|---|---|---|
| Python | 3.12 | Backend Language |
| FastAPI | 0.110+ | REST API + WebSocket |
| LangGraph | 0.2+ | Multi-Agent Orchestration |
| LangChain | 0.2+ | LLM Abstraction, Tools |
| Graphiti | latest | Temporal Knowledge Graph |
| FalkorDB | latest | Graph Database Backend |
| Redis | 7.x | Caching, Session, Queue |
| Celery | 5.x | Async Task Queue (für Background Jobs) |
| SQLAlchemy | 2.x | ORM für Postgres |
| PostgreSQL | 16 | Relational DB (User-Data, Auth) |
| Alembic | latest | Database Migrations |

### AI / ML

| Technologie | Zweck |
|---|---|
| Anthropic Claude API | Primäres LLM (claude-sonnet-4-5 Standard, opus für komplexe Tasks) |
| faster-whisper | STT, self-hosted |
| ElevenLabs API | TTS |
| LiveKit | WebRTC Voice Streaming |

### Infrastructure

| Technologie | Zweck |
|---|---|
| Hetzner Cloud | Hosting (DSGVO, Deutschland) |
| Docker + Docker Compose | Containerisierung |
| Nginx | Reverse Proxy |
| n8n | Workflow Automation, self-hosted |
| NocoDB | No-Code Datenbank-UI |
| GitHub | Versionskontrolle |
| GitHub Actions | CI/CD |

### Hosting-Konfiguration (Hetzner)

```
Server 1: App Server (CX21 oder größer)
  - Next.js Frontend (Node.js)
  - FastAPI Backend
  - Redis
  - Nginx

Server 2: AI/Data Server (CX31 oder größer, mehr RAM für Graphiti)
  - FalkorDB (Graph DB)
  - PostgreSQL
  - faster-whisper
  - LiveKit

Server 3: Automation Server (CX11)
  - n8n
  - NocoDB
  - Celery Worker
```

**Warum nicht ein Server**: Separation of Concerns, independentes Scaling, kein Single Point of Failure.

**Kosten geschätzt**: ~€80-120/Monat für alle 3 Server.

---

## 16. UI Framework — shadcn/ui Template

### Grundsatz

> Ausschließlich Komponenten aus dem vorhandenen shadcn/ui Template unter `/media/oliver/Platte 2 (Netac)2/shadcn-ui-kit-dashboard/` werden genutzt. Keine externen Komponenten-Libraries. Neue Komponenten werden als Varianten oder Kombinationen der Template-Komponenten erstellt.

### Vorgehen

1. **Template clonen**: Das gesamte Template wird als Basis des Next.js 16 Projekts verwendet
2. **Layout übernehmen**: Das Dashboard-Layout (Sidebar, Header, Content-Area) wird 1:1 geclont und für PAI-X angepasst
3. **Komponenten erweitern**: Bestehende Komponenten werden extended (Props, Variants) statt ersetzt
4. **Theme anpassen**: Farbpalette, Typografie im Tailwind-Config angepasst — aber die Komponenten-Struktur bleibt
5. **Keine externen UI-Libraries**: Kein Radix direkt, kein MUI, kein Ant Design — nur was im Template ist

### Namenskonvention

Neue Komponenten die aus Template-Komponenten abgeleitet werden:
```
Template: /components/ui/card.tsx
PAI-X Variante: /components/pai/telos-card.tsx (importiert card.tsx)
```

---

## 17. Sicherheit & Datenschutz

### DSGVO-Compliance

- **Datenhoheit**: Alle Nutzerdaten liegen auf Hetzner-Servern in Deutschland (EU)
- **Kein US-Transfer**: Anthropic-API-Calls sind die einzige US-Verbindung — Prompts werden so designed, dass keine personenbezogenen Daten direkt an die API gehen (Anonymisierung wo möglich)
- **Datenlöschung**: Nutzer können alle ihre Daten vollständig löschen (DSGVO-Recht auf Vergessenwerden)
- **Datenverschlüsselung**: At-rest (Hetzner Volume Encryption), In-transit (TLS 1.3)
- **Audit-Log**: Alle Datenzugriffe werden geloggt

### §203 StGB Vorbereitung (Phase 4)

- Strikte Mandanten-/Patienten-Datentrennung auf DB-Ebene
- Row-Level-Security in PostgreSQL
- On-Premise Deployment Option (Kunde hostet selbst)
- Keine Daten verlassen den lokalen Server ohne explizite Freigabe
- Verschlüsselte Backups mit Kundenschlüssel

### Authentication

- NextAuth.js mit JWT
- MFA optional (Phase 2)
- OAuth-Integration (Google, GitHub) für schnelles Setup
- Session-Timeout konfigurierbar
- API-Keys für programmatischen Zugriff (Phase 3)

### Secrets Management

- Environment Variables über `.env` (nie im Repository)
- Hetzner Secret Manager für Production (Phase 2)
- Rotation-Policy für API-Keys

---

## 18. MVP Definition

### MVP-Scope (Phase 1 — 4 Wochen)

Das MVP muss folgendes können — nicht mehr, nicht weniger:

**Must Have**:
- [ ] Next.js 16 Web-App läuft, PWA installierbar
- [ ] Chat-Interface (Text only, kein Voice im MVP)
- [ ] FastAPI Backend antwortet auf /chat
- [ ] LangGraph Basic Setup (ein Agent, kein Multi-Agent)
- [ ] Graphiti läuft, TELOS-Schema definiert
- [ ] TELOS für Oliver manuell befüllt (Basis-Version)
- [ ] Graphiti-Kontext fließt in jeden Chat-Turn ein
- [ ] MCP: Google Calendar verbunden
- [ ] MCP: Gmail verbunden
- [ ] Skill: Calendar Briefing (täglich 07:30 via n8n Cron)
- [ ] Skill: Pre-Meeting Alert (60 Min vorher)
- [ ] Dashboard: Home View mit heutige Termine
- [ ] Dashboard: Chat View
- [ ] Push Notification via Telegram (als ersten Kanal)
- [ ] Deployment auf Hetzner

**Should Have** (wenn Zeit bleibt):
- [ ] Voice Input (Whisper, kein TTS noch)
- [ ] Skill: Termin verschieben (autonome E-Mail + Calendar Update)
- [ ] Dashboard: TELOS View (read-only)

**Won't Have** (Phase 2+):
- Voice Output (TTS)
- Content Pipeline
- Google Drive Integration
- Agent Teams
- Memory Browser
- Learning Loop

### MVP-Erfolgskriterien

Das MVP gilt als erfolgreich wenn Oliver es **täglich nutzt** — also:
- Täglich das Morgen-Briefing liest
- Mindestens 3x pro Woche über den Chat eine echte Frage stellt
- Das Pre-Meeting-Alert als nützlich empfindet (subjektive Bewertung)

---

## 19. Implementierungs-Roadmap

### Phase 1: Foundation (Wochen 1–4)

**Woche 1: Setup & Grundstruktur**
- [ ] Mono-Repo aufsetzen (`/web`, `/api`, `/agents`)
- [ ] Next.js 16 aus shadcn Template initialisieren
- [ ] FastAPI Skeleton + erste Health-Check Route
- [ ] Docker Compose für lokale Entwicklung
- [ ] Hetzner Server provisioning
- [ ] TELOS-Schema in Graphiti definieren + Dokumentation

**Woche 2: Chat & Memory**
- [ ] Chat-Interface UI (shadcn Template Komponenten)
- [ ] WebSocket-Verbindung Frontend ↔ Backend
- [ ] LangGraph Basic Agent mit Anthropic Claude
- [ ] Graphiti-Integration: Context-Retrieval im Chat
- [ ] TELOS für Oliver befüllen (Basis-Version)
- [ ] Chat-History in Graphiti schreiben

**Woche 3: Kalender & Proaktivität**
- [ ] MCP Google Calendar anbinden
- [ ] MCP Gmail anbinden
- [ ] Skill: Calendar Briefing implementieren
- [ ] n8n Cron-Job für 07:30 Briefing
- [ ] Skill: Pre-Meeting Alert
- [ ] Telegram-Integration für Notifications
- [ ] Dashboard Home View mit Terminen

**Woche 4: Deployment & Testing**
- [ ] Production Deployment Hetzner
- [ ] Nginx Config + SSL
- [ ] PWA Manifest + Service Worker
- [ ] 1 Woche Daily Use Testing durch Oliver
- [ ] Bug Fixes + Performance Optimierung
- [ ] MVP Retrospektive

### Phase 2: Content & Voice (Wochen 5–8)

**Woche 5–6: Voice System**
- [ ] LiveKit Server Setup (Hetzner)
- [ ] faster-whisper Installation + API
- [ ] Voice Input im Chat (Push-to-Talk)
- [ ] Offline Voice-Capture (IndexedDB + Sync)
- [ ] ElevenLabs TTS Integration
- [ ] Voice Output im Chat

**Woche 7–8: Content Pipeline**
- [ ] Skill: Content Pipeline (URL → Transkript → Blogpost)
- [ ] MCP Google Drive Integration
- [ ] Content Pipeline Dashboard View
- [ ] n8n LinkedIn-Posting Flow
- [ ] NocoDB Content-Kalender Integration

### Phase 3: Teams & Intelligence (Wochen 9–14)

**Woche 9–10: Dashboard Completion**
- [ ] TELOS Editor (vollständig editierbar)
- [ ] Memory Browser (Graph-Visualisierung)
- [ ] Skills Manager
- [ ] Settings (alle Kategorien)

**Woche 11–12: Agent Teams**
- [ ] Multi-Agent Framework (LangGraph)
- [ ] Content Team (Research + Writer + Editor + Scheduler)
- [ ] Agent Teams Dashboard View

**Woche 13–14: Learning & Intelligence**
- [ ] Learning Loop implementieren
- [ ] Skill-Performance-Tracking
- [ ] Hook System (Lifecycle Events)
- [ ] Claude Code als Coding-Agent (MCP Remote)

### Phase 4: Agent One Ableitung (ab Woche 15)

- Multi-Tenant Architektur
- §203 Compliance Layer
- On-Premise Deployment Package
- Steuerberater-spezifische Skills
- Benjamin Arras Pilot-Onboarding
- Pricing & Billing System
- Marketing Landing Page

---

## 20. Metriken & Erfolgskriterien

### North Star Metric

> **Daily Active Usage**: Oliver nutzt PAI-X täglich für mindestens eine echte Aufgabe (nicht nur testen).

### Phase 1 Metriken

| Metrik | Ziel |
|---|---|
| Tages-Briefing gelesen | >90% der Werktage |
| Chat-Sessions pro Woche | >5 |
| Pre-Meeting-Alerts als nützlich bewertet | >80% |
| System Uptime | >99% |
| Chat-Antwortzeit (P90) | <3 Sekunden |

### Phase 2 Metriken

| Metrik | Ziel |
|---|---|
| Content durch PAI-X erstellt | >50% aller Posts |
| Voice-Notizen pro Woche | >10 |
| Ideen nicht manuell verloren | 0 (alle landen im System) |
| Manuelle Kalender-Aktionen | <5 pro Woche (Rest: PAI-X) |

### Phase 4 Metriken (Agent One)

| Metrik | Ziel nach 6 Monaten |
|---|---|
| Zahlende Kunden | >21 (Break-Even) |
| MRR | >€6.000 |
| Churn Rate | <5% monatlich |
| NPS | >50 |
| Benjamin Arras aktiver Nutzer | Ja |

---

## 21. Risiken & Mitigationen

### Technische Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Graphiti-Latenz zu hoch für Real-time Chat | Mittel | Hoch | Async Context Loading, Caching in Redis |
| LangGraph Multi-Agent-Komplexität | Hoch | Mittel | Erst single-agent MVP, dann schrittweise |
| MCP-Server-Ausfälle (Gmail, Calendar) | Mittel | Mittel | Graceful Degradation, Fallback-Messages |
| faster-whisper Latenz > 1s | Mittel | Mittel | Streaming-Transkription, Parallel Processing |
| Hetzner-Ausfall | Niedrig | Hoch | Automated Backups, Wiederanlaufplan |

### Produkt-Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| PAI-X wird nicht täglich genutzt | Mittel | Hoch | Früh auf echte Use Cases fokussieren, kein Feature-Overload |
| Proaktive Notifications werden als störend empfunden | Hoch | Mittel | Granulare Konfiguration von Anfang an, easy opt-out |
| Content-Pipeline-Output nicht in Oliver's Stil | Mittel | Mittel | Memory-basiertes Stil-Learning, viel Testing |
| Over-Engineering vs. Nutzbarkeit | Hoch | Hoch | MVP-Disziplin, 4-Wochen-Ziel einhalten |

### Business-Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Anthropic ändert API-Pricing drastisch | Niedrig | Hoch | Model-Abstraktion (LangChain), alternativer Provider |
| §203-Compliance-Problem in Phase 4 | Mittel | Hoch | Rechtsberatung früh einbeziehen, On-Premise Option |
| Konkurrenz (großes Tech-Unternehmen) | Mittel | Mittel | Nischen-Fokus (§203), DSGVO, lokale Präsenz |

---

## 22. Abgrenzung zu bestehenden Systemen

### PAI-X vs. PAI (Miessler)

| Aspekt | PAI (Miessler) | PAI-X |
|---|---|---|
| Plattform | Claude Code (Terminal) | Web + PWA |
| Zielgruppe | Entwickler | Alle (Fokus: Nicht-Entwickler) |
| Memory | Markdown flat files | Graphiti Temporal Knowledge Graph |
| Proaktivität | Hooks (Code-basiert) | n8n Cron + Push Notifications |
| Voice | Nicht vorhanden | LiveKit + Whisper + ElevenLabs |
| Dashboard | Nicht vorhanden | Vollständiges Web-Dashboard |
| Mobile | Nicht möglich | PWA (primärer Use Case) |
| §203-Extension | Nicht vorhanden | Phase 4 (Agent One) |

PAI-X schuldet PAI konzeptionell viel — TELOS, Skills, Learning Loop, Hook-System sind direkte Adaptionen. Die Implementation ist komplett neu und für Web/PWA optimiert.

### PAI-X vs. Agent One

Agent One (das bestehende Projekt) und PAI-X sind verwandt aber unterschiedlich:

- **PAI-X**: Persönlicher Assistent für Oliver (und später individuelle Nutzer)
- **Agent One**: Professioneller Assistent für §203-Berufsträger (B2B SaaS)

PAI-X wird die **technische Grundlage** für Agent One. In Phase 4 wird Agent One auf dem PAI-X-Code-Stack aufgebaut, mit:
- Multi-Tenant-Architektur
- Branchenspezifischen Skills (Steuerberater, Anwalt, Arzt)
- §203-Compliance-Layer
- On-Premise Deployment Option

### PAI-X vs. SYNKEA

- **SYNKEA**: Multi-Tenant AI Operations Platform ("Connect to everything") — eher B2B, eher Infrastruktur
- **PAI-X**: Personal AI Assistant — eher B2C / B2SMB, eher Anwendung

Keine direkte Überschneidung. SYNKEA könnte PAI-X als einen seiner Dienste hosten.

---

## 23. Zukunftsvision — Agent One Ableitung

### Die große Vision

PAI-X startet als Olivers persönlicher Assistent. Aber die eigentliche Vision ist größer:

> *"Jeder Berufsträger in Deutschland — jeder Steuerberater, jeder Arzt, jeder Anwalt — hat einen eigenen KI-Chief-of-Staff der ihn kennt, der für ihn denkt und der DSGVO-konform auf deutschen Servern läuft."*

### Der Weg von PAI-X zu Agent One

```
Woche 1-14: PAI-X für Oliver
       │
       ▼
Woche 15+: Agent One Architektur-Layer hinzufügen
       │
       ├── Multi-Tenancy: Ein System, viele Nutzer, strikte Datentrennung
       ├── §203 Compliance: Kein Daten-Mix, On-Premise Option
       ├── Branchen-Skills: Steuerberater (Fristen, DATEV-Kompatibilität)
       ├── Pricing: Starter €149 / Professional €299 / Enterprise €499
       └── Pilot: Benjamin Arras als erster externer Nutzer
```

### Agent One Pricing (aus PRD)

| Tier | Preis | Zielgruppe |
|---|---|---|
| Starter | €149/Monat | Einzelkämpfer, 1 Nutzer |
| Professional | €299/Monat | Kleinkanzlei, bis 5 Nutzer |
| Enterprise | €499/Monat | Mittlere Kanzlei, bis 20 Nutzer |
| Level 5 Add-on | +€200/Monat | Self-Evolution, Guardian Angel |
| On-Premise | €999+/einmalig | Maximale Datensicherheit |

**Break-Even**: 21 Starter-Kunden oder ~10 Professional-Kunden

### Der entscheidende Vorteil

Agent One wird das einzige System sein das:
1. Wirklich DSGVO-konform ist (self-hosted in Deutschland)
2. §203 StGB vollständig abdeckt (kein Datenmix zwischen Mandanten)
3. Ein vernünftiges Dashboard hat (kein Terminal, kein CLI)
4. Den Berufträger wirklich kennt (TELOS + Graphiti)
5. Proaktiv ist (nicht nur reagiert)

Das ist keine weitere KI-App. Das ist die KI-Transformation der deutschen Kanzleien.

---

*PAI-X PRD v1.0 — HR Code Labs GbR — Oliver Hees — Februar 2026*  
*Dieses Dokument ist vertraulich und ausschließlich für den internen Gebrauch bestimmt.*