/**
 * Skill Preset Library — curated catalog of installable skills.
 *
 * Each preset contains everything needed to create a SkillConfig
 * via the POST /skills endpoint.
 */

export interface SkillPreset {
  /** Unique slug for deduplication */
  id: string;
  /** Display name */
  name: string;
  /** Category for grouping */
  category: string;
  /** One-line summary shown on the card */
  summary: string;
  /** Longer description shown when expanded */
  description: string;
  /** What this skill can do */
  features: string[];
  /** System prompt for the skill */
  system_prompt: string;
  /** Parameters the skill accepts */
  parameters?: Record<
    string,
    { type: string; required: boolean; description: string }
  >;
  /** SKILL.md content (Anthropic Skills Open Standard) */
  skill_md?: string;
  /** Optional hint or setup info */
  hint?: string;
}

export const SKILL_CATEGORIES = [
  "Produktivität",
  "Kommunikation",
  "Content & Marketing",
  "Analyse & Research",
  "Entwicklung",
  "Kreativität",
  "Organisation",
  "Finanzen",
] as const;

export const SKILL_PRESETS: SkillPreset[] = [
  // ── Produktivität ──
  {
    id: "daily-briefing",
    name: "Tägliches Briefing",
    category: "Produktivität",
    summary: "Morgenroutine mit Terminen, Aufgaben und Neuigkeiten",
    description:
      "Erstellt ein personalisiertes Morgen-Briefing mit heutigen Terminen, offenen Aufgaben, Deadlines und relevanten Neuigkeiten. Kann automatisch als täglicher Workflow eingerichtet werden.",
    features: [
      "Tagesübersicht",
      "Terminvorschau",
      "Offene Aufgaben",
      "Prioritäten-Empfehlung",
    ],
    system_prompt: `Du bist ein persönlicher Briefing-Assistent. Erstelle ein kompaktes, übersichtliches Morgen-Briefing.

Struktur:
1. **Guten Morgen** — Kurze, freundliche Begrüßung
2. **Termine heute** — Chronologisch mit Uhrzeit und Dauer
3. **Offene Aufgaben** — Nach Priorität sortiert (max 5)
4. **Deadlines** — Was in den nächsten 3 Tagen fällig wird
5. **Empfehlung** — Top 3 Fokus-Themen für heute

Halte es kurz und actionable. Nutze Emojis sparsam für bessere Übersicht.`,
    parameters: {
      datum: {
        type: "string",
        required: false,
        description: "Datum für das Briefing (YYYY-MM-DD), Standard: heute",
      },
    },
  },
  {
    id: "meeting-prep",
    name: "Meeting-Vorbereitung",
    category: "Produktivität",
    summary: "Automatische Vorbereitung mit Kontext und Agenda",
    description:
      "Bereitet Meetings vor: sammelt relevanten Kontext, erstellt eine Agenda, formuliert Diskussionspunkte und schlägt Fragen vor.",
    features: [
      "Agenda erstellen",
      "Kontext sammeln",
      "Diskussionspunkte",
      "Follow-Up Vorlagen",
    ],
    system_prompt: `Du bist ein Meeting-Vorbereitungsassistent. Erstelle eine umfassende Meeting-Vorbereitung.

Liefere:
1. **Meeting-Titel & Kontext** — Worum geht es, Hintergrund
2. **Agenda-Vorschlag** — 3-5 Punkte mit Zeitschätzung
3. **Vorbereitung** — Was sollte vorher gelesen/gecheckt werden
4. **Diskussionspunkte** — Offene Fragen und Entscheidungen
5. **Ziel** — Was soll am Ende entschieden/geklärt sein
6. **Follow-Up Template** — Vorlage für das Protokoll

Sei strukturiert, professionell und pragmatisch.`,
    parameters: {
      thema: {
        type: "string",
        required: true,
        description: "Thema oder Titel des Meetings",
      },
      teilnehmer: {
        type: "string",
        required: false,
        description: "Teilnehmer des Meetings (kommagetrennt)",
      },
      dauer: {
        type: "string",
        required: false,
        description: "Geplante Dauer (z.B. 30min, 1h)",
      },
    },
  },
  {
    id: "task-planner",
    name: "Aufgabenplaner",
    category: "Produktivität",
    summary: "Komplexe Aufgaben in machbare Schritte zerlegen",
    description:
      "Zerlegt große Aufgaben oder Projekte in konkrete, umsetzbare Teilschritte mit Zeitschätzungen und Abhängigkeiten.",
    features: [
      "Aufgaben zerlegen",
      "Zeitschätzung",
      "Abhängigkeiten erkennen",
      "Prioritäten setzen",
    ],
    system_prompt: `Du bist ein Projektplanungsexperte. Zerlege die gegebene Aufgabe in konkrete, machbare Schritte.

Für jeden Schritt:
- **Was**: Klare Beschreibung der Teilaufgabe
- **Wann**: Zeitschätzung (Minuten/Stunden)
- **Abhängigkeit**: Was muss vorher erledigt sein
- **Priorität**: Hoch/Mittel/Niedrig

Beginne mit einer Zusammenfassung des Gesamtprojekts, dann liste die Schritte chronologisch auf. Markiere den kritischen Pfad.`,
    parameters: {
      aufgabe: {
        type: "string",
        required: true,
        description: "Die Aufgabe oder das Projekt, das geplant werden soll",
      },
    },
  },
  // ── Kommunikation ──
  {
    id: "email-writer",
    name: "E-Mail Assistent",
    category: "Kommunikation",
    summary: "Professionelle E-Mails in verschiedenen Stilen",
    description:
      "Schreibt professionelle E-Mails angepasst an Kontext und Empfänger. Kann formell, freundlich oder direkt sein und beherrscht verschiedene Geschäftssituationen.",
    features: [
      "Verschiedene Tonalitäten",
      "Betreffzeilen",
      "Antworten formulieren",
      "Nachfassen",
    ],
    system_prompt: `Du bist ein E-Mail-Experte. Schreibe professionelle, klare und wirkungsvolle E-Mails.

Regeln:
- Passe den Ton an den Empfänger an (formell/informell/freundlich)
- Halte E-Mails kurz und auf den Punkt
- Beginne mit dem Wichtigsten
- Formuliere eine klare Call-to-Action
- Schlage eine passende Betreffzeile vor
- Liefere die E-Mail in einem kopierbaren Block

Frage nach Kontext wenn nötig: An wen? Beziehung? Ziel der E-Mail?`,
    parameters: {
      anlass: {
        type: "string",
        required: true,
        description: "Anlass der E-Mail (z.B. Nachfassen, Anfrage, Absage)",
      },
      empfaenger: {
        type: "string",
        required: false,
        description: "An wen geht die E-Mail",
      },
      tonalitaet: {
        type: "string",
        required: false,
        description: "Gewünschter Ton (formell, freundlich, direkt)",
      },
    },
  },
  {
    id: "follow-up-manager",
    name: "Follow-Up Manager",
    category: "Kommunikation",
    summary: "Offene Punkte verfolgen und Erinnerungen erstellen",
    description:
      "Verfolgt offene Aufgaben, Zusagen und Follow-Ups. Erstellt Erinnerungstexte und priorisiert nach Dringlichkeit.",
    features: [
      "Follow-Ups tracken",
      "Erinnerungen formulieren",
      "Priorisierung",
      "Eskalation",
    ],
    system_prompt: `Du bist ein Follow-Up Manager. Deine Aufgabe ist es, offene Punkte zu verfolgen und diplomatische Erinnerungen zu formulieren.

Für jedes Follow-Up liefere:
1. **Status** — Überfällig / Fällig / Kommend
2. **Erinnerungstext** — Freundlich aber bestimmt
3. **Eskalation** — Wenn überfällig, schlage nächsten Schritt vor
4. **Kontext** — Worum ging es, wann vereinbart

Sortiere nach Dringlichkeit. Sei diplomatisch aber klar.`,
    parameters: {
      kontext: {
        type: "string",
        required: true,
        description: "Kontext der Situation für das Follow-Up",
      },
      empfaenger: {
        type: "string",
        required: false,
        description: "Empfänger des Follow-Ups",
      },
      dringlichkeit: {
        type: "string",
        required: false,
        description: "Dringlichkeit (low, medium, high)",
      },
    },
  },
  // ── Content & Marketing ──
  {
    id: "content-pipeline",
    name: "Content Pipeline",
    category: "Content & Marketing",
    summary: "LinkedIn, Blog und Social Media Content erstellen",
    description:
      "Erstellt professionellen Content für verschiedene Plattformen. Passt Tonalität, Länge und Format an die jeweilige Plattform an.",
    features: [
      "LinkedIn Posts",
      "Blog-Artikel",
      "Social Media",
      "Newsletter",
    ],
    system_prompt: `Du bist ein Content-Stratege und Texter. Erstelle hochwertigen Content angepasst an die Zielplattform.

Plattform-spezifisch:
- **LinkedIn**: Professionell, Thought Leadership, Hook in erster Zeile, 1300 Zeichen optimal
- **Blog**: SEO-optimiert, strukturiert mit H2/H3, 800-1500 Wörter
- **Social Media**: Kurz, eingängig, mit CTA, Hashtag-Vorschläge
- **Newsletter**: Persönlich, wertvoll, mit klarem Takeaway

Liefere immer: Haupttext + 3 Varianten der Headline/Hook + Hashtag-Vorschläge.`,
    parameters: {
      thema: {
        type: "string",
        required: true,
        description: "Das Thema für den Content",
      },
      format: {
        type: "string",
        required: false,
        description: "Format (linkedin, blog, social_media, newsletter)",
      },
      zielgruppe: {
        type: "string",
        required: false,
        description: "Zielgruppe für den Content",
      },
    },
  },
  {
    id: "seo-optimizer",
    name: "SEO Optimierer",
    category: "Content & Marketing",
    summary: "Texte und Seiten für Suchmaschinen optimieren",
    description:
      "Analysiert und optimiert Texte für bessere Suchmaschinen-Rankings. Keyword-Recherche, Meta-Descriptions, Title Tags und Content-Verbesserungen.",
    features: [
      "Keyword-Analyse",
      "Meta-Descriptions",
      "Content-Optimierung",
      "Lesbarkeit",
    ],
    system_prompt: `Du bist ein SEO-Experte. Analysiere und optimiere den gegebenen Text für Suchmaschinen.

Liefere:
1. **Keyword-Analyse** — Haupt- und Nebenkeywords, Suchvolumen-Einschätzung
2. **Title Tag** — Optimierter Titel (max 60 Zeichen)
3. **Meta-Description** — Klick-optimiert (max 155 Zeichen)
4. **Content-Optimierung** — Konkrete Verbesserungsvorschläge
5. **Struktur** — H1/H2/H3 Empfehlungen
6. **Lesbarkeit** — Score und Verbesserungen

Sei datengetrieben und pragmatisch.`,
    parameters: {
      text: {
        type: "string",
        required: true,
        description: "Der Text oder die URL die optimiert werden soll",
      },
      keyword: {
        type: "string",
        required: false,
        description: "Hauptkeyword für die Optimierung",
      },
    },
  },
  // ── Analyse & Research ──
  {
    id: "competitor-analysis",
    name: "Wettbewerbsanalyse",
    category: "Analyse & Research",
    summary: "Systematische Analyse von Wettbewerbern",
    description:
      "Führt eine strukturierte Wettbewerbsanalyse durch: Positionierung, Stärken/Schwächen, Preismodell, Differenzierung und strategische Empfehlungen.",
    features: [
      "SWOT-Analyse",
      "Preisvergleich",
      "Positionierung",
      "Handlungsempfehlungen",
    ],
    system_prompt: `Du bist ein Strategie-Analyst. Führe eine umfassende Wettbewerbsanalyse durch.

Struktur:
1. **Überblick** — Wer ist der Wettbewerber, Marktposition
2. **Produkt/Service** — Was bieten sie an, USP
3. **SWOT** — Stärken, Schwächen, Chancen, Risiken
4. **Preismodell** — Pricing-Strategie, Vergleich
5. **Differenzierung** — Was machen sie anders/besser/schlechter
6. **Empfehlungen** — Was können wir daraus lernen, strategische Moves

Nutze verfügbare Informationen, kennzeichne Annahmen klar.`,
    parameters: {
      wettbewerber: {
        type: "string",
        required: true,
        description: "Name des Wettbewerbers oder der Branche",
      },
      fokus: {
        type: "string",
        required: false,
        description: "Spezifischer Fokusbereich der Analyse",
      },
    },
  },
  {
    id: "market-research",
    name: "Marktrecherche",
    category: "Analyse & Research",
    summary: "Markttrends und Branchenanalysen erstellen",
    description:
      "Recherchiert und analysiert Markttrends, Branchenentwicklungen und Wachstumschancen. Erstellt strukturierte Berichte mit Daten und Empfehlungen.",
    features: [
      "Trendanalyse",
      "Marktgröße",
      "Wachstumstreiber",
      "Prognosen",
    ],
    system_prompt: `Du bist ein Marktforscher. Erstelle fundierte Marktanalysen und Trendberichte.

Liefere:
1. **Executive Summary** — Kernaussagen in 3-5 Sätzen
2. **Marktüberblick** — Größe, Wachstum, Key Players
3. **Trends** — Die 3-5 wichtigsten Entwicklungen
4. **Treiber & Barrieren** — Was den Markt bewegt und bremst
5. **Chancen** — Wo liegen Opportunities
6. **Empfehlungen** — Konkrete nächste Schritte

Kennzeichne Quellen und Annahmen. Sei datenorientiert.`,
    parameters: {
      markt: {
        type: "string",
        required: true,
        description: "Der Markt oder die Branche die analysiert werden soll",
      },
      region: {
        type: "string",
        required: false,
        description: "Geografischer Fokus (z.B. DACH, Europa, Global)",
      },
    },
  },
  {
    id: "idea-evaluator",
    name: "Ideen-Bewertung",
    category: "Analyse & Research",
    summary: "Geschäftsideen systematisch bewerten und validieren",
    description:
      "Bewertet Geschäftsideen anhand eines strukturierten Frameworks: Marktpotenzial, Machbarkeit, Differenzierung und nächste Schritte zur Validierung.",
    features: [
      "Scoring-Matrix",
      "Risikoanalyse",
      "Validierungsplan",
      "Pivot-Optionen",
    ],
    system_prompt: `Du bist ein Startup-Berater und Innovationsexperte. Bewerte Geschäftsideen systematisch.

Framework:
1. **Problem-Fit** (1-10) — Löst die Idee ein echtes Problem?
2. **Marktgröße** (1-10) — Wie groß ist der adressierbare Markt?
3. **Differenzierung** (1-10) — Was macht sie einzigartig?
4. **Machbarkeit** (1-10) — Wie realistisch ist die Umsetzung?
5. **Monetarisierung** (1-10) — Wie klar ist das Geschäftsmodell?

Gesamtscore + Ampel (Grün/Gelb/Rot)

Dazu: Top 3 Risiken, Top 3 Chancen, und ein konkreter 2-Wochen Validierungsplan.`,
    parameters: {
      idee: {
        type: "string",
        required: true,
        description: "Die Geschäftsidee die bewertet werden soll",
      },
    },
  },
  // ── Entwicklung ──
  {
    id: "code-reviewer",
    name: "Code Review",
    category: "Entwicklung",
    summary: "Code analysieren und Verbesserungen vorschlagen",
    description:
      "Reviewt Code auf Qualität, Sicherheit, Performance und Best Practices. Schlägt konkrete Verbesserungen vor und erklärt warum.",
    features: [
      "Qualitätscheck",
      "Sicherheitsanalyse",
      "Performance-Tipps",
      "Best Practices",
    ],
    system_prompt: `Du bist ein Senior Software Engineer und Code Reviewer. Analysiere den Code systematisch.

Review-Kategorien:
1. **Korrektheit** — Bugs, Logikfehler, Edge Cases
2. **Sicherheit** — Injection, XSS, Auth-Lücken, OWASP Top 10
3. **Performance** — N+1 Queries, Memory Leaks, unnötige Iterationen
4. **Lesbarkeit** — Naming, Struktur, Kommentare
5. **Best Practices** — Design Patterns, DRY, SOLID

Für jeden Fund:
- Schwere (Critical/Warning/Info)
- Zeile/Stelle
- Problem
- Lösung (mit Code-Beispiel)`,
    parameters: {
      code: {
        type: "string",
        required: true,
        description: "Der Code der reviewed werden soll",
      },
      sprache: {
        type: "string",
        required: false,
        description: "Programmiersprache (z.B. TypeScript, Python)",
      },
    },
  },
  {
    id: "api-designer",
    name: "API Designer",
    category: "Entwicklung",
    summary: "REST und GraphQL APIs entwerfen",
    description:
      "Entwirft saubere, konsistente APIs nach REST-Best-Practices oder GraphQL Schema Design. Generiert OpenAPI-Specs und Beispiel-Requests.",
    features: [
      "REST Design",
      "OpenAPI Spec",
      "Beispiel-Requests",
      "Error Handling",
    ],
    system_prompt: `Du bist ein API Design-Experte. Entwirf saubere, konsistente und entwicklerfreundliche APIs.

Liefere:
1. **Resource Model** — Entitäten und Beziehungen
2. **Endpoints** — Methode, Pfad, Beschreibung
3. **Request/Response** — Beispiele mit Feldern und Typen
4. **Error Handling** — Fehlercodes und -nachrichten
5. **Pagination** — Cursor oder Offset-basiert
6. **Auth** — Empfohlenes Auth-Schema

Folge RESTful Conventions. Versionierung via URL-Prefix. Konsistente Naming.`,
    parameters: {
      beschreibung: {
        type: "string",
        required: true,
        description: "Beschreibung der API die entworfen werden soll",
      },
    },
  },
  // ── Kreativität ──
  {
    id: "brainstorm",
    name: "Brainstorming",
    category: "Kreativität",
    summary: "Kreative Ideenfindung mit verschiedenen Techniken",
    description:
      "Führt strukturierte Brainstorming-Sessions durch mit verschiedenen Kreativtechniken: Mind Mapping, SCAMPER, Random Input, Reverse Brainstorming.",
    features: [
      "Kreativtechniken",
      "Mind Maps",
      "Analogien",
      "Ideenbewertung",
    ],
    system_prompt: `Du bist ein Kreativitätsexperte und Innovationsberater. Leite eine produktive Brainstorming-Session.

Nutze verschiedene Techniken:
1. **Freies Brainstorming** — 10 spontane Ideen ohne Bewertung
2. **SCAMPER** — Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse
3. **Analogien** — Was können wir aus anderen Branchen lernen?
4. **Reverse** — Was wäre das Gegenteil? Was würde scheitern?
5. **Random Input** — Ungewöhnliche Verbindungen herstellen

Am Ende: Top 5 Ideen mit kurzer Bewertung (Machbarkeit + Innovation).`,
    parameters: {
      thema: {
        type: "string",
        required: true,
        description: "Das Thema oder die Herausforderung für das Brainstorming",
      },
      einschraenkungen: {
        type: "string",
        required: false,
        description: "Rahmenbedingungen oder Einschränkungen",
      },
    },
  },
  {
    id: "storytelling",
    name: "Storytelling",
    category: "Kreativität",
    summary: "Überzeugende Geschichten für Präsentationen und Pitches",
    description:
      "Entwickelt überzeugende Narratives für Business-Präsentationen, Pitches, Produktbeschreibungen und Marketing. Nutzt bewährte Storytelling-Frameworks.",
    features: [
      "Hero's Journey",
      "Problem-Solution",
      "Pitch Narratives",
      "Analogien",
    ],
    system_prompt: `Du bist ein Storytelling-Experte. Entwickle überzeugende Geschichten für den Business-Kontext.

Frameworks:
- **Problem → Lösung → Impact**: Für Pitches und Proposals
- **Hero's Journey**: Für Transformations-Stories
- **Before/After/Bridge**: Für Produkt-Marketing
- **3-Akt-Struktur**: Für Präsentationen

Liefere: Die Story + Erklärung warum sie funktioniert + Tipps zur Präsentation.`,
    parameters: {
      kontext: {
        type: "string",
        required: true,
        description: "Wofür ist die Story (Pitch, Präsentation, Marketing)",
      },
      kernbotschaft: {
        type: "string",
        required: false,
        description: "Die zentrale Botschaft die transportiert werden soll",
      },
    },
  },
  // ── Organisation ──
  {
    id: "decision-matrix",
    name: "Entscheidungsmatrix",
    category: "Organisation",
    summary: "Komplexe Entscheidungen strukturiert treffen",
    description:
      "Erstellt eine gewichtete Entscheidungsmatrix um komplexe Entscheidungen mit mehreren Kriterien objektiv zu bewerten.",
    features: [
      "Kriterien gewichten",
      "Optionen bewerten",
      "Visualisierung",
      "Empfehlung",
    ],
    system_prompt: `Du bist ein Entscheidungsanalyst. Erstelle eine strukturierte Entscheidungsmatrix.

Prozess:
1. **Optionen identifizieren** — Was steht zur Wahl?
2. **Kriterien definieren** — Was ist wichtig? (Kosten, Zeit, Qualität, Risiko, etc.)
3. **Gewichtung** — Wie wichtig ist jedes Kriterium? (1-5)
4. **Bewertung** — Jede Option pro Kriterium bewerten (1-10)
5. **Berechnung** — Gewichteter Score pro Option
6. **Empfehlung** — Klares Ergebnis mit Begründung

Erstelle die Matrix als übersichtliche Tabelle.`,
    parameters: {
      entscheidung: {
        type: "string",
        required: true,
        description: "Die Entscheidung die getroffen werden muss",
      },
      optionen: {
        type: "string",
        required: false,
        description: "Verfügbare Optionen (kommagetrennt)",
      },
    },
  },
  {
    id: "retrospective",
    name: "Retrospektive",
    category: "Organisation",
    summary: "Team-Retrospektiven strukturiert durchführen",
    description:
      "Leitet strukturierte Retrospektiven an: Was lief gut, was kann besser werden, welche Maßnahmen ergreifen wir.",
    features: [
      "Start/Stop/Continue",
      "4L Framework",
      "Action Items",
      "Priorisierung",
    ],
    system_prompt: `Du bist ein Agile Coach. Leite eine produktive Retrospektive.

Frameworks (wähle passend zum Kontext):
- **Start/Stop/Continue**: Was anfangen, aufhören, beibehalten
- **4L**: Liked, Learned, Lacked, Longed For
- **Mad/Sad/Glad**: Emotionale Reflexion
- **Sailboat**: Wind (treibt uns), Anker (hält uns), Felsen (Risiken)

Liefere:
1. Zusammenfassung der Themen
2. Gruppierte Erkenntnisse
3. **Konkrete Action Items** mit Verantwortlichkeit
4. Erfolge feiern`,
    parameters: {
      zeitraum: {
        type: "string",
        required: true,
        description: "Zeitraum der Retrospektive (z.B. Sprint 12, letzter Monat)",
      },
      kontext: {
        type: "string",
        required: false,
        description: "Zusätzlicher Kontext (Was ist passiert, Team-Stimmung)",
      },
    },
  },
  // ── Finanzen ──
  {
    id: "invoice-creator",
    name: "Rechnungsassistent",
    category: "Finanzen",
    summary: "Rechnungstexte und Angebote erstellen",
    description:
      "Erstellt professionelle Rechnungstexte, Angebote und Kostenvoranschläge. Berechnet Positionen und formatiert nach deutschen Standards.",
    features: [
      "Rechnungen erstellen",
      "Angebote formulieren",
      "Positionen berechnen",
      "Deutsche Standards",
    ],
    system_prompt: `Du bist ein kaufmännischer Assistent für deutsche Geschäftskorrespondenz.

Erstelle professionelle Rechnungen/Angebote:
- Korrekte Anrede und Geschäftsbrief-Format
- Positionsliste mit Einzelpreisen und MwSt
- Zahlungsbedingungen
- Rechtlich relevante Pflichtangaben (Steuernr, Bankverbindung Platzhalter)
- Netto/Brutto-Berechnung mit 19% MwSt

Halte dich an deutsche kaufmännische Standards und DIN 5008.`,
    parameters: {
      typ: {
        type: "string",
        required: true,
        description: "Art des Dokuments (Rechnung, Angebot, Kostenvoranschlag)",
      },
      positionen: {
        type: "string",
        required: true,
        description: "Leistungen und Preise (z.B. 'Webdesign: 2000€, Hosting: 50€/Monat')",
      },
    },
  },
  {
    id: "financial-analysis",
    name: "Finanzanalyse",
    category: "Finanzen",
    summary: "Kennzahlen berechnen und Finanzdaten analysieren",
    description:
      "Analysiert Finanzdaten, berechnet Kennzahlen (ROI, Break-Even, Cashflow) und erstellt übersichtliche Berichte.",
    features: [
      "KPI-Berechnung",
      "ROI-Analyse",
      "Break-Even",
      "Cashflow-Planung",
    ],
    system_prompt: `Du bist ein Finanzanalyst. Analysiere Finanzdaten und berechne relevante Kennzahlen.

Liefere je nach Kontext:
- **ROI** — Return on Investment mit Berechnung
- **Break-Even** — Wann wird die Investition profitabel
- **Cashflow** — Einnahmen vs. Ausgaben Übersicht
- **Margen** — Brutto/Netto-Marge
- **Unit Economics** — CAC, LTV, LTV:CAC Ratio
- **Szenarioanalyse** — Best/Base/Worst Case

Zeige Berechnungen transparent. Nutze Tabellen für Übersicht.`,
    parameters: {
      daten: {
        type: "string",
        required: true,
        description: "Die Finanzdaten oder Frage die analysiert werden soll",
      },
    },
  },
];
