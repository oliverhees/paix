import { create } from "zustand";
import {
  telosService,
  TELOS_DIMENSIONS,
  DIMENSION_META,
  type TelosEntry,
  type TelosDimensionId,
} from "@/lib/telos-service";

// ─── Public Types ───

export interface TelosDimension {
  id: TelosDimensionId;
  name: string;
  description: string;
  /** Free-text content (concatenation of entries for display). */
  content: string;
  lastUpdated: Date;
  updatedBy: "user" | "agent";
  /** Raw backend entries for this dimension. */
  entries: TelosEntry[];
  /** Agent additions shown in green. */
  agentAdditions: string[];
}

interface TelosState {
  dimensions: TelosDimension[];
  activeDimension: string;
  isLoading: boolean;
  error: string | null;
  /** Track which dimensions have been fetched from API. */
  loadedFromApi: boolean;

  // Actions
  setActiveDimension: (id: string) => void;
  updateDimensionContent: (id: string, content: string) => void;

  // API Actions
  fetchAllDimensions: () => Promise<void>;
  fetchDimension: (dimension: TelosDimensionId) => Promise<void>;
  addEntry: (dimension: TelosDimensionId, content: string) => Promise<void>;
  deleteEntry: (dimension: TelosDimensionId, entryId: string) => Promise<void>;
  confirmEntry: (dimension: TelosDimensionId, entryId: string) => Promise<void>;
  saveDimension: (dimension: TelosDimensionId, content: string) => Promise<void>;
}

// ─── Mock Fallback Data ───

function buildMockDimensions(): TelosDimension[] {
  const mockContent: Record<TelosDimensionId, string> = {
    mission:
      "Ich baue Technologie, die Menschen befaehigt, produktiver und kreativer zu arbeiten. Mein Fokus liegt auf AI-gesteuerten Produkten, die komplexe Arbeit vereinfachen und Einzelpersonen sowie kleinen Teams ueberproportionale Wirkung ermoeglichen.",
    goals:
      "1. PAIONE MVP bis Ende Maerz 2026 live\n2. Erste 3 Pilot-Nutzer bis April 2026\n3. Agent One Marktvalidierung bis Q3 2026\n4. Monatliches Content-Ziel: 4 LinkedIn-Posts, 2 Blog-Artikel\n5. Netzwerk: 10 neue relevante Kontakte pro Monat",
    projects:
      "PAIONE (Personal AI · ONE) — In Entwicklung, Phase 1\nAgent One — Planung, Pre-MVP\nHR Code Labs Website — Live, Wartungsmodus\nContent Pipeline — Konzeption",
    beliefs:
      "- Technologie soll den Menschen dienen, nicht umgekehrt\n- Open Source ist ein Multiplikator fuer Innovation\n- Kleine Teams mit AI-Tools koennen Grossunternehmen schlagen\n- Datenschutz ist ein Grundrecht, kein Feature\n- Konsistenz schlaegt Perfektion",
    models:
      "- First Principles Thinking\n- Jobs to be Done (JTBD)\n- Build-Measure-Learn (Lean Startup)\n- UNIX-Philosophie: Mach eine Sache gut\n- Pareto-Prinzip: 80% Ergebnis mit 20% Aufwand",
    strategies:
      "- MVP-first: Immer das Minimale bauen, das Wert liefert\n- Content als Vertrieb: Expertise zeigen statt Kaltakquise\n- AI-Leverage: Jeden Prozess automatisieren der automatisierbar ist\n- Community Building: Wissen teilen, Netzwerk aufbauen",
    narratives:
      '- "Dein digitaler Chief of Staff" — PAIONE Pitch\n- "AI fuer den Mittelstand" — Agent One Positioning\n- "Wir bauen die Zukunft der Arbeit" — HR Code Labs Vision\n- "Von Entwicklern fuer Entscheider" — Bridging the Gap Narrativ',
    learned:
      "- Perfektionismus ist der Feind von Fortschritt\n- User-Feedback > eigene Annahmen\n- Dokumentation spart langfristig mehr Zeit als sie kostet\n- Parallele Projekte funktionieren nur mit klarer Priorisierung\n- AI-Tools sind Multiplikatoren, keine Ersatz fuer Denken",
    challenges:
      "- Zeitmanagement: Zu viele Projekte parallel\n- Fokus: Ablenkung durch neue Ideen\n- Ressourcen: Solo-Entwicklung limitiert Geschwindigkeit\n- Marktvalidierung: Noch kein zahlender Kunde\n- Infrastruktur: Self-Hosting erfordert DevOps-Kompetenz",
    ideas:
      "- Voice-First Interface fuer PAIONE (Spaziergang-Modus)\n- Steuerberater-spezifische AI-Skills fuer Agent One\n- Open-Source Community rund um PAIONE Skills\n- Integration mit Notion/Obsidian als alternative Frontends\n- Telegram Bot als Minimal-Interface",
  };

  return TELOS_DIMENSIONS.map((id) => ({
    id,
    name: DIMENSION_META[id].name,
    description: DIMENSION_META[id].description,
    content: mockContent[id],
    lastUpdated: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 14),
    updatedBy: id === "learned" ? ("agent" as const) : ("user" as const),
    entries: [],
    agentAdditions:
      id === "goals"
        ? [
            "Basierend auf deinem Kalender: Du hast 3 Wochen bis zum MVP-Deadline. Aktueller Fortschritt: ~60%.",
          ]
        : [],
  }));
}

// ─── Helpers ───

function entriesToContent(entries: TelosEntry[]): string {
  return entries
    .filter((e) => e.status !== "archived")
    .map((e) => e.content)
    .join("\n");
}

