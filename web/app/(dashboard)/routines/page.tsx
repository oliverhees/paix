"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Timer,
  Play,
  Pause,
  Plus,
  Trash2,
  RefreshCw,
  Brain,
  Zap,
  LayoutTemplate,
  BarChart3,
  CalendarClock,
  CheckSquare,
  Square,
  Upload,
  Download,
  Power,
  PowerOff,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Model Selector ──────────────────────────────────────────────────────────

interface ModelInfo {
  id: string;
  name: string;
  context: number;
}

type ModelsMap = Record<string, ModelInfo[]>;

const FALLBACK_MODELS: ModelsMap = {
  anthropic: [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", context: 200000 },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", context: 200000 },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", context: 200000 },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o", context: 128000 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", context: 128000 },
    { id: "o3-mini", name: "o3 Mini", context: 200000 },
  ],
  google: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", context: 1000000 },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", context: 1000000 },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", context: 2000000 },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

function formatContextSize(ctx: number): string {
  if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(ctx % 1000000 === 0 ? 0 : 1)}M`;
  return `${Math.round(ctx / 1000)}K`;
}

function useAvailableModels(): ModelsMap {
  const [models, setModels] = useState<ModelsMap>(FALLBACK_MODELS);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ModelsMap>("/chat/models")
      .then((data) => {
        if (!cancelled && data && Object.keys(data).length > 0) {
          setModels(data);
        }
      })
      .catch(() => {
        // API not available yet — keep fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return models;
}

function ModelSelector({
  value,
  onValueChange,
  models,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  models: ModelsMap;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(models).map(([provider, providerModels]) => (
          <SelectGroup key={provider}>
            <SelectLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {PROVIDER_LABELS[provider] ?? provider}
            </SelectLabel>
            {providerModels.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name} ({formatContextSize(m.context)})
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoutineResponse {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  cron_expression: string;
  cron_human: string;
  timezone: string;
  is_active: boolean;
  model: string;
  max_tokens: number;
  temperature: number;
  max_tool_rounds: number;
  timeout_seconds: number;
  retry_on_failure: boolean;
  max_retries: number;
  retry_delay_seconds: number;
  condition_prompt: string | null;
  requires_approval: boolean;
  max_cost_per_run_cents: number | null;
  monthly_budget_cents: number | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  total_runs: number;
  total_cost_cents: number;
  tags: string[];
  skill_ids: string[];
  created_at: string | null;
  updated_at: string | null;
}

type FilterTab = "active" | "all" | "inactive";
type CronPreset = "daily" | "weekdays" | "weekly" | "monthly" | "custom";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(isoDate: string | null): string {
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

function formatCostEur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
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

const RUN_STATUS_STYLES: Record<string, string> = {
  success:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  skipped:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const RUN_STATUS_LABELS: Record<string, string> = {
  success: "Erfolgreich",
  failed: "Fehlgeschlagen",
  running: "Lauft",
  skipped: "Ubersprungen",
};

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="rounded-full bg-muted p-6">
        <Timer className="size-10 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Keine Workflows</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Erstelle deinen ersten KI-Workflow, um wiederkehrende Aufgaben
          automatisch ausfuhren zu lassen.
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2">
        <Plus className="size-4" />
        Ersten Workflow erstellen
      </Button>
    </div>
  );
}

// ─── Routines Table ──────────────────────────────────────────────────────────

function RoutinesTable({
  routines,
  onDelete,
  onToggle,
  onRun,
  selectionMode,
  selectedIds,
  onSelect,
}: {
  routines: RoutineResponse[];
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string) => Promise<void>;
  onRun: (id: string) => Promise<void>;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const router = useRouter();
  const [actionId, setActionId] = useState<{ id: string; type: string } | null>(null);

  async function handleAction(id: string, type: string, fn: (id: string) => Promise<void>, e: React.MouseEvent) {
    e.stopPropagation();
    setActionId({ id, type });
    try {
      await fn(id);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionMode && <TableHead className="w-10" />}
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Zeitplan</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden md:table-cell text-right">Laeufe</TableHead>
            <TableHead className="hidden lg:table-cell text-right">Kosten</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routines.map((routine) => {
            const selected = selectedIds.has(routine.id);
            const statusStyle =
              RUN_STATUS_STYLES[routine.last_run_status ?? ""] ??
              "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
            const statusLabel =
              RUN_STATUS_LABELS[routine.last_run_status ?? ""] ?? routine.last_run_status;

            return (
              <TableRow
                key={routine.id}
                className={`cursor-pointer ${selected ? "bg-muted/50" : ""}`}
                data-state={selected ? "selected" : undefined}
                onClick={() =>
                  selectionMode
                    ? onSelect(routine.id)
                    : router.push(`/routines/${routine.id}`)
                }
              >
                {selectionMode && (
                  <TableCell>
                    <div
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(routine.id);
                      }}
                    >
                      <div
                        className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${
                          selected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-background border-muted-foreground/40 hover:border-primary"
                        }`}
                      >
                        {selected && <Check className="size-3" />}
                      </div>
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-2 rounded-full shrink-0 ${
                        routine.is_active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[200px]">{routine.name}</p>
                      {routine.tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {routine.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded px-1 py-0.5 text-[10px] bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground">{routine.cron_human}</span>
                  {routine.next_run_at && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatDate(routine.next_run_at)}
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {routine.last_run_status ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${statusStyle}`}
                    >
                      <Zap className="size-3" />
                      {statusLabel}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell text-right">
                  <span className="text-xs text-muted-foreground">{routine.total_runs}</span>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-right">
                  <span className="text-xs text-muted-foreground">
                    {routine.total_cost_cents > 0 ? formatCostEur(routine.total_cost_cents) : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={(e) => handleAction(routine.id, "run", onRun, e)}
                      disabled={actionId?.id === routine.id && actionId.type === "run"}
                      title="Jetzt ausfuehren"
                    >
                      {actionId?.id === routine.id && actionId.type === "run" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={(e) => handleAction(routine.id, "toggle", onToggle, e)}
                      disabled={actionId?.id === routine.id && actionId.type === "toggle"}
                      title={routine.is_active ? "Deaktivieren" : "Aktivieren"}
                    >
                      {actionId?.id === routine.id && actionId.type === "toggle" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : routine.is_active ? (
                        <Pause className="size-3.5" />
                      ) : (
                        <Power className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={(e) => handleAction(routine.id, "delete", onDelete, e)}
                      disabled={actionId?.id === routine.id && actionId.type === "delete"}
                      title="Loeschen"
                    >
                      {actionId?.id === routine.id && actionId.type === "delete" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function RoutineSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Zeitplan</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden md:table-cell text-right">Laeufe</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3].map((i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-3 w-24" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-5 w-20 rounded" />
              </TableCell>
              <TableCell className="hidden md:table-cell text-right">
                <Skeleton className="h-3 w-8 ml-auto" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Skeleton className="size-7 rounded" />
                  <Skeleton className="size-7 rounded" />
                  <Skeleton className="size-7 rounded" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateRoutineDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const availableModels = useAvailableModels();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cronPreset, setCronPreset] = useState<CronPreset>("daily");
  const [customCron, setCustomCron] = useState("");
  const [customTime, setCustomTime] = useState("09:00");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setName("");
    setDescription("");
    setPrompt("");
    setCronPreset("daily");
    setCustomCron("");
    setCustomTime("09:00");
    setModel("claude-sonnet-4-6");
    setTagsInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Bitte gib einen Namen ein.");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Bitte gib einen Prompt ein.");
      return;
    }
    if (cronPreset === "custom" && !customCron.trim()) {
      toast.error("Bitte gib eine Cron-Expression ein.");
      return;
    }

    const cron_expression = buildCronExpression(cronPreset, customTime, customCron);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await api.post<RoutineResponse>("/routines", {
        name: name.trim(),
        description: description.trim() || null,
        prompt: prompt.trim(),
        cron_expression,
        model,
        tags: tags.length > 0 ? tags : null,
      });
      toast.success("Workflow erstellt.");
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
          <DialogTitle>Neuer Workflow</DialogTitle>
          <DialogDescription>
            Erstelle einen KI-gesteuerten Workflow fur wiederkehrende Aufgaben.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="routine-name">Name *</Label>
            <Input
              id="routine-name"
              placeholder="z.B. Taglicher Standup-Bericht"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="routine-desc">Beschreibung (optional)</Label>
            <Textarea
              id="routine-desc"
              placeholder="Kurze Beschreibung des Workflows..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="routine-prompt">Prompt *</Label>
            <Textarea
              id="routine-prompt"
              placeholder="Was soll die KI tun?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              required
            />
          </div>

          {/* Schedule */}
          <div className="space-y-3">
            <Label>Zeitplan</Label>
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
                <Label htmlFor="routine-time">Uhrzeit</Label>
                <Input
                  id="routine-time"
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Brain className="size-3.5 text-muted-foreground" />
              KI-Modell
            </Label>
            <ModelSelector
              value={model}
              onValueChange={setModel}
              models={availableModels}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="routine-tags">Tags (optional)</Label>
            <Input
              id="routine-tags"
              placeholder="z.B. bericht, analyse, marketing"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Mehrere Tags mit Komma trennen
            </p>
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
                  <Timer className="size-3.5" />
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

// ─── Import Dialog ────────────────────────────────────────────────────────────

interface ImportedRoutine {
  name: string;
  prompt: string;
  cron_expression: string;
  [key: string]: unknown;
}

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportedRoutine[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const routines: ImportedRoutine[] = json.routines || (Array.isArray(json) ? json : [json]);
        for (const r of routines) {
          if (!r.name || !r.prompt || !r.cron_expression) {
            throw new Error(
              `Workflow "${r.name || "unbenannt"}" fehlt name, prompt oder cron_expression`
            );
          }
        }
        setPreview(routines);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Ungultiges JSON-Format";
        setError(msg);
        setPreview(null);
      }
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const result = await api.post<{ imported: number }>("/routines/import", {
        routines: preview,
      });
      toast.success(`${result.imported} Workflows importiert (inaktiv)`);
      onOpenChange(false);
      onImported();
      setFile(null);
      setPreview(null);
    } catch {
      toast.error("Fehler beim Importieren");
    } finally {
      setImporting(false);
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setFile(null);
      setPreview(null);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Workflows importieren</DialogTitle>
          <DialogDescription>
            Lade eine JSON-Datei hoch, die zuvor exportierte Workflows enthalt.
            Importierte Workflows starten inaktiv.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          {preview && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">{preview.length} Workflows gefunden:</p>
              {preview.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{r.name}</span>
                  <Badge variant="outline">{r.cron_expression}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleImport} disabled={!preview || importing}>
            {importing ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Upload className="size-4 mr-1" />
            )}
            {preview ? `${preview.length} Workflows importieren` : "Importieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutinesPage() {
  const router = useRouter();
  const [routines, setRoutines] = useState<RoutineResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const fetchRoutines = useCallback(async (currentFilter: FilterTab) => {
    setLoading(true);
    try {
      const params =
        currentFilter === "active"
          ? "?is_active=true"
          : currentFilter === "inactive"
            ? "?is_active=false"
            : "";
      const data = await api.get<{ routines: RoutineResponse[] }>(
        `/routines${params}`
      );
      setRoutines(data.routines ?? []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Laden der Workflows.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutines(filter);
  }, [filter, fetchRoutines]);

  async function handleDelete(id: string) {
    await api.delete(`/routines/${id}`);
    toast.success("Workflow geloscht.");
    await fetchRoutines(filter);
  }

  async function handleToggle(id: string) {
    const data = await api.request<{ routine: RoutineResponse }>(
      `/routines/${id}/toggle`,
      { method: "PATCH", body: JSON.stringify({}) }
    );
    const updated = data.routine;
    toast.success(updated.is_active ? "Workflow aktiviert." : "Workflow deaktiviert.");
    await fetchRoutines(filter);
  }

  async function handleRun(id: string) {
    await api.post(`/routines/${id}/run`, {});
    toast.success("Workflow gestartet.");
  }

  // ─── Selection Helpers ───

  function toggleSelectionMode() {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    } else {
      setSelectionMode(true);
    }
  }

  function handleSelectId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(routines.map((r) => r.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  // ─── Bulk Actions ───

  async function handleBulkActivate() {
    try {
      await api.post("/routines/bulk", {
        action: "activate",
        routine_ids: Array.from(selectedIds),
      });
      toast.success(`${selectedIds.size} Workflows aktiviert`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      fetchRoutines(filter);
    } catch {
      toast.error("Fehler beim Aktivieren");
    }
  }

  async function handleBulkDeactivate() {
    try {
      await api.post("/routines/bulk", {
        action: "deactivate",
        routine_ids: Array.from(selectedIds),
      });
      toast.success(`${selectedIds.size} Workflows deaktiviert`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      fetchRoutines(filter);
    } catch {
      toast.error("Fehler beim Deaktivieren");
    }
  }

  async function handleBulkDelete() {
    if (
      !window.confirm(
        `${selectedIds.size} Workflow${selectedIds.size === 1 ? "" : "s"} unwiderruflich loschen?`
      )
    ) {
      return;
    }
    try {
      await api.post("/routines/bulk", {
        action: "delete",
        routine_ids: Array.from(selectedIds),
      });
      toast.success(`${selectedIds.size} Workflows geloscht`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      fetchRoutines(filter);
    } catch {
      toast.error("Fehler beim Loschen");
    }
  }

  async function handleBulkExport() {
    try {
      const ids = Array.from(selectedIds).join(",");
      const data = await api.get(`/routines/export?ids=${ids}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `routines-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export heruntergeladen");
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch {
      toast.error("Fehler beim Exportieren");
    }
  }

  return (
    <div
      className={`flex flex-col gap-6 p-4 sm:p-6 w-full ${
        selectedIds.size > 0 ? "pb-20" : ""
      }`}
    >
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground text-sm mt-1">
            KI-gesteuerte wiederkehrende Aufgaben
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {selectionMode && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={handleSelectAll}
              >
                Alle auswahlen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={handleDeselectAll}
              >
                Auswahl aufheben
              </Button>
            </>
          )}
          <Button
            variant={selectionMode ? "default" : "outline"}
            className="gap-2"
            onClick={toggleSelectionMode}
          >
            {selectionMode ? (
              <CheckSquare className="size-4" />
            ) : (
              <Square className="size-4" />
            )}
            <span className="hidden sm:inline">Auswahlen</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-4" />
            <span className="hidden sm:inline">Importieren</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push("/routines/analytics")}
          >
            <BarChart3 className="size-4" />
            <span className="hidden sm:inline">Statistiken</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push("/routines/schedule")}
          >
            <CalendarClock className="size-4" />
            <span className="hidden sm:inline">Zeitplan</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push("/routines/templates")}
          >
            <LayoutTemplate className="size-4" />
            <span className="hidden sm:inline">Vorlagen</span>
          </Button>
          <Button
            className="gap-2"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Neuer Workflow</span>
            <span className="sm:hidden">Neu</span>
          </Button>
        </div>
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
          <TabsTrigger value="inactive" className="flex-1 sm:flex-none">
            Inaktiv
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <RoutineSkeleton />
          ) : routines.length === 0 ? (
            <EmptyState onAdd={() => setDialogOpen(true)} />
          ) : (
            <RoutinesTable
              routines={routines}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onRun={handleRun}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onSelect={handleSelectId}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs rendered outside tabs */}
      <CreateRoutineDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => fetchRoutines(filter)}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => fetchRoutines(filter)}
      />

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-3 shadow-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} ausgewahlt
            </span>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button size="sm" variant="outline" onClick={handleBulkActivate}>
                <Power className="size-4 mr-1" /> Aktivieren
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkDeactivate}>
                <PowerOff className="size-4 mr-1" /> Deaktivieren
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkExport}>
                <Download className="size-4 mr-1" /> Exportieren
              </Button>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="size-4 mr-1" /> Loschen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
