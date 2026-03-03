/**
 * TELOS Service — CRUD operations for all 10 Identity Layer dimensions.
 * Connects to FastAPI backend with fallback to mock data.
 *
 * Backend endpoints:
 *   GET    /telos                              — All dimensions
 *   GET    /telos/{dimension}                  — Single dimension
 *   PUT    /telos/{dimension}                  — Update dimension entries
 *   POST   /telos/{dimension}/entries          — Add entry
 *   DELETE /telos/{dimension}/entries/{id}     — Delete entry
 *   POST   /telos/{dimension}/entries/{id}/confirm — Confirm agent entry
 */

import { api } from "@/lib/api";

// ─── Types (mirroring FastAPI schemas) ───

export interface TelosEntry {
  id: string;
  content: string;
  source: "user" | "agent";
  status: "active" | "review_needed" | "archived";
  created_at: string | null;
  updated_at: string | null;
}

export interface TelosDimensionResponse {
  dimension: string;
  entries: TelosEntry[];
  last_updated: string | null;
}

export interface TelosAllDimensionsResponse {
  dimensions: Record<string, TelosEntry[]>;
  last_updated: string | null;
}

export interface TelosEntryCreate {
  content: string;
  metadata?: Record<string, unknown>;
}

// ─── Valid Dimensions ───

export const TELOS_DIMENSIONS = [
  "mission",
  "goals",
  "projects",
  "beliefs",
  "models",
  "strategies",
  "narratives",
  "learned",
  "challenges",
  "ideas",
] as const;

export type TelosDimensionId = (typeof TELOS_DIMENSIONS)[number];

export const DIMENSION_META: Record<
  TelosDimensionId,
  { name: string; description: string }
> = {
  mission: {
    name: "Mission",
    description:
      "Dein uebergeordneter Lebenszweck und deine Kernmotivation.",
  },
  goals: {
    name: "Ziele",
    description: "Konkrete, messbare Ziele fuer die naechsten 3-12 Monate.",
  },
  projects: {
    name: "Projekte",
    description: "Aktive Projekte und deren Status.",
  },
  beliefs: {
    name: "Ueberzeugungen",
    description:
      "Kernwerte und fundamentale Annahmen, die dein Handeln leiten.",
  },
  models: {
    name: "Modelle",
    description: "Mentale Modelle und Frameworks, die du nutzt.",
  },
  strategies: {
    name: "Strategien",
    description: "Aktive Strategien und Taktiken zur Zielerreichung.",
  },
  narratives: {
    name: "Narrative",
    description:
      "Geschichten und Framings, die du nutzt um zu kommunizieren.",
  },
  learned: {
    name: "Gelerntes",
    description: "Wichtige Erkenntnisse und Lessons Learned.",
  },
  challenges: {
    name: "Herausforderungen",
    description: "Aktuelle Hindernisse und offene Probleme.",
  },
  ideas: {
    name: "Ideen",
    description: "Neue Ideen, Einfaelle und moegliche Richtungen.",
  },
};

// ─── Service ───

class TelosService {
  /**
   * Get all 10 dimensions with their entries.
   */
  async getAllDimensions(): Promise<TelosAllDimensionsResponse> {
    return api.get<TelosAllDimensionsResponse>("/telos");
  }

  /**
   * Get a single dimension with all entries.
   */
  async getDimension(dimension: TelosDimensionId): Promise<TelosDimensionResponse> {
    return api.get<TelosDimensionResponse>(`/telos/${dimension}`);
  }

  /**
   * Update all entries in a dimension (full replace).
   */
  async updateDimension(
    dimension: TelosDimensionId,
    entries: TelosEntryCreate[]
  ): Promise<{ dimension: string; entries: TelosEntry[] }> {
    return api.put<{ dimension: string; entries: TelosEntry[] }>(
      `/telos/${dimension}`,
      entries
    );
  }

  /**
   * Add a new entry to a dimension.
   */
  async addEntry(
    dimension: TelosDimensionId,
    entry: TelosEntryCreate
  ): Promise<TelosEntry> {
    return api.post<TelosEntry>(`/telos/${dimension}/entries`, entry);
  }

  /**
   * Delete an entry from a dimension.
   */
  async deleteEntry(
    dimension: TelosDimensionId,
    entryId: string
  ): Promise<void> {
    return api.delete<void>(`/telos/${dimension}/entries/${entryId}`);
  }

  /**
   * Confirm an agent-suggested entry.
   */
  async confirmEntry(
    dimension: TelosDimensionId,
    entryId: string
  ): Promise<{ message: string }> {
    return api.post<{ message: string }>(
      `/telos/${dimension}/entries/${entryId}/confirm`
    );
  }
}

export const telosService = new TelosService();
