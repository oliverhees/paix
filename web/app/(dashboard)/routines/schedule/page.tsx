"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduledRun {
  routine_id: string;
  routine_name: string;
  scheduled_at: string;
  cron_expression: string;
  timezone: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cronToHuman(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length < 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  if (min === "0" && hour !== "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Täglich um ${hour.padStart(2, "0")}:00`;
  }
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Täglich um ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dom === "*" && mon === "*" && dow === "1") {
    return `Jeden Montag um ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dom === "*" && mon === "*" && dow === "1-5") {
    return `Werktags um ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dom === "*" && mon === "*" && dow === "MON-FRI") {
    return `Werktags um ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dom === "1" && mon === "*" && dow === "*") {
    return `Monatlich am 1. um ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (min === "0" && hour === "*" && dom === "*") {
    return "Jede Stunde";
  }
  if (min.startsWith("*/")) {
    return `Alle ${min.slice(2)} Minuten`;
  }
  if (hour.startsWith("*/")) {
    return `Alle ${hour.slice(2)} Stunden`;
  }
  return cron;
}

function groupByDay(runs: ScheduledRun[]): Map<string, ScheduledRun[]> {
  const groups = new Map<string, ScheduledRun[]>();
  for (const run of runs) {
    const date = new Date(run.scheduled_at);
    const key = date.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(run);
  }
  return groups;
}

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, gi) => (
        <div key={gi} className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-0">
            {Array.from({ length: gi === 0 ? 3 : 2 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 pb-4">
                <div className="flex flex-col items-center">
                  <Skeleton className="size-3 rounded-full" />
                  {i < (gi === 0 ? 2 : 1) && (
                    <Skeleton className="w-0.5 h-8 mt-1" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5 pb-2">
                  <div className="flex items-baseline gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="rounded-full bg-muted p-6">
        <CalendarClock className="size-10 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Keine geplanten Ausführungen</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Keine aktiven Routinen geplant. Aktiviere Routinen, um sie hier zu
          sehen.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduledRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const data = await api.get<{ schedule: ScheduledRun[] }>(
          "/routines/schedule?count=30"
        );
        setSchedule(data.schedule);
      } catch {
        toast.error("Fehler beim Laden des Zeitplans");
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, []);

  const grouped = groupByDay(schedule);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 mt-0.5"
          onClick={() => router.push("/routines")}
          aria-label="Zurück zu Routinen"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zeitplan</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Nächste geplante Ausführungen deiner aktiven Routinen
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <TimelineSkeleton />
      ) : schedule.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([dayLabel, runs]) => {
            const todayGroup = runs.some((r) => isToday(r.scheduled_at));

            return (
              <div key={dayLabel} className="relative">
                {/* Day Header */}
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground capitalize">
                    {dayLabel}
                  </h3>
                  {todayGroup && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      Heute
                    </span>
                  )}
                </div>

                {/* Timeline entries */}
                <div className="space-y-0">
                  {runs.map((run, i) => {
                    const today = isToday(run.scheduled_at);

                    return (
                      <div
                        key={`${run.routine_id}-${run.scheduled_at}-${i}`}
                        className="flex items-start gap-4 pb-4 relative"
                      >
                        {/* Timeline dot + line */}
                        <div className="flex flex-col items-center shrink-0 pt-1.5">
                          <div
                            className={`size-3 rounded-full border-2 transition-colors ${
                              today
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/40 bg-background"
                            }`}
                          />
                          {i < runs.length - 1 && (
                            <div className="w-0.5 flex-1 min-h-8 bg-border mt-1" />
                          )}
                        </div>

                        {/* Entry content */}
                        <div
                          className={`flex-1 pb-1 rounded-lg transition-colors ${
                            today ? "bg-primary/5 px-3 py-2 -mx-1" : ""
                          }`}
                        >
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-lg font-mono font-semibold tabular-nums">
                              {formatTime(run.scheduled_at)}
                            </span>
                            <button
                              onClick={() =>
                                router.push(`/routines/${run.routine_id}`)
                              }
                              className="text-sm font-medium text-primary hover:underline text-left"
                            >
                              {run.routine_name}
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="size-3 text-muted-foreground shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {cronToHuman(run.cron_expression)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
