"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Wrench } from "lucide-react";

/* -- Types ------------------------------------------------ */

interface ToolCall {
  name: string;
  type?: string;
}

interface ActivityEvent {
  id: string;
  type: "skill" | "workflow";
  name: string;
  name_de?: string;
  status: string;
  status_de?: string;
  duration_ms: number | null;
  output_preview: string;
  error: string | null;
  tool_calls?: ToolCall[];
  created_at: string | null;
  completed_at: string | null;
}

/* -- Tool name translation (mirrors backend) -------------- */

const TOOL_TRANSLATIONS: Record<string, string> = {
  web_search: "Websuche",
  web_fetch: "Webseite abrufen",
  storage_write: "Datei speichern",
  storage_read: "Datei lesen",
  storage_list: "Dateien auflisten",
  storage_delete: "Datei loeschen",
  create_artifact: "Dokument erstellen",
  call_skill: "Skill aufrufen",
  calendar_briefing: "Kalender-Briefing",
  content_pipeline: "Content Pipeline",
  meeting_prep: "Meeting-Vorbereitung",
  follow_up: "Follow-Up",
  idea_capture: "Ideen erfassen",
};

function translateTool(name: string): string {
  if (TOOL_TRANSLATIONS[name]) return TOOL_TRANSLATIONS[name];
  if (name.startsWith("mcp__")) {
    const parts = name.split("__");
    if (parts.length >= 3) {
      const server = parts[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const action = parts.slice(2).join(" ").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return `${server}: ${action}`;
    }
  }
  if (name.startsWith("api__")) {
    const parts = name.split("__");
    if (parts.length >= 3) return `API: ${parts[1]} — ${parts[2]}`;
  }
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -- Helpers ----------------------------------------------- */

function statusColor(status: string): string {
  switch (status) {
    case "running":
    case "pending":
      return "bg-blue-500";
    case "success":
    case "completed":
      return "bg-emerald-500";
    case "failed":
    case "error":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case "running":
    case "pending":
      return "\u23f3";
    case "success":
    case "completed":
      return "\u2705";
    case "failed":
    case "error":
      return "\u274c";
    default:
      return "\u26aa";
  }
}

function typeIcon(type: string): string {
  return type === "workflow" ? "\ud83d\udcc8" : "\ud83d\udd0d";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "--";
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "gerade eben";
  if (seconds < 60) return `vor ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function formatDuration(ms: number | null, status: string): string {
  if (status === "running" || status === "pending") return "Laeuft...";
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_ROW_STYLES: Record<string, string> = {
  running: "bg-blue-50 dark:bg-blue-950/30",
  pending: "bg-blue-50 dark:bg-blue-950/30",
  failed: "bg-red-50/50 dark:bg-red-950/20",
  error: "bg-red-50/50 dark:bg-red-950/20",
};

/* -- Component -------------------------------------------- */

interface ActivityFeedProps {
  limit?: number;
  pollInterval?: number;
  /** Use SSE stream instead of polling (default: true) */
  useStream?: boolean;
}

export function ActivityFeed({
  limit = 30,
  pollInterval = 5000,
  useStream = true,
}: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const latestTimestamp = useRef<string | null>(null);
  const initialLoad = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  /* -- Initial fetch (always needed for history) -- */
  const fetchActivity = useCallback(
    async (since?: string) => {
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (since) params.set("since", since);
        const data = await api.get<{ events: ActivityEvent[]; count: number; has_running: boolean }>(
          `/skills/activity-feed?${params}`
        );
        const fetched = data.events ?? [];

        if (since && fetched.length > 0) {
          setEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newOnes = fetched.filter((e) => !existingIds.has(e.id));
            return [...newOnes, ...prev].slice(0, limit);
          });
        } else if (!since) {
          setEvents(fetched);
        }

        if (fetched.length > 0) {
          const latest = fetched[0].completed_at ?? fetched[0].created_at;
          if (latest) latestTimestamp.current = latest;
        }
      } catch {
        // Silently fail on polling errors
      } finally {
        if (initialLoad.current) {
          setLoading(false);
          initialLoad.current = false;
        }
      }
    },
    [limit]
  );

  // Initial fetch
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  /* -- SSE Stream for live updates -- */
  useEffect(() => {
    if (!useStream) return;

    const baseUrl =
      typeof window !== "undefined"
        ? "/api/v1"
        : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1");

    const es = new EventSource(`${baseUrl}/skills/activity-stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ActivityEvent & { type: string };
        if (data.type === "connected") return;

        setEvents((prev) => {
          // Update existing event or prepend new
          const idx = prev.findIndex((e) => e.id === data.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = data;
            return updated;
          }
          return [data, ...prev].slice(0, limit);
        });
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [useStream, limit]);

  /* -- Fallback polling (when SSE is disabled) -- */
  useEffect(() => {
    if (useStream) return;
    const interval = setInterval(() => {
      fetchActivity(latestTimestamp.current ?? undefined);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchActivity, pollInterval, useStream]);

  /* -- Relative time ticker (updates every 30s) -- */
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2 animate-pulse">
            <div className="size-4 rounded bg-muted" />
            <div className="h-3 flex-1 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <span className="text-2xl opacity-40">&#x1f4e1;</span>
        <p className="text-sm text-muted-foreground">Noch keine Aktivitaeten</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {events.map((event) => {
        const isExpanded = expandedId === event.id;
        const hasError = event.error && event.error.length > 0;
        const hasToolCalls = (event.tool_calls?.length ?? 0) > 0;
        const isExpandable = hasError || hasToolCalls;
        const isRunning = event.status === "running" || event.status === "pending";
        const displayName = event.name_de || translateTool(event.name);

        return (
          <div key={event.id}>
            {/* Status color bar + row */}
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors border-l-2",
                isExpandable && "cursor-pointer hover:bg-muted/50",
                STATUS_ROW_STYLES[event.status] ?? "",
                // Color-coded left border
                event.status === "success" || event.status === "completed"
                  ? "border-l-emerald-500"
                  : event.status === "error" || event.status === "failed"
                    ? "border-l-red-500"
                    : event.status === "running" || event.status === "pending"
                      ? "border-l-blue-500"
                      : "border-l-gray-300 dark:border-l-gray-600"
              )}
              onClick={() => isExpandable && setExpandedId(isExpanded ? null : event.id)}
            >
              {/* Status dot */}
              <span className={cn("shrink-0 size-2 rounded-full", statusColor(event.status), isRunning && "animate-pulse")} />

              {/* Status icon */}
              <span className={cn("shrink-0 text-base", isRunning && "animate-pulse")}>
                {statusIcon(event.status)}
              </span>

              {/* Relative time */}
              <span className="text-xs text-muted-foreground shrink-0 w-16 tabular-nums">
                {relativeTime(event.completed_at ?? event.created_at)}
              </span>

              {/* Type icon + Translated Name */}
              <span className="shrink-0">{typeIcon(event.type)}</span>
              <span className="flex-1 truncate font-medium">{displayName}</span>

              {/* Tool call count badge */}
              {hasToolCalls && (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  <Wrench className="size-3" />
                  {event.tool_calls!.length}
                </span>
              )}

              {/* Duration */}
              <span
                className={cn(
                  "text-xs shrink-0 tabular-nums",
                  isRunning ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                )}
              >
                {formatDuration(event.duration_ms, event.status)}
              </span>

              {/* Expand indicator */}
              {isExpandable && (
                <span className="shrink-0 text-muted-foreground">
                  {isExpanded ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </span>
              )}
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="mx-2 mt-0.5 mb-1 space-y-1">
                {/* Tool calls */}
                {hasToolCalls && (
                  <div className="rounded bg-muted/50 px-3 py-2 text-xs space-y-0.5">
                    <div className="font-medium text-muted-foreground mb-1">Verwendete Tools:</div>
                    {event.tool_calls!.map((tc, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Wrench className="size-3 text-muted-foreground" />
                        <span>{translateTool(tc.name)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error message */}
                {hasError && (
                  <div className="rounded bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-all">
                    {event.error}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Returns whether any skill/workflow is currently running.
 * Uses the activity feed has_running flag.
 */
export function useActivityStatus(intervalMs = 10000) {
  const [hasRunning, setHasRunning] = useState(false);
  const [count, setCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 3600000).toISOString();
      const data = await api.get<{ events: unknown[]; count: number; has_running: boolean }>(
        `/skills/activity-feed?limit=100&since=${since}`
      );
      setCount(data.count ?? 0);
      setHasRunning(data.has_running ?? false);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, intervalMs);
    return () => clearInterval(interval);
  }, [fetchStatus, intervalMs]);

  return { hasRunning, count };
}

/**
 * Returns the count of recent activity events (for badge use).
 * Polls every `intervalMs` milliseconds.
 */
export function useActivityCount(intervalMs = 30000) {
  const { count } = useActivityStatus(intervalMs);
  return count;
}
