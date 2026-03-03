"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  CalendarClock,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReminderResponse {
  id: string;
  title: string;
  description: string | null;
  remind_at: string | null;
  is_recurring: boolean;
  cron_expression: string | null;
  next_run_at: string | null;
  last_triggered_at: string | null;
  is_active: boolean;
  category: string | null;
  created_at: string;
  updated_at: string;
}

type FilterTab = "active" | "all" | "expired";
type ReminderType = "once" | "recurring";
type CronPreset = "daily" | "weekdays" | "weekly" | "monthly" | "custom";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNextRun(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Date(isoDate).toLocaleString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRemindAt(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Date(isoDate).toLocaleString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeCron(cron: string | null): string {
  if (!cron) return "Einmalig";
  if (cron.match(/^\d+ \d+ \* \* \*$/)) return "Taglich";
  if (cron.includes("MON-FRI")) return "Werktags";
  if (cron.match(/^\d+ \d+ \* \* MON$/)) return "Wochentlich (Mo)";
  if (cron.match(/^\d+ \d+ 1 \* \*$/)) return "Monatlich";
  return `Cron: ${cron}`;
}

function buildCronExpression(
  preset: CronPreset,
  time: string,
  customCron: string
): string {
  const parts = time.split(":");
  const hours = parseInt(parts[0] ?? "9", 10);
  const minutes = parseInt(parts[1] ?? "0", 10);
  switch (preset) {
    case "daily":
      return `${minutes} ${hours} * * *`;
    case "weekdays":
      return `${minutes} ${hours} * * MON-FRI`;
    case "weekly":
      return `${minutes} ${hours} * * MON`;
    case "monthly":
      return `${minutes} ${hours} 1 * *`;
    case "custom":
      return customCron;
    default:
      return `${minutes} ${hours} * * *`;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  work: "Arbeit",
  personal: "Personlich",
  health: "Gesundheit",
  finance: "Finanzen",
  other: "Sonstiges",
};

const CATEGORY_COLORS: Record<string, string> = {
  work: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  personal:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  health:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  finance:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="rounded-full bg-muted p-6">
        <Bell className="size-10 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Keine Erinnerungen</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Erstelle deine erste Erinnerung oder wiederkehrende Routine, um den
          Uberblick zu behalten.
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2">
        <Plus className="size-4" />
        Erste Erinnerung erstellen
      </Button>
    </div>
  );
}

// ─── Reminder Card ────────────────────────────────────────────────────────────

function ReminderCard({
  reminder,
  onDelete,
  onSnooze,
  onToggleActive,
}: {
  reminder: ReminderResponse;
  onDelete: (id: string) => Promise<void>;
  onSnooze: (id: string) => Promise<void>;
  onToggleActive: (id: string, current: boolean) => Promise<void>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isExpired = !reminder.is_active;
  const categoryKey = reminder.category ?? "other";
  const categoryLabel = CATEGORY_LABELS[categoryKey] ?? categoryKey;
  const categoryColor =
    CATEGORY_COLORS[categoryKey] ?? CATEGORY_COLORS["other"];

  async function handleDelete() {
    setDeletingId(reminder.id);
    try {
      await onDelete(reminder.id);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSnooze() {
    setSnoozingId(reminder.id);
    try {
      await onSnooze(reminder.id);
    } finally {
      setSnoozingId(null);
    }
  }

  async function handleToggle() {
    setTogglingId(reminder.id);
    try {
      await onToggleActive(reminder.id, reminder.is_active);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <Card
      className={`transition-opacity duration-200 ${isExpired ? "opacity-60" : ""}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-semibold text-sm truncate">
              {reminder.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {reminder.is_recurring ? (
              <Badge variant="default" className="gap-1">
                <RefreshCw className="size-3" />
                Wiederkehrend
              </Badge>
            ) : (
              <Badge variant="secondary">Einmalig</Badge>
            )}
            {isExpired && <Badge variant="outline">Abgelaufen</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5">
        {reminder.description && (
          <p className="text-sm text-muted-foreground">{reminder.description}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {reminder.is_recurring && reminder.cron_expression && (
            <span className="flex items-center gap-1">
              <RefreshCw className="size-3" />
              {describeCron(reminder.cron_expression)}
            </span>
          )}
          {!reminder.is_recurring && reminder.remind_at && (
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3" />
              {formatRemindAt(reminder.remind_at)}
            </span>
          )}
          {reminder.next_run_at && (
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3" />
              Nachstes: {formatNextRun(reminder.next_run_at)}
            </span>
          )}
          {reminder.category && (
            <span
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${categoryColor}`}
            >
              <Tag className="size-3" />
              {categoryLabel}
            </span>
          )}
        </div>

        <Separator />

        <div className="flex items-center gap-2 pt-0.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={handleSnooze}
            disabled={snoozingId === reminder.id || !reminder.is_active}
          >
            <Clock className="size-3" />
            {snoozingId === reminder.id ? "..." : "Snooze 30 min"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleToggle}
            disabled={togglingId === reminder.id}
          >
            {togglingId === reminder.id
              ? "..."
              : reminder.is_active
                ? "Deaktivieren"
                : "Aktivieren"}
          </Button>

          <div className="ml-auto">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleDelete}
              disabled={deletingId === reminder.id}
            >
              <Trash2 className="size-3" />
              {deletingId === reminder.id ? "..." : "Loschen"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function ReminderSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Separator />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-20 ml-auto" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateReminderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ReminderType>("once");
  const [remindAt, setRemindAt] = useState("");
  const [cronPreset, setCronPreset] = useState<CronPreset>("daily");
  const [customCron, setCustomCron] = useState("");
  const [customTime, setCustomTime] = useState("09:00");
  const [category, setCategory] = useState("personal");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setDescription("");
    setType("once");
    setRemindAt("");
    setCronPreset("daily");
    setCustomCron("");
    setCustomTime("09:00");
    setCategory("personal");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Bitte gib einen Titel ein.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        is_recurring: type === "recurring",
        category,
      };

      if (type === "once") {
        if (!remindAt) {
          toast.error("Bitte wahle einen Datum und eine Uhrzeit.");
          setSaving(false);
          return;
        }
        body.remind_at = new Date(remindAt).toISOString();
      } else {
        body.cron_expression = buildCronExpression(
          cronPreset,
          customTime,
          customCron
        );
      }

      await api.post<ReminderResponse>("/reminders", body);
      toast.success("Erinnerung erstellt.");
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Erstellen.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Erinnerung</DialogTitle>
          <DialogDescription>
            Erstelle eine einmalige Erinnerung oder eine wiederkehrende Routine.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="reminder-title">Titel *</Label>
            <Input
              id="reminder-title"
              placeholder="z.B. Meeting-Vorbereitung"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="reminder-desc">Beschreibung (optional)</Label>
            <Textarea
              id="reminder-desc"
              placeholder="Weitere Details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Type Toggle */}
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === "once" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setType("once")}
              >
                Einmalig
              </Button>
              <Button
                type="button"
                variant={type === "recurring" ? "default" : "outline"}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setType("recurring")}
              >
                <RefreshCw className="size-3.5" />
                Wiederkehrend
              </Button>
            </div>
          </div>

          {/* Once: datetime picker */}
          {type === "once" && (
            <div className="space-y-1.5">
              <Label htmlFor="remind-at">Datum und Uhrzeit</Label>
              <Input
                id="remind-at"
                type="datetime-local"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
              />
            </div>
          )}

          {/* Recurring: preset + time */}
          {type === "recurring" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Wiederholung</Label>
                <Select
                  value={cronPreset}
                  onValueChange={(v) => setCronPreset(v as CronPreset)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Taglich</SelectItem>
                    <SelectItem value="weekdays">Werktags (Mo-Fr)</SelectItem>
                    <SelectItem value="weekly">Wochentlich (Mo)</SelectItem>
                    <SelectItem value="monthly">Monatlich (1.)</SelectItem>
                    <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {cronPreset === "custom" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="custom-cron">Cron-Expression</Label>
                  <Input
                    id="custom-cron"
                    placeholder="z.B. 0 9 * * MON"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: Minute Stunde Tag Monat Wochentag
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="custom-time">Uhrzeit</Label>
                  <Input
                    id="custom-time"
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">Arbeit</SelectItem>
                <SelectItem value="personal">Personlich</SelectItem>
                <SelectItem value="health">Gesundheit</SelectItem>
                <SelectItem value="finance">Finanzen</SelectItem>
                <SelectItem value="other">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Speichern...
                </>
              ) : (
                <>
                  <Bell className="size-3.5" />
                  Speichern
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchReminders = useCallback(async (currentFilter: FilterTab) => {
    setLoading(true);
    try {
      const activeOnly = currentFilter === "active";
      const data = await api.get<{ reminders: ReminderResponse[] }>(
        `/reminders?active_only=${activeOnly}`
      );
      setReminders(data.reminders ?? []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Laden der Erinnerungen.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders(filter);
  }, [filter, fetchReminders]);

  async function handleDelete(id: string) {
    await api.delete(`/reminders/${id}`);
    toast.success("Erinnerung geloscht.");
    await fetchReminders(filter);
  }

  async function handleSnooze(id: string) {
    await api.post(`/reminders/${id}/snooze`, { minutes: 30 });
    toast.success("Erinnerung um 30 Minuten verschoben.");
    await fetchReminders(filter);
  }

  async function handleToggleActive(id: string, current: boolean) {
    await api.put(`/reminders/${id}`, { is_active: !current });
    toast.success(current ? "Erinnerung deaktiviert." : "Erinnerung aktiviert.");
    await fetchReminders(filter);
  }

  // Client-side filter for "expired" tab (inactive reminders)
  const displayedReminders =
    filter === "expired"
      ? reminders.filter((r) => !r.is_active)
      : reminders;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Erinnerungen</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Erstelle Erinnerungen und wiederkehrende Routinen
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Neue Erinnerung</span>
              <span className="sm:hidden">Neu</span>
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterTab)}
        className="w-full"
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="active" className="flex-1 sm:flex-none">
            Aktiv
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1 sm:flex-none">
            Alle
          </TabsTrigger>
          <TabsTrigger value="expired" className="flex-1 sm:flex-none">
            Abgelaufen
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              <ReminderSkeleton />
              <ReminderSkeleton />
              <ReminderSkeleton />
            </div>
          ) : displayedReminders.length === 0 ? (
            <EmptyState onAdd={() => setDialogOpen(true)} />
          ) : (
            <div className="space-y-3">
              {displayedReminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  onDelete={handleDelete}
                  onSnooze={handleSnooze}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog rendered outside tabs to avoid nesting issues */}
      <CreateReminderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => fetchReminders(filter)}
      />
    </div>
  );
}
