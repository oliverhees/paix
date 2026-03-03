import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Target, Activity, Lightbulb, FileText } from "lucide-react";

/* ── Mock Data ─────────────────────────────────────────── */

const todayEvents = [
  { time: "08:00", title: "Morning Briefing", type: "routine", duration: "15 Min" },
  { time: "09:30", title: "Team Standup", type: "meeting", duration: "30 Min" },
  { time: "11:00", title: "Client Call — Benjamin Arras", type: "meeting", duration: "60 Min" },
  { time: "13:00", title: "Mittagspause", type: "break", duration: "60 Min" },
  { time: "14:30", title: "Deep Work: PAI-X Frontend", type: "focus", duration: "120 Min" },
  { time: "17:00", title: "Review & Tagesabschluss", type: "routine", duration: "30 Min" },
];

const priorities = [
  { id: 1, title: "PAI-X Chat Interface fertigstellen", status: "in-progress", urgency: "high" },
  { id: 2, title: "Blog-Artikel fuer LinkedIn schreiben", status: "todo", urgency: "medium" },
  { id: 3, title: "Meeting-Agenda fuer morgen vorbereiten", status: "todo", urgency: "low" },
];

const recentActivities = [
  { action: "Chat-Session abgeschlossen", detail: "Tagesplanung Montag", time: "vor 2 Std" },
  { action: "TELOS aktualisiert", detail: "Ziele: MVP-Deadline ergaenzt", time: "vor 5 Std" },
  { action: "Neuer Kontakt gespeichert", detail: "Benjamin Arras, Steuerberater", time: "gestern" },
  { action: "Skill ausgefuehrt", detail: "Calendar Briefing", time: "gestern 07:30" },
];

const recentIdeas = [
  { title: "Voice-First Interface fuer Spaziergaenge", date: "vor 1 Tag" },
  { title: "Telegram Bot als Minimal-PAI-X", date: "vor 3 Tagen" },
  { title: "Community-Skills-Marketplace", date: "vor 5 Tagen" },
];

const contentStatus = {
  title: "AI im Mittelstand — Warum jetzt?",
  platform: "LinkedIn",
  scheduledDate: "28. Feb 2026",
  status: "Entwurf",
};

/* ── Helpers ─────────────────────────────────────────── */

const typeColors: Record<string, string> = {
  meeting: "bg-blue-500",
  routine: "bg-green-500",
  focus: "bg-purple-500",
  break: "bg-orange-400",
};

const urgencyVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

/**
 * Dashboard Home - daily overview with today's schedule,
 * priorities, recent activity, ideas, and content status.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Guten Tag, Oliver</h1>
        <p className="text-muted-foreground">
          Hier ist dein Ueberblick fuer heute, {new Date().toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Today's Schedule — Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Heute
          </CardTitle>
          <CardDescription>Deine Termine und geplanten Bloecke</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todayEvents.map((event, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="w-12 text-sm font-mono text-muted-foreground shrink-0">
                  {event.time}
                </span>
                <div
                  className={`h-2 w-2 rounded-full shrink-0 ${typeColors[event.type] || "bg-gray-400"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {event.duration}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Priorities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Prioritaeten
            </CardTitle>
            <CardDescription>Top-3 fuer heute</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {priorities.map((p) => (
                <div key={p.id} className="flex items-start gap-3">
                  <div
                    className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      p.status === "in-progress" ? "bg-blue-500" : "bg-muted-foreground/30"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.title}</p>
                  </div>
                  <Badge variant={urgencyVariant[p.urgency]} className="shrink-0">
                    {p.urgency === "high" ? "Hoch" : p.urgency === "medium" ? "Mittel" : "Niedrig"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Letzte Aktivitaeten
            </CardTitle>
            <CardDescription>Was zuletzt passiert ist</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.action}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {a.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ideas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Ideen
            </CardTitle>
            <CardDescription>Letzte 7 Tage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentIdeas.map((idea, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 shrink-0" />
                  <p className="flex-1 text-sm">{idea.title}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{idea.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Content Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Content Status
            </CardTitle>
            <CardDescription>Naechster geplanter Post</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm font-medium">{contentStatus.title}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">{contentStatus.platform}</Badge>
                <Badge variant="warning">{contentStatus.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Geplant fuer: {contentStatus.scheduledDate}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
