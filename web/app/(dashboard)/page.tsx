"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Timer,
  MessageSquare,
  Bell,
  Clock,
  Play,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { api } from "@/lib/api";

/* ── Types ─────────────────────────────────────────── */

interface RoutineSummary {
  id: string;
  name: string;
  cron_human: string;
  is_active: boolean;
  last_run_status: string | null;
  next_run_at: string | null;
  total_runs: number;
}

interface ChatSession {
  id: string;
  title: string;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
}

interface ReminderSummary {
  id: string;
  title: string;
  message: string;
  next_run_at: string | null;
  is_active: boolean;
  recurrence: string | null;
}

/* ── Helpers ─────────────────────────────────────────── */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  return `vor ${diffD} Tag${diffD > 1 ? "en" : ""}`;
}

function formatNextRun(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const STATUS_LABELS: Record<string, string> = {
  success: "Erfolgreich",
  failed: "Fehlgeschlagen",
  running: "Laeuft",
  completed: "Erfolgreich",
};

/* ── Empty State ─────────────────────────────────────── */

function EmptySection({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
      <Icon className="size-6 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/* ── Loading Skeleton ─────────────────────────────────── */

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/* ── Dashboard Page ──────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [reminders, setReminders] = useState<ReminderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [routinesRes, sessionsRes, remindersRes] = await Promise.allSettled([
        api.get<{ routines: RoutineSummary[] }>("/routines?is_active=true&limit=5&sort=next_run"),
        api.get<{ sessions: ChatSession[] }>("/chat/sessions?limit=5"),
        api.get<{ reminders: ReminderSummary[] }>("/reminders?active_only=true"),
      ]);

      if (routinesRes.status === "fulfilled") setRoutines(routinesRes.value.routines ?? []);
      if (sessionsRes.status === "fulfilled") setSessions(sessionsRes.value.sessions ?? []);
      if (remindersRes.status === "fulfilled") setReminders(remindersRes.value.reminders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{getGreeting()}, Oliver</h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Routinen — Full Width */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Timer className="size-5" />
                Aktive Routinen
              </CardTitle>
              <CardDescription>Naechste geplante Ausfuehrungen</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => router.push("/routines")}
            >
              Alle anzeigen
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SectionSkeleton />
          ) : routines.length === 0 ? (
            <EmptySection icon={Timer} text="Keine aktiven Routinen" />
          ) : (
            <div className="space-y-2.5">
              {routines.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/routines/${r.id}`)}
                >
                  <div className="size-2 rounded-full bg-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                  </div>
                  {r.last_run_status && (
                    <span
                      className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${
                        STATUS_STYLES[r.last_run_status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[r.last_run_status] ?? r.last_run_status}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                    <Clock className="size-3" />
                    {r.cron_human}
                  </span>
                  {r.next_run_at && (
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      {formatNextRun(r.next_run_at)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two Column Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Letzte Chat-Sessions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="size-5" />
                  Letzte Chats
                </CardTitle>
                <CardDescription>Deine letzten Gespraeche</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => router.push("/chat")}
              >
                Alle
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SectionSkeleton />
            ) : sessions.length === 0 ? (
              <EmptySection icon={MessageSquare} text="Noch keine Chats" />
            ) : (
              <div className="space-y-2.5">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/chat?session=${s.id}`)}
                  >
                    <div className="size-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title || "Unbenannt"}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {s.message_count} Nachrichten
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {timeAgo(s.last_message_at || s.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Erinnerungen */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="size-5" />
                  Erinnerungen
                </CardTitle>
                <CardDescription>Aktive Erinnerungen</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => router.push("/erinnerungen")}
              >
                Alle
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SectionSkeleton rows={2} />
            ) : reminders.length === 0 ? (
              <EmptySection icon={Inbox} text="Keine aktiven Erinnerungen" />
            ) : (
              <div className="space-y-2.5">
                {reminders.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className="size-1.5 rounded-full bg-yellow-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                    </div>
                    {r.next_run_at && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatNextRun(r.next_run_at)}
                      </span>
                    )}
                    {r.recurrence && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {r.recurrence}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
