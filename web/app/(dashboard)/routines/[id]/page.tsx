"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  Pencil,
  Trash2,
  Timer,
  Clock,
  Bot,
  Brain,
  Zap,
  RefreshCw,
  XCircle,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Tag,
  Link2,
  Globe,
  Plus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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

interface RunResponse {
  id: string;
  routine_id: string;
  status: string;
  trigger_type: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  total_tokens: number;
  estimated_cost_cents: number;
  tool_calls_count: number;
  tool_rounds: number;
  result_summary: string | null;
  error_message: string | null;
  condition_result: string | null;
  chat_session_id: string | null;
  created_at: string | null;
}

interface RunArtifact {
  id: string;
  title: string;
  artifact_type: string;
  language: string | null;
  content: string;
  created_at: string | null;
}

interface RunDetailResponse extends RunResponse {
  resolved_prompt: string;
  result_text: string | null;
  input_context: Record<string, unknown> | null;
  artifacts: RunArtifact[];
}

interface ChainResponse {
  id: string;
  source_routine_id: string;
  target_routine_id: string;
  trigger_on: string;
  pass_result: boolean;
  is_active: boolean;
  execution_order: number;
  created_at: string | null;
}

interface WebhookResponse {
  id: string;
  routine_id: string;
  url: string;
  method: string;
  trigger_on: string;
  is_active: boolean;
  created_at: string | null;
}

interface RoutineListItem {
  id: string;
  name: string;
  is_active: boolean;
}

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

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

