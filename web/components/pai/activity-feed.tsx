"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

/* ── Types ────────────────────────────────────── */

interface ActivityEvent {
  id: string;
  type: "skill" | "workflow";
  name: string;
  status: string;
  duration_ms: number | null;
  output_preview: string;
  error: string | null;
  created_at: string | null;
}

/* ── Helpers ──────────────────────────────────── */

function statusIcon(status: string): string {
  switch (status) {
    case "running":
    case "pending":
      return "\u23f3"; // hourglass
    case "success":
    case "completed":
      return "\u2705"; // check
    case "failed":
    case "error":
      return "\u274c"; // cross
    default:
      return "\u26aa"; // circle
  }
}

function typeIcon(type: string): string {
  return type === "workflow" ? "\ud83d\udcc8" : "\ud83d\udd0d"; // chart / magnifier
}

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
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

/* ── Component ────────────────────────────────── */

interface ActivityFeedProps {
  /** Maximum items to display */
  limit?: number;
  /** Polling interval in ms (default 5000) */
  pollInterval?: number;
}

export function ActivityFeed({ limit = 30, pollInterval = 5000 }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const latestTimestamp = useRef<string | null>(null);
  const initialLoad = useRef(true);

  const fetchActivity = useCallback(
    async (since?: string) => {
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (since) params.set("since", since);
        const data = await api.get<{ events: ActivityEvent[]; count: number }>(
          `/skills/activity-feed?${params}`
        );
        const fetched = data.events ?? [];

        if (since && fetched.length > 0) {
          // Incremental: prepend new events, deduplicate
          setEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newOnes = fetched.filter((e) => !existingIds.has(e.id));
            return [...newOnes, ...prev].slice(0, limit);
          });
        } else if (!since) {
          setEvents(fetched);
        }

        // Track latest timestamp for incremental polling
        if (fetched.length > 0 && fetched[0].created_at) {
          latestTimestamp.current = fetched[0].created_at;
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

  // Polling with incremental updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActivity(latestTimestamp.current ?? undefined);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchActivity, pollInterval]);

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
        <span className="text-2xl opacity-40">📡</span>
        <p className="text-sm text-muted-foreground">Noch keine Aktivitaeten</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {events.map((event) => {
        const isExpanded = expandedId === event.id;
        const hasError = event.error && event.error.length > 0;
        const isRunning = event.status === "running" || event.status === "pending";

        return (
          <div key={event.id}>
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                hasError && "cursor-pointer hover:bg-muted/50",
                STATUS_ROW_STYLES[event.status] ?? ""
              )}
              onClick={() => hasError && setExpandedId(isExpanded ? null : event.id)}
            >
              {/* Status icon */}
              <span className={cn("shrink-0 text-base", isRunning && "animate-pulse")}>
                {statusIcon(event.status)}
              </span>

              {/* Time */}
              <span className="text-xs text-muted-foreground shrink-0 w-11 tabular-nums">
                {formatTime(event.created_at)}
              </span>

              {/* Type icon + Name */}
              <span className="shrink-0">{typeIcon(event.type)}</span>
              <span className="flex-1 truncate font-medium">{event.name}</span>

              {/* Duration or status */}
              <span
                className={cn(
                  "text-xs shrink-0 tabular-nums",
                  isRunning ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                )}
              >
                {formatDuration(event.duration_ms, event.status)}
              </span>

              {/* Error expand indicator */}
              {hasError && (
                <span className="shrink-0 text-muted-foreground">
                  {isExpanded ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </span>
              )}
            </div>

            {/* Expanded error message */}
            {isExpanded && hasError && (
              <div className="mx-2 mt-0.5 mb-1 rounded bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-all">
                {event.error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Returns the count of recent activity events (for badge use).
 * Polls every `intervalMs` milliseconds.
 */
export function useActivityCount(intervalMs = 30000) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      // Get events from the last hour
      const since = new Date(Date.now() - 3600000).toISOString();
      const data = await api.get<{ events: unknown[]; count: number }>(
        `/skills/activity-feed?limit=100&since=${since}`
      );
      setCount(data.count ?? 0);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, intervalMs);
    return () => clearInterval(interval);
  }, [fetchCount, intervalMs]);

  return count;
}