function getLatestUpdatedBy(entries: TelosEntry[]): "user" | "agent" {
  const agentEntries = entries.filter((e) => e.source === "agent");
  return agentEntries.length > 0 ? "agent" : "user";
}

function getAgentAdditions(entries: TelosEntry[]): string[] {
  return entries
    .filter((e) => e.source === "agent" && e.status === "review_needed")
    .map((e) => e.content);
}

function getLastUpdated(entries: TelosEntry[]): Date {
  const dates = entries
    .map((e) => e.updated_at || e.created_at)
    .filter(Boolean)
    .map((d) => new Date(d!));
  return dates.length > 0
    ? new Date(Math.max(...dates.map((d) => d.getTime())))
    : new Date();
}

// ─── Store ───

export const useTelosStore = create<TelosState>((set, get) => ({
  dimensions: buildMockDimensions(),
  activeDimension: "mission",
  isLoading: false,
  error: null,
  loadedFromApi: false,

  setActiveDimension: (id) => set({ activeDimension: id }),

  updateDimensionContent: (id, content) =>
    set((state) => ({
      dimensions: state.dimensions.map((d) =>
        d.id === id
          ? { ...d, content, lastUpdated: new Date(), updatedBy: "user" as const }
          : d
      ),
    })),

  fetchAllDimensions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await telosService.getAllDimensions();
      const dimensions: TelosDimension[] = TELOS_DIMENSIONS.map((id) => {
        const entries = response.dimensions[id] || [];
        return {
          id,
          name: DIMENSION_META[id].name,
          description: DIMENSION_META[id].description,
          content: entriesToContent(entries),
          lastUpdated: getLastUpdated(entries),
          updatedBy: getLatestUpdatedBy(entries),
          entries,
          agentAdditions: getAgentAdditions(entries),
        };
      });
      set({ dimensions, isLoading: false, loadedFromApi: true });
    } catch (error) {
      console.warn("[TELOS] API unavailable, using mock data:", error);
      set({ isLoading: false, error: "Backend nicht erreichbar. Lokale Daten werden angezeigt." });
      // Keep mock data as fallback — already initialized
    }
  },

  fetchDimension: async (dimension) => {
    try {
      const response = await telosService.getDimension(dimension);
      set((state) => ({
        dimensions: state.dimensions.map((d) =>
          d.id === dimension
            ? {
                ...d,
                content: entriesToContent(response.entries),
                lastUpdated: response.last_updated
                  ? new Date(response.last_updated)
                  : new Date(),
                updatedBy: getLatestUpdatedBy(response.entries),
                entries: response.entries,
                agentAdditions: getAgentAdditions(response.entries),
              }
            : d
        ),
      }));
    } catch (error) {
      console.warn(`[TELOS] Failed to fetch dimension ${dimension}:`, error);
    }
  },

  addEntry: async (dimension, content) => {
    try {
      const entry = await telosService.addEntry(dimension, { content });
      set((state) => ({
        dimensions: state.dimensions.map((d) => {
          if (d.id !== dimension) return d;
          const newEntries = [...d.entries, entry];
          return {
            ...d,
            entries: newEntries,
            content: entriesToContent(newEntries),
            lastUpdated: new Date(),
            updatedBy: "user" as const,
          };
        }),
      }));
    } catch (error) {
      console.warn(`[TELOS] Failed to add entry to ${dimension}:`, error);
      // Optimistic fallback: add locally
      const localEntry: TelosEntry = {
        id: crypto.randomUUID(),
        content,
        source: "user",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((state) => ({
        dimensions: state.dimensions.map((d) => {
          if (d.id !== dimension) return d;
          const newEntries = [...d.entries, localEntry];
          return {
            ...d,
            entries: newEntries,
            content: entriesToContent(newEntries),
            lastUpdated: new Date(),
            updatedBy: "user" as const,
          };
        }),
      }));
    }
  },

  deleteEntry: async (dimension, entryId) => {
    try {
      await telosService.deleteEntry(dimension, entryId);
    } catch (error) {
      console.warn(`[TELOS] Failed to delete entry ${entryId}:`, error);
    }
    // Remove locally regardless (optimistic)
    set((state) => ({
      dimensions: state.dimensions.map((d) => {
        if (d.id !== dimension) return d;
        const newEntries = d.entries.filter((e) => e.id !== entryId);
        return {
          ...d,
          entries: newEntries,
          content: entriesToContent(newEntries),
          lastUpdated: new Date(),
        };
      }),
    }));
  },

  confirmEntry: async (dimension, entryId) => {
    try {
      await telosService.confirmEntry(dimension, entryId);
    } catch (error) {
      console.warn(`[TELOS] Failed to confirm entry ${entryId}:`, error);
    }
    // Update locally
    set((state) => ({
      dimensions: state.dimensions.map((d) => {
        if (d.id !== dimension) return d;
        const newEntries = d.entries.map((e) =>
          e.id === entryId ? { ...e, status: "active" as const } : e
        );
        return {
          ...d,
          entries: newEntries,
          agentAdditions: getAgentAdditions(newEntries),
        };
      }),
    }));
  },

  saveDimension: async (dimension, content) => {
    // Update local state immediately
    set((state) => ({
      dimensions: state.dimensions.map((d) =>
        d.id === dimension
          ? { ...d, content, lastUpdated: new Date(), updatedBy: "user" as const }
          : d
      ),
    }));

    // Try to persist via API
    try {
      await telosService.updateDimension(dimension, [{ content }]);
    } catch (error) {
      console.warn(`[TELOS] Failed to save dimension ${dimension}:`, error);
      // Local state already updated, user sees their changes
    }
  },
}));
