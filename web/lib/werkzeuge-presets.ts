/**
 * Werkzeuge Preset Library — curated catalog of MCP servers.
 *
 * Each preset contains everything needed to register and explain
 * the server to a non-technical user.
 */

export interface WerkzeugPreset {
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
  /** What tools/capabilities this provides */
  features: string[];
  /** npx command or URL to connect */
  address: string;
  /** Environment variables needed (name → human explanation) */
  requirements: Record<string, string>;
  /** Optional hint or setup link */
  hint?: string;
}

export const WERKZEUG_CATEGORIES = [
  "Google",
  "Entwicklung",
  "Kommunikation",
  "Produktivität",
  "Datenbank",
  "Suche & Web",
  "Dateien",
  "Design",
  "Content & CMS",
] as const;

export const WERKZEUG_PRESETS: WerkzeugPreset[] = [
  // ── Google ──
  {
    id: "google-drive",
    name: "Google Drive",
    category: "Google",
    summary: "Dateien in Google Drive verwalten",
    description:
      "Zugriff auf Google Drive: Dateien suchen, lesen, erstellen und organisieren. Funktioniert mit Docs, Sheets und allen Drive-Dateien.",
    features: ["Dateien suchen", "Dokumente lesen", "Dateien hochladen", "Ordner verwalten"],
    address: "npx -y @modelcontextprotocol/server-gdrive",
    requirements: {
      GOOGLE_CLIENT_ID: "OAuth Client ID aus der Google Cloud Console",
      GOOGLE_CLIENT_SECRET: "OAuth Client Secret aus der Google Cloud Console",
    },
    hint: "Erstelle ein OAuth-Projekt unter console.cloud.google.com",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Google",
    summary: "Termine und Kalender verwalten",
    description:
      "Termine lesen, erstellen und bearbeiten. Kalender durchsuchen, freie Zeiten finden und Einladungen verwalten.",
    features: ["Termine anzeigen", "Termine erstellen", "Freie Zeiten finden", "Kalender durchsuchen"],
    address: "npx -y @anthropic/mcp-server-google-calendar",
    requirements: {
      GOOGLE_CLIENT_ID: "OAuth Client ID aus der Google Cloud Console",
      GOOGLE_CLIENT_SECRET: "OAuth Client Secret aus der Google Cloud Console",
    },
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "Google",
    summary: "E-Mails lesen und senden",
    description:
      "E-Mails durchsuchen, lesen, beantworten und verfassen. Labels verwalten und E-Mails organisieren.",
    features: ["E-Mails suchen", "E-Mails lesen", "E-Mails senden", "Labels verwalten"],
    address: "npx -y @anthropic/mcp-server-gmail",
    requirements: {
      GOOGLE_CLIENT_ID: "OAuth Client ID aus der Google Cloud Console",
      GOOGLE_CLIENT_SECRET: "OAuth Client Secret aus der Google Cloud Console",
    },
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "Google",
    summary: "Tabellen lesen und bearbeiten",
    description:
      "Google Sheets öffnen, Daten lesen, Zeilen hinzufügen und Zellen bearbeiten. Ideal für Datenanalyse und Berichte.",
    features: ["Tabellen lesen", "Daten schreiben", "Zellen bearbeiten", "Blätter erstellen"],
    address: "npx -y @anthropic/mcp-server-google-sheets",
    requirements: {
      GOOGLE_CLIENT_ID: "OAuth Client ID aus der Google Cloud Console",
      GOOGLE_CLIENT_SECRET: "OAuth Client Secret aus der Google Cloud Console",
    },
  },
  // ── Entwicklung ──
  {
    id: "github",
    name: "GitHub",
    category: "Entwicklung",
    summary: "Repositories, Issues & Pull Requests",
    description:
      "Vollständiger GitHub-Zugriff: Repositories durchsuchen, Issues erstellen, Pull Requests reviewen, Code lesen und Dateien bearbeiten.",
    features: ["Repos durchsuchen", "Issues erstellen", "PRs verwalten", "Code lesen", "Dateien bearbeiten"],
    address: "npx -y @modelcontextprotocol/server-github",
    requirements: {
      GITHUB_TOKEN: "Personal Access Token von github.com/settings/tokens",
    },
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "Entwicklung",
    summary: "GitLab Projekte und Merge Requests",
    description:
      "GitLab Projekte verwalten: Code lesen, Issues erstellen, Merge Requests bearbeiten und Pipelines überwachen.",
    features: ["Projekte durchsuchen", "Issues erstellen", "MRs verwalten", "Pipelines ansehen"],
    address: "npx -y @modelcontextprotocol/server-gitlab",
    requirements: {
      GITLAB_TOKEN: "Personal Access Token von GitLab → Einstellungen → Access Tokens",
    },
  },
  {
    id: "linear",
    name: "Linear",
    category: "Entwicklung",
    summary: "Projektmanagement mit Linear",
    description:
      "Linear Issues erstellen, bearbeiten und durchsuchen. Projekte und Zyklen verwalten, Status aktualisieren.",
    features: ["Issues erstellen", "Issues durchsuchen", "Status ändern", "Projekte verwalten"],
    address: "npx -y @linear/mcp-server",
    requirements: {
      LINEAR_API_KEY: "API Key aus Linear → Einstellungen → API",
    },
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "Entwicklung",
    summary: "Error Tracking und Monitoring",
    description:
      "Sentry Fehlerberichte durchsuchen, Issues analysieren und Releases verwalten. Ideal für Debugging.",
    features: ["Fehler durchsuchen", "Issues analysieren", "Releases ansehen", "Trends erkennen"],
    address: "npx -y @sentry/mcp-server",
    requirements: {
      SENTRY_AUTH_TOKEN: "Auth Token von sentry.io → Einstellungen → Auth Tokens",
    },
  },
  // ── Kommunikation ──
  {
    id: "slack",
    name: "Slack",
    category: "Kommunikation",
    summary: "Nachrichten und Kanäle verwalten",
    description:
      "Slack Nachrichten lesen und senden, Kanäle durchsuchen, Threads verfolgen und Dateien teilen.",
    features: ["Nachrichten lesen", "Nachrichten senden", "Kanäle durchsuchen", "Dateien teilen"],
    address: "npx -y @modelcontextprotocol/server-slack",
    requirements: {
      SLACK_BOT_TOKEN: "Bot Token aus der Slack App Konfiguration (xoxb-...)",
    },
    hint: "Erstelle eine Slack App unter api.slack.com/apps",
  },
  {
    id: "discord",
    name: "Discord",
    category: "Kommunikation",
    summary: "Discord Server und Nachrichten",
    description:
      "Discord Nachrichten lesen und senden, Server verwalten, Kanäle durchsuchen und Mitglieder sehen.",
    features: ["Nachrichten lesen", "Nachrichten senden", "Kanäle verwalten", "Server durchsuchen"],
    address: "npx -y @anthropic/mcp-server-discord",
    requirements: {
      DISCORD_BOT_TOKEN: "Bot Token aus dem Discord Developer Portal",
    },
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "Kommunikation",
    summary: "Telegram Nachrichten und Bots",
    description:
      "Telegram Nachrichten lesen und senden über einen Bot. Chats durchsuchen und Medien teilen.",
    features: ["Nachrichten senden", "Nachrichten lesen", "Chats auflisten", "Medien senden"],
    address: "npx -y @anthropic/mcp-server-telegram",
    requirements: {
      TELEGRAM_BOT_TOKEN: "Bot Token vom BotFather in Telegram",
    },
  },
  // ── Produktivität ──
  {
    id: "notion",
    name: "Notion",
    category: "Produktivität",
    summary: "Notion Seiten und Datenbanken",
    description:
      "Notion Seiten lesen, erstellen und bearbeiten. Datenbanken durchsuchen und Einträge verwalten.",
    features: ["Seiten lesen", "Seiten erstellen", "Datenbanken durchsuchen", "Einträge bearbeiten"],
    address: "npx -y @modelcontextprotocol/server-notion",
    requirements: {
      NOTION_API_KEY: "Integration Token aus notion.so/my-integrations",
    },
  },
  {
    id: "trello",
    name: "Trello",
    category: "Produktivität",
    summary: "Trello Boards und Karten",
    description:
      "Trello Boards verwalten, Karten erstellen, verschieben und bearbeiten. Listen und Checklisten organisieren.",
    features: ["Boards anzeigen", "Karten erstellen", "Karten verschieben", "Checklisten verwalten"],
    address: "npx -y @anthropic/mcp-server-trello",
    requirements: {
      TRELLO_API_KEY: "API Key von trello.com/power-ups/admin",
      TRELLO_TOKEN: "Token von Trello Autorisierung",
    },
  },
  {
    id: "todoist",
    name: "Todoist",
    category: "Produktivität",
    summary: "Aufgaben und Projekte verwalten",
    description:
      "Todoist Aufgaben erstellen, bearbeiten und abhaken. Projekte organisieren und Fristen setzen.",
    features: ["Aufgaben erstellen", "Aufgaben abhaken", "Projekte verwalten", "Fristen setzen"],
    address: "npx -y @anthropic/mcp-server-todoist",
    requirements: {
      TODOIST_API_TOKEN: "API Token aus Todoist → Einstellungen → Integrationen",
    },
  },
  {
    id: "jira",
    name: "Jira",
    category: "Produktivität",
    summary: "Jira Issues und Projekte",
    description:
      "Jira Issues erstellen, bearbeiten und durchsuchen. Sprints und Projekte verwalten, Status aktualisieren.",
    features: ["Issues erstellen", "Issues durchsuchen", "Sprints ansehen", "Status aktualisieren"],
    address: "npx -y @anthropic/mcp-server-jira",
    requirements: {
      JIRA_URL: "URL deiner Jira-Instanz (z.B. https://firma.atlassian.net)",
      JIRA_EMAIL: "E-Mail deines Jira-Accounts",
      JIRA_API_TOKEN: "API Token von id.atlassian.com/manage-profile/security/api-tokens",
    },
  },
  // ── Datenbank ──
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "Datenbank",
    summary: "PostgreSQL Datenbank abfragen",
    description:
      "SQL-Abfragen auf PostgreSQL ausführen: Daten lesen, Tabellen anzeigen, Schema erkunden. Nur lesend — keine Änderungen.",
    features: ["SQL ausführen", "Tabellen anzeigen", "Schema erkunden", "Daten exportieren"],
    address: "npx -y @modelcontextprotocol/server-postgres",
    requirements: {
      POSTGRES_CONNECTION_STRING: "Verbindungs-URL (z.B. postgresql://user:pass@localhost/db)",
    },
  },
  {
    id: "sqlite",
    name: "SQLite",
    category: "Datenbank",
    summary: "Lokale SQLite Datenbank abfragen",
    description:
      "Lokale SQLite-Dateien öffnen und abfragen. Tabellen erkunden, Daten lesen und einfache Analysen durchführen.",
    features: ["SQL ausführen", "Tabellen anzeigen", "Schema erkunden", "Daten lesen"],
    address: "npx -y @modelcontextprotocol/server-sqlite",
    requirements: {},
    hint: "Pfad zur .db-Datei wird beim Verbinden angegeben",
  },
  // ── Suche & Web ──
  {
    id: "brave-search",
    name: "Brave Search",
    category: "Suche & Web",
    summary: "Websuche mit Brave Search API",
    description:
      "Websuche über die Brave Search API — schnell, privat und zuverlässig. Ideal als Alternative zu Google Search.",
    features: ["Websuche", "News suchen", "Bilder suchen", "Ergebnisse filtern"],
    address: "npx -y @modelcontextprotocol/server-brave-search",
    requirements: {
      BRAVE_API_KEY: "API Key von brave.com/search/api",
    },
    hint: "Web-Suche ist bereits als eingebautes Tool verfügbar — dieser MCP-Server bietet erweiterte Optionen",
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    category: "Suche & Web",
    summary: "Webseiten automatisiert lesen",
    description:
      "Webseiten mit einem echten Browser öffnen, Screenshots machen, Inhalte extrahieren und Formulare ausfüllen.",
    features: ["Webseiten öffnen", "Screenshots machen", "Inhalte extrahieren", "Navigation"],
    address: "npx -y @modelcontextprotocol/server-puppeteer",
    requirements: {},
  },
  {
    id: "fetch",
    name: "Web Fetch",
    category: "Suche & Web",
    summary: "Webseiten und APIs abrufen",
    description:
      "Beliebige URLs abrufen und den Inhalt als Text oder JSON zurückgeben. Gut für APIs, RSS-Feeds und Webseiten.",
    features: ["URLs abrufen", "JSON parsen", "HTML lesen", "API-Anfragen"],
    address: "npx -y @modelcontextprotocol/server-fetch",
    requirements: {},
  },
  // ── Dateien ──
  {
    id: "filesystem",
    name: "Dateisystem",
    category: "Dateien",
    summary: "Lokale Dateien lesen und schreiben",
    description:
      "Dateien auf dem Server lesen, erstellen, bearbeiten und organisieren. Verzeichnisse durchsuchen und Dateien verschieben.",
    features: ["Dateien lesen", "Dateien schreiben", "Verzeichnisse durchsuchen", "Dateien verschieben"],
    address: "npx -y @modelcontextprotocol/server-filesystem .",
    requirements: {},
    hint: "Ersetze den Punkt am Ende mit dem gewünschten Verzeichnispfad",
  },
  {
    id: "memory",
    name: "Wissensdatenbank",
    category: "Dateien",
    summary: "Persistenter Wissensspeicher",
    description:
      "Ein lokaler Wissensspeicher als Knowledge Graph. Fakten, Beziehungen und Kontext über Sitzungen hinweg merken.",
    features: ["Fakten speichern", "Wissen abrufen", "Beziehungen verknüpfen", "Kontext merken"],
    address: "npx -y @modelcontextprotocol/server-memory",
    requirements: {},
  },
  // ── Design ──
  {
    id: "figma",
    name: "Figma",
    category: "Design",
    summary: "Figma Designs lesen und exportieren",
    description:
      "Figma-Dateien öffnen, Designs ansehen, Komponenten auflisten und Assets exportieren.",
    features: ["Designs ansehen", "Komponenten auflisten", "Assets exportieren", "Stile lesen"],
    address: "npx -y @anthropic/mcp-server-figma",
    requirements: {
      FIGMA_ACCESS_TOKEN: "Personal Access Token aus Figma → Einstellungen → Access Tokens",
    },
  },
  // ── Content & CMS ──
  {
    id: "ghost-cms",
    name: "Ghost CMS",
    category: "Content & CMS",
    summary: "Blog-Artikel in Ghost erstellen und verwalten",
    description:
      "Vollständiger Zugriff auf dein Ghost CMS: Artikel erstellen, bearbeiten, veröffentlichen. Mitglieder, Tags, Newsletter und mehr verwalten. Perfekt für automatisierte Content-Pipelines.",
    features: [
      "Artikel erstellen & veröffentlichen",
      "Artikel suchen & bearbeiten",
      "Tags verwalten",
      "Mitglieder verwalten",
      "Newsletter verwalten",
      "Webhooks einrichten",
    ],
    address: "npx -y @fanyangmeng/ghost-mcp",
    requirements: {
      GHOST_API_URL: "URL deiner Ghost-Seite (z.B. https://aiianer.de)",
      GHOST_ADMIN_API_KEY: "Admin API Key aus Ghost → Settings → Integrations → Custom Integration",
    },
    hint: "GHOST_API_VERSION wird automatisch auf v5.0 gesetzt. Admin API Key findest du unter Ghost → Settings → Integrations → Add Custom Integration.",
  },
];