function formatCostEur(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
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

// ─── Status Helpers ───────────────────────────────────────────────────────────

function getStatusColor(status: string): string {
  switch (status) {
    case "success":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "running":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "cancelled":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    case "skipped":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "timeout":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle className="size-3" />;
    case "failed":
      return <XCircle className="size-3" />;
    case "running":
      return <RefreshCw className="size-3 animate-spin" />;
    case "pending":
      return <Clock className="size-3" />;
    case "cancelled":
      return <XCircle className="size-3" />;
    case "timeout":
      return <Timer className="size-3" />;
    default:
      return <AlertCircle className="size-3" />;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "success":
      return "Erfolgreich";
    case "failed":
      return "Fehlgeschlagen";
    case "running":
      return "Lauft";
    case "pending":
      return "Ausstehend";
    case "cancelled":
      return "Abgebrochen";
    case "skipped":
      return "Ubersprungen";
    case "timeout":
      return "Zeituberschreitung";
    default:
      return status;
  }
}

function getTriggerLabel(trigger: string): string {
  switch (trigger) {
    case "scheduled":
      return "Geplant";
    case "manual":
      return "Manuell";
    case "chain":
      return "Verkettung";
    case "retry":
      return "Wiederholung";
    default:
      return trigger;
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-20 rounded-full ml-2" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

// ─── Edit Routine Dialog ──────────────────────────────────────────────────────

function EditRoutineDialog({
  open,
  onOpenChange,
  routine,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: RoutineResponse;
  onSaved: (updated: RoutineResponse) => void;
}) {
  const availableModels = useAvailableModels();
  const [name, setName] = useState(routine.name);
  const [description, setDescription] = useState(routine.description ?? "");
  const [prompt, setPrompt] = useState(routine.prompt);
  const [cronPreset, setCronPreset] = useState<CronPreset>("custom");
  const [customCron, setCustomCron] = useState(routine.cron_expression);
  const [customTime, setCustomTime] = useState("09:00");
  const [model, setModel] = useState(routine.model);
  const [temperature, setTemperature] = useState(
    String(routine.temperature)
  );
  const [maxTokens, setMaxTokens] = useState(String(routine.max_tokens));
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    String(routine.timeout_seconds)
  );
  const [maxToolRounds, setMaxToolRounds] = useState(
    String(routine.max_tool_rounds)
  );
  const [retryOnFailure, setRetryOnFailure] = useState(
    routine.retry_on_failure
  );
  const [maxRetries, setMaxRetries] = useState(String(routine.max_retries));
  const [conditionPrompt, setConditionPrompt] = useState(
    routine.condition_prompt ?? ""
  );
  const [requiresApproval, setRequiresApproval] = useState(
    routine.requires_approval
  );
  const [maxCostPerRun, setMaxCostPerRun] = useState(
    routine.max_cost_per_run_cents !== null
      ? String(routine.max_cost_per_run_cents)
      : ""
  );
  const [monthlyBudget, setMonthlyBudget] = useState(
    routine.monthly_budget_cents !== null
      ? String(routine.monthly_budget_cents)
      : ""
  );
  const [systemPromptOverride, setSystemPromptOverride] = useState("");
  const [tags, setTags] = useState(routine.tags.join(", "));
  const [saving, setSaving] = useState(false);

  // Re-sync form when routine prop changes
  useEffect(() => {
    setName(routine.name);
    setDescription(routine.description ?? "");
    setPrompt(routine.prompt);
    setCronPreset("custom");
    setCustomCron(routine.cron_expression);
    setModel(routine.model);
    setTemperature(String(routine.temperature));
    setMaxTokens(String(routine.max_tokens));
    setTimeoutSeconds(String(routine.timeout_seconds));
    setMaxToolRounds(String(routine.max_tool_rounds));
    setRetryOnFailure(routine.retry_on_failure);
    setMaxRetries(String(routine.max_retries));
    setConditionPrompt(routine.condition_prompt ?? "");
    setRequiresApproval(routine.requires_approval);
    setMaxCostPerRun(
      routine.max_cost_per_run_cents !== null
        ? String(routine.max_cost_per_run_cents)
        : ""
    );
    setMonthlyBudget(
      routine.monthly_budget_cents !== null
        ? String(routine.monthly_budget_cents)
        : ""
    );
    setSystemPromptOverride("");
    setTags(routine.tags.join(", "));
  }, [routine]);

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

    setSaving(true);
    try {
      const resolvedCron =
        cronPreset === "custom"
          ? customCron
          : buildCronExpression(cronPreset, customTime, customCron);

      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        prompt: prompt.trim(),
        cron_expression: resolvedCron,
        model,
        temperature: parseFloat(temperature) || 0.7,
        max_tokens: parseInt(maxTokens) || 4096,
        timeout_seconds: parseInt(timeoutSeconds) || 300,
        max_tool_rounds: parseInt(maxToolRounds) || 10,
        retry_on_failure: retryOnFailure,
        max_retries: parseInt(maxRetries) || 3,
        condition_prompt: conditionPrompt.trim() || null,
        requires_approval: requiresApproval,
        max_cost_per_run_cents: maxCostPerRun
          ? parseInt(maxCostPerRun)
          : null,
        monthly_budget_cents: monthlyBudget
          ? parseInt(monthlyBudget)
          : null,
        system_prompt_override: systemPromptOverride.trim() || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };

      const data = await api.put<{ routine: RoutineResponse }>(
        `/routines/${routine.id}`,
        body
      );
      toast.success("Routine gespeichert.");
      onSaved(data.routine);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Speichern.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Routine bearbeiten</DialogTitle>
          <DialogDescription>
            Alle Felder der Routine anpassen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              placeholder="z.B. Taglicher Report"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Beschreibung (optional)</Label>
            <Textarea
              id="edit-desc"
              placeholder="Kurze Beschreibung..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-prompt">Prompt *</Label>
            <Textarea
              id="edit-prompt"
              placeholder="Was soll die KI tun?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              required
            />
          </div>

          <Separator />

          {/* Cron */}
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
                <Label htmlFor="edit-cron">Cron-Expression</Label>
                <Input
                  id="edit-cron"
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
                <Label htmlFor="edit-time">Uhrzeit</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Model */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-model" className="flex items-center gap-1.5">
              <Brain className="size-3.5 text-muted-foreground" />
              KI-Modell
            </Label>
            <ModelSelector
              id="edit-model"
              value={model}
              onValueChange={setModel}
              models={availableModels}
            />
          </div>

          {/* Temperature + Max Tokens row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-temp">Temperatur (0.0 – 1.0)</Label>
              <Input
                id="edit-temp"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tokens">Max. Tokens</Label>
              <Input
                id="edit-tokens"
                type="number"
                min="1"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
              />
            </div>
          </div>

          {/* Timeout + Max Tool Rounds row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-timeout">Timeout (Sekunden)</Label>
              <Input
                id="edit-timeout"
                type="number"
                min="1"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-rounds">Max. Tool-Runden</Label>
              <Input
                id="edit-rounds"
                type="number"
                min="1"
                value={maxToolRounds}
                onChange={(e) => setMaxToolRounds(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Retry */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Wiederholung bei Fehler</Label>
              <p className="text-xs text-muted-foreground">
                Routine bei Fehler automatisch wiederholen
              </p>
            </div>
            <Switch
              checked={retryOnFailure}
              onCheckedChange={setRetryOnFailure}
            />
          </div>

          {retryOnFailure && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-retries">Max. Wiederholungen</Label>
              <Input
                id="edit-retries"
                type="number"
                min="1"
                max="10"
                value={maxRetries}
                onChange={(e) => setMaxRetries(e.target.value)}
              />
            </div>
          )}

          {/* Requires Approval */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Genehmigung erforderlich</Label>
              <p className="text-xs text-muted-foreground">
                Vor der Ausfuhrung muss eine Genehmigung eingeholt werden
              </p>
            </div>
            <Switch
              checked={requiresApproval}
              onCheckedChange={setRequiresApproval}
            />
          </div>

          <Separator />

          {/* Condition Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-condition">Bedingungsprompt (optional)</Label>
            <Textarea
              id="edit-condition"
              placeholder="Nur ausfuhren wenn... (wird als Ja/Nein-Frage ausgewertet)"
              value={conditionPrompt}
              onChange={(e) => setConditionPrompt(e.target.value)}
              rows={2}
            />
          </div>

          {/* System Prompt Override */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-system">
              System-Prompt-Uberschreibung (optional)
            </Label>
            <Textarea
              id="edit-system"
              placeholder="Uberschreibt den Standard-System-Prompt..."
              value={systemPromptOverride}
              onChange={(e) => setSystemPromptOverride(e.target.value)}
              rows={2}
            />
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cost">Max. Kosten/Lauf (Cent)</Label>
              <Input
                id="edit-cost"
                type="number"
                min="0"
                placeholder="z.B. 100"
                value={maxCostPerRun}
                onChange={(e) => setMaxCostPerRun(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-budget">Monatsbudget (Cent)</Label>
              <Input
                id="edit-budget"
                type="number"
                min="0"
                placeholder="z.B. 5000"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-tags">Tags (kommagetrennt)</Label>
            <Input
              id="edit-tags"
              placeholder="z.B. report, taglich, work"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
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
                  <Pencil className="size-3.5" />
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

// ─── Run Row ──────────────────────────────────────────────────────────────────

function RunRow({
  run,
  routineId,
  onRefresh,
}: {
  run: RunResponse;
  routineId: string;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<RunDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function handleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (detail) return;
    setLoadingDetail(true);
    try {
      const data = await api.get<{ run: RunDetailResponse }>(
        `/routines/${routineId}/runs/${run.id}`
      );
      setDetail(data.run);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Laden der Details.";
      toast.error(msg);
      setExpanded(false);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.post(`/routines/${routineId}/runs/${run.id}/cancel`, {});
      toast.success("Ausfuhrung abgebrochen.");
      onRefresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Abbrechen.";
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      await api.post(`/routines/${routineId}/runs/${run.id}/retry`, {});
      toast.success("Wiederholung gestartet.");
      onRefresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Wiederholen.";
      toast.error(msg);
    } finally {
      setRetrying(false);
    }
  }

  const canCancel = run.status === "pending" || run.status === "running";
  const canRetry = run.status === "failed";

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={handleExpand}
        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}
          >
            {getStatusIcon(run.status)}
            {getStatusLabel(run.status)}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {getTriggerLabel(run.trigger_type)}
          </span>

          <span className="text-xs text-muted-foreground">
            {formatDate(run.started_at)}
          </span>

          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Timer className="size-3" />
              {formatDuration(run.duration_ms)}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="size-3" />
              {run.total_tokens.toLocaleString("de-DE")} Tokens
            </span>
            <span className="flex items-center gap-1">
              {formatCostEur(run.estimated_cost_cents)}
            </span>
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </div>
        </div>

        {run.result_summary && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
            {run.result_summary}
          </p>
        )}
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
          {loadingDetail ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : detail ? (
            <>
              {detail.error_message && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">
                    Fehler
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400 font-mono">
                    {detail.error_message}
                  </p>
                </div>
              )}

              {detail.result_text && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ergebnis
                  </p>
                  <div className="rounded-md bg-background border p-3 max-h-48 overflow-y-auto">
                    <p className="text-xs whitespace-pre-wrap">
                      {detail.result_text}
                    </p>
                  </div>
                </div>
              )}

              {detail.artifacts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Artefakte ({detail.artifacts.length})
                  </p>
                  <div className="space-y-2">
                    {detail.artifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        className="rounded-md bg-background border p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium">
                            {artifact.title}
                          </span>
                          <Badge variant="outline" className="text-xs h-4">
                            {artifact.artifact_type}
                            {artifact.language ? ` / ${artifact.language}` : ""}
                          </Badge>
                        </div>
                        <pre className="text-xs text-muted-foreground overflow-x-auto max-h-32 overflow-y-auto">
                          {artifact.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.condition_result && (
                <p className="text-xs text-muted-foreground">
                  Bedingung: {detail.condition_result}
                </p>
              )}
            </>
          ) : null}

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() =>
                router.push(`/routines/${routineId}/runs/${run.id}`)
              }
            >
              <ExternalLink className="size-3" />
              Details anzeigen
            </Button>

            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleCancel}
                disabled={cancelling}
              >
                <XCircle className="size-3" />
                {cancelling ? "..." : "Abbrechen"}
              </Button>
            )}
            {canRetry && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleRetry}
                disabled={retrying}
              >
                <RefreshCw className="size-3" />
                {retrying ? "..." : "Wiederholen"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Chain Dialog ─────────────────────────────────────────────────────────

function AddChainDialog({
  open,
  onOpenChange,
  routineId,
  allRoutines,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routineId: string;
  allRoutines: RoutineListItem[];
  onSaved: () => void;
}) {
  const [targetRoutineId, setTargetRoutineId] = useState("");
  const [triggerOn, setTriggerOn] = useState<"success" | "failure" | "always">("success");
  const [passResult, setPassResult] = useState(true);
  const [executionOrder, setExecutionOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  const availableRoutines = allRoutines.filter((r) => r.id !== routineId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetRoutineId) {
      toast.error("Bitte wahle eine Ziel-Routine.");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/routines/${routineId}/chains`, {
        target_routine_id: targetRoutineId,
        trigger_on: triggerOn,
        pass_result: passResult,
        execution_order: parseInt(executionOrder) || 0,
      });
      toast.success("Verkettung hinzugefugt.");
      setTargetRoutineId("");
      setTriggerOn("success");
      setPassResult(true);
      setExecutionOrder("0");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Hinzufugen.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Verkettung hinzufugen</DialogTitle>
          <DialogDescription>
            Verkette diese Routine mit einer anderen Routine.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ziel-Routine</Label>
            <Select value={targetRoutineId} onValueChange={setTargetRoutineId}>
              <SelectTrigger>
                <SelectValue placeholder="Routine auswahlen..." />
              </SelectTrigger>
              <SelectContent>
                {availableRoutines.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    Keine weiteren Routinen vorhanden
                  </SelectItem>
                ) : (
                  availableRoutines.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Auslosen bei</Label>
            <Select
              value={triggerOn}
              onValueChange={(v) => setTriggerOn(v as "success" | "failure" | "always")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Erfolg</SelectItem>
                <SelectItem value="failure">Fehler</SelectItem>
                <SelectItem value="always">Immer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ergebnis weitergeben</Label>
              <p className="text-xs text-muted-foreground">
                Ergebnis dieser Routine an Ziel-Routine ubergeben
              </p>
            </div>
            <Switch checked={passResult} onCheckedChange={setPassResult} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chain-order">Ausfuhrungsreihenfolge</Label>
            <Input
              id="chain-order"
              type="number"
              min="0"
              value={executionOrder}
              onChange={(e) => setExecutionOrder(e.target.value)}
            />
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
                  <Plus className="size-3.5" />
                  Hinzufugen
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Webhook Dialog ───────────────────────────────────────────────────────

function AddWebhookDialog({
  open,
  onOpenChange,
  routineId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routineId: string;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"POST" | "GET" | "PUT">("POST");
  const [triggerOn, setTriggerOn] = useState<"success" | "failure" | "always">("success");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Bitte gib eine URL ein.");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/routines/${routineId}/webhooks`, {
        url: url.trim(),
        method,
        trigger_on: triggerOn,
        secret: secret.trim() || undefined,
      });
      toast.success("Webhook hinzugefugt.");
      setUrl("");
      setMethod("POST");
      setTriggerOn("success");
      setSecret("");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Hinzufugen.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Webhook hinzufugen</DialogTitle>
          <DialogDescription>
            Sende einen HTTP-Request wenn diese Routine ausgefuhrt wird.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">URL *</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://example.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Methode</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as "POST" | "GET" | "PUT")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Auslosen bei</Label>
            <Select
              value={triggerOn}
              onValueChange={(v) => setTriggerOn(v as "success" | "failure" | "always")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Erfolg</SelectItem>
                <SelectItem value="failure">Fehler</SelectItem>
                <SelectItem value="always">Immer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="webhook-secret">Secret (optional)</Label>
            <Input
              id="webhook-secret"
              type="password"
              placeholder="HMAC-Signing-Secret..."
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
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
                  <Plus className="size-3.5" />
                  Hinzufugen
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

export default function RoutineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const routineId = params.id as string;

  const [routine, setRoutine] = useState<RoutineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunResponse[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsOffset, setRunsOffset] = useState(0);
  const RUNS_LIMIT = 10;

  const [chains, setChains] = useState<ChainResponse[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookResponse[]>([]);
  const [allRoutines, setAllRoutines] = useState<RoutineListItem[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addChainOpen, setAddChainOpen] = useState(false);
  const [addWebhookOpen, setAddWebhookOpen] = useState(false);

  const [toggling, setToggling] = useState(false);
  const [deletingChainId, setDeletingChainId] = useState<string | null>(null);
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingModel, setUpdatingModel] = useState(false);
  const availableModels = useAvailableModels();

  // ─ Fetch routine ─

  const fetchRoutine = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ routine: RoutineResponse }>(
        `/routines/${routineId}`
      );
      setRoutine(data.routine);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Laden der Routine.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  // ─ Fetch runs ─

  const fetchRuns = useCallback(
    async (offset: number, append = false) => {
      setRunsLoading(true);
      try {
        const data = await api.get<{
          runs: RunResponse[];
          total: number;
          limit: number;
          offset: number;
        }>(
          `/routines/${routineId}/runs?limit=${RUNS_LIMIT}&offset=${offset}`
        );
        setRunsTotal(data.total);
        if (append) {
          setRuns((prev) => [...prev, ...data.runs]);
        } else {
          setRuns(data.runs);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Fehler beim Laden der Laufe.";
        toast.error(msg);
      } finally {
        setRunsLoading(false);
      }
    },
    [routineId]
  );

  const fetchChains = useCallback(async () => {
    try {
      const data = await api.get<{ chains: ChainResponse[]; total: number }>(
        `/routines/${routineId}/chains`
      );
      setChains(data.chains);
    } catch {
      // silently ignore — non-critical
    }
  }, [routineId]);

  const fetchWebhooks = useCallback(async () => {
    try {
      const data = await api.get<{ webhooks: WebhookResponse[]; total: number }>(
        `/routines/${routineId}/webhooks`
      );
      setWebhooks(data.webhooks);
    } catch {
      // silently ignore — non-critical
    }
  }, [routineId]);

  const fetchAllRoutines = useCallback(async () => {
    try {
      const data = await api.get<{ routines: RoutineListItem[]; total: number }>(
        `/routines`
      );
      setAllRoutines(data.routines);
    } catch {
      // silently ignore — non-critical
    }
  }, []);

  useEffect(() => {
    fetchRoutine();
    fetchRuns(0, false);
    fetchChains();
    fetchWebhooks();
    fetchAllRoutines();
  }, [fetchRoutine, fetchRuns, fetchChains, fetchWebhooks, fetchAllRoutines]);

  // ─ Actions ─

  async function handleToggle() {
    if (!routine) return;
    setToggling(true);
    try {
      const data = await api.request<{ routine: RoutineResponse }>(
        `/routines/${routineId}/toggle`,
        { method: "PATCH" }
      );
      setRoutine(data.routine);
      toast.success(
        data.routine.is_active
          ? "Routine aktiviert."
          : "Routine deaktiviert."
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Umschalten.";
      toast.error(msg);
    } finally {
      setToggling(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      await api.post(`/routines/${routineId}/run`, {});
      toast.success("Ausfuhrung gestartet.");
      // Refresh runs after a short delay
      setTimeout(() => {
        setRunsOffset(0);
        fetchRuns(0, false);
      }, 1500);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Starten.";
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/routines/${routineId}`);
      toast.success("Routine geloscht.");
      router.push("/routines");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Loschen.";
      toast.error(msg);
      setDeleting(false);
    }
  }

  async function handleLoadMoreRuns() {
    const newOffset = runsOffset + RUNS_LIMIT;
    setRunsOffset(newOffset);
    await fetchRuns(newOffset, true);
  }

  function handleRoutineSaved(updated: RoutineResponse) {
    setRoutine(updated);
  }

  async function handleDeleteChain(chainId: string) {
    setDeletingChainId(chainId);
    try {
      await api.delete(`/routines/chains/${chainId}`);
      toast.success("Verkettung entfernt.");
      setChains((prev) => prev.filter((c) => c.id !== chainId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Entfernen.";
      toast.error(msg);
    } finally {
      setDeletingChainId(null);
    }
  }

  async function handleDeleteWebhook(webhookId: string) {
    setDeletingWebhookId(webhookId);
    try {
      await api.delete(`/routines/webhooks/${webhookId}`);
      toast.success("Webhook entfernt.");
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Entfernen.";
      toast.error(msg);
    } finally {
      setDeletingWebhookId(null);
    }
  }

  async function handleModelChange(newModel: string) {
    if (!routine || newModel === routine.model) return;
    setUpdatingModel(true);
    try {
      await api.request(`/routines/${routine.id}`, {
        method: "PATCH",
        body: JSON.stringify({ model: newModel }),
      });
      setRoutine((prev) => (prev ? { ...prev, model: newModel } : prev));
      toast.success("Modell aktualisiert");
    } catch {
      // PATCH may not exist — fall back to PUT with full body
      try {
        const data = await api.put<{ routine: RoutineResponse }>(
          `/routines/${routine.id}`,
          { ...routine, model: newModel }
        );
        setRoutine(data.routine);
        toast.success("Modell aktualisiert");
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Fehler beim Aktualisieren.";
        toast.error(msg);
      }
    } finally {
      setUpdatingModel(false);
    }
  }

  // ─ Render ─

  if (loading) {
    return <PageSkeleton />;
  }

  if (!routine) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 p-6">
        <AlertCircle className="size-10 text-muted-foreground" />
        <p className="text-lg font-semibold">Routine nicht gefunden</p>
        <Button
          variant="outline"
          onClick={() => router.push("/routines")}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Zuruck zur Ubersicht
        </Button>
      </div>
    );
  }

  const hasMoreRuns = runs.length < runsTotal;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto w-full">

      {/* ─ Top: Back + Title + Status ─ */}
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push("/routines")}
          className="shrink-0"
          aria-label="Zuruck"
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {routine.name}
            </h1>
            {routine.is_active ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-0">
                Aktiv
              </Badge>
            ) : (
              <Badge variant="secondary">Inaktiv</Badge>
            )}
          </div>
          {routine.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {routine.description}
            </p>
          )}
        </div>
      </div>

      {/* ─ Action Buttons ─ */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-3.5" />
          Bearbeiten
        </Button>

        <Button
          variant="default"
          size="sm"
          className="gap-1.5"
          onClick={handleRun}
          disabled={running}
        >
          {running ? (
            <>
              <RefreshCw className="size-3.5 animate-spin" />
              Startet...
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              Jetzt ausfuhren
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleToggle}
          disabled={toggling}
        >
          {toggling ? (
            <RefreshCw className="size-3.5 animate-spin" />
          ) : routine.is_active ? (
            <>
              <Pause className="size-3.5" />
              Deaktivieren
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              Aktivieren
            </>
          )}
        </Button>

        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5 ml-auto"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5" />
          Loschen
        </Button>
      </div>

      {/* ─ Stat Cards ─ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Next Run */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Nachster Lauf
              </p>
            </div>
            <p className="text-sm font-semibold leading-snug">
              {formatDate(routine.next_run_at)}
            </p>
          </CardContent>
        </Card>

        {/* Last Run */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Timer className="size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Letzter Lauf
              </p>
            </div>
            <p className="text-sm font-semibold leading-snug">
              {formatDate(routine.last_run_at)}
            </p>
            {routine.last_run_status && (
              <span
                className={`inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(routine.last_run_status)}`}
              >
                {getStatusIcon(routine.last_run_status)}
                {getStatusLabel(routine.last_run_status)}
              </span>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Bot className="size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Statistik
              </p>
            </div>
            <p className="text-sm font-semibold">
              {routine.total_runs} Ausfuhrungen
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCostEur(routine.total_cost_cents)} Gesamtkosten
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─ Configuration ─ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Konfiguration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Prompt */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Bot className="size-3.5 text-muted-foreground" />
              Prompt
            </p>
            <div className="rounded-md bg-muted/50 border p-3 max-h-48 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {routine.prompt}
              </pre>
            </div>
          </div>

          <Separator />

          {/* Schedule */}
          <div className="space-y-1">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              Zeitplan
            </p>
            <p className="text-sm">{routine.cron_human}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {routine.cron_expression}
            </p>
            <p className="text-xs text-muted-foreground">
              Zeitzone: {routine.timezone}
            </p>
          </div>

          <Separator />

          {/* Model Selector */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Brain className="size-3.5 text-muted-foreground" />
              KI-Modell
            </p>
            <div className="max-w-xs">
              <ModelSelector
                value={routine.model}
                onValueChange={handleModelChange}
                models={availableModels}
              />
              {updatingModel && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <RefreshCw className="size-3 animate-spin" />
                  Aktualisiere...
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Params */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Temperatur</p>
              <p className="font-medium">{routine.temperature}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Max. Tokens</p>
              <p className="font-medium">
                {routine.max_tokens.toLocaleString("de-DE")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Timeout</p>
              <p className="font-medium">{routine.timeout_seconds}s</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Tool-Runden</p>
              <p className="font-medium">{routine.max_tool_rounds}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Wiederholung</p>
              <p className="font-medium">
                {routine.retry_on_failure
                  ? `Ja (${routine.max_retries}x)`
                  : "Nein"}
              </p>
            </div>
            {routine.max_cost_per_run_cents !== null && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Max. Kosten/Lauf
                </p>
                <p className="font-medium">
                  {formatCostEur(routine.max_cost_per_run_cents)}
                </p>
              </div>
            )}
            {routine.monthly_budget_cents !== null && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Monatsbudget
                </p>
                <p className="font-medium">
                  {formatCostEur(routine.monthly_budget_cents)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Genehmigung</p>
              <p className="font-medium">
                {routine.requires_approval ? "Erforderlich" : "Nicht notig"}
              </p>
            </div>
          </div>

          {/* Condition Prompt */}
          {routine.condition_prompt && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Bedingungsprompt</p>
                <div className="rounded-md bg-muted/50 border p-3">
                  <p className="text-xs text-muted-foreground">
                    {routine.condition_prompt}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Tags */}
          {routine.tags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Tag className="size-3.5 text-muted-foreground" />
                  Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {routine.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─ Run History ─ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ausfuhrungs-Verlauf</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                setRunsOffset(0);
                fetchRuns(0, false);
              }}
              disabled={runsLoading}
            >
              <RefreshCw
                className={`size-3 ${runsLoading ? "animate-spin" : ""}`}
              />
              Aktualisieren
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {runsLoading && runs.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <Zap className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Noch keine Ausfuhrungen</p>
              <p className="text-xs text-muted-foreground">
                Starte die Routine manuell oder warte auf den nachsten geplanten
                Lauf.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {runs.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    routineId={routineId}
                    onRefresh={() => {
                      setRunsOffset(0);
                      fetchRuns(0, false);
                    }}
                  />
                ))}
              </div>

              {hasMoreRuns && (
                <div className="pt-2 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleLoadMoreRuns}
                    disabled={runsLoading}
                  >
                    {runsLoading ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        Laden...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3.5" />
                        Mehr laden ({runsTotal - runs.length} weitere)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─ Verkettungen ─ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="size-4 text-muted-foreground" />
              Verkettungen
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setAddChainOpen(true)}
            >
              <Plus className="size-3" />
              Verkettung hinzufugen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {chains.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Link2 className="size-7 text-muted-foreground" />
              <p className="text-sm font-medium">Keine Verkettungen konfiguriert</p>
              <p className="text-xs text-muted-foreground">
                Verkette Routinen um automatische Workflows zu erstellen.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {chains.map((chain) => {
                const targetName =
                  allRoutines.find((r) => r.id === chain.target_routine_id)?.name ??
                  chain.target_routine_id;
                const triggerColor =
                  chain.trigger_on === "success"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                    : chain.trigger_on === "failure"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
                const triggerLabel =
                  chain.trigger_on === "success"
                    ? "Erfolg"
                    : chain.trigger_on === "failure"
                    ? "Fehler"
                    : "Immer";
                return (
                  <div
                    key={chain.id}
                    className="flex items-center gap-3 border rounded-lg px-3 py-2.5 flex-wrap"
                  >
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {routine.name}
                    </span>
                    <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate flex-1 min-w-0">
                      {targetName}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${triggerColor}`}
                    >
                      {triggerLabel}
                    </span>
                    {chain.pass_result && (
                      <Badge variant="outline" className="text-xs h-5 shrink-0">
                        Ergebnis
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteChain(chain.id)}
                      disabled={deletingChainId === chain.id}
                      aria-label="Verkettung entfernen"
                    >
                      {deletingChainId === chain.id ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─ Webhooks ─ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              Webhooks
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setAddWebhookOpen(true)}
            >
              <Plus className="size-3" />
              Webhook hinzufugen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {webhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Globe className="size-7 text-muted-foreground" />
              <p className="text-sm font-medium">Keine Webhooks konfiguriert</p>
              <p className="text-xs text-muted-foreground">
                Webhooks senden HTTP-Requests bei Routine-Ausfuhrungen.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {webhooks.map((webhook) => {
                const triggerColor =
                  webhook.trigger_on === "success"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                    : webhook.trigger_on === "failure"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
                const triggerLabel =
                  webhook.trigger_on === "success"
                    ? "Erfolg"
                    : webhook.trigger_on === "failure"
                    ? "Fehler"
                    : "Immer";
                return (
                  <div
                    key={webhook.id}
                    className="flex items-center gap-3 border rounded-lg px-3 py-2.5 flex-wrap"
                  >
                    <span className="text-xs font-medium truncate max-w-xs flex-1 min-w-0">
                      {webhook.url}
                    </span>
                    <Badge variant="outline" className="text-xs h-5 shrink-0 font-mono">
                      {webhook.method}
                    </Badge>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${triggerColor}`}
                    >
                      {triggerLabel}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      disabled={deletingWebhookId === webhook.id}
                      aria-label="Webhook entfernen"
                    >
                      {deletingWebhookId === webhook.id ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─ Add Chain Dialog ─ */}
      <AddChainDialog
        open={addChainOpen}
        onOpenChange={setAddChainOpen}
        routineId={routineId}
        allRoutines={allRoutines}
        onSaved={fetchChains}
      />

      {/* ─ Add Webhook Dialog ─ */}
      <AddWebhookDialog
        open={addWebhookOpen}
        onOpenChange={setAddWebhookOpen}
        routineId={routineId}
        onSaved={fetchWebhooks}
      />

      {/* ─ Edit Dialog ─ */}
      {editOpen && (
        <EditRoutineDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          routine={routine}
          onSaved={handleRoutineSaved}
        />
      )}

      {/* ─ Delete Confirmation ─ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Routine loschen?</DialogTitle>
            <DialogDescription>
              Die Routine <strong>{routine.name}</strong> und alle zugehorigen
              Ausfuhrungs-Protokolle werden dauerhaft geloscht. Diese Aktion
              kann nicht ruckgangig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Loschen...
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  Loschen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
