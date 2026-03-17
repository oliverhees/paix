"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Zap,
  Coins,
  Wrench,
  ClipboardCopy,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunArtifact {
  id: string;
  title: string;
  artifact_type: string;
  language: string | null;
  content: string;
  created_at: string | null;
}

interface RunDetail {
  id: string;
  routine_id: string;
  status: string;
  trigger_type: string;
  resolved_prompt: string;
  result_text: string | null;
  result_summary: string | null;
  input_context: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_cents: number;
  tool_calls_count: number;
  tool_rounds: number;
  error_message: string | null;
  error_type: string | null;
  retry_count: number;
  condition_result: string | null;
  condition_reason: string | null;
  model_used: string | null;
  created_at: string;
  artifacts: RunArtifact[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatCost(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
    case "success":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "running":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "completed":
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
    default:
      return status;
  }
}

function triggerLabel(t: string): string {
  switch (t) {
    case "scheduled":
      return "Geplant";
    case "manual":
      return "Manuell";
    case "chain":
      return "Verkettung";
    case "retry":
      return "Wiederholung";
    default:
      return t;
  }
}

function conditionResultColor(result: string): string {
  switch (result) {
    case "pass":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "fail":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "skip":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function artifactTypeColor(type: string): string {
  switch (type) {
    case "code":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "markdown":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
  toast.success("In Zwischenablage kopiert");
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RunDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-md shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Prompt Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full rounded-md" />
        </CardContent>
      </Card>
      {/* Result Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-2">
          <Icon className="size-3.5 shrink-0" />
          <span>{label}</span>
        </div>
        <p className="text-xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Artifact Card ────────────────────────────────────────────────────────────

function ArtifactCard({ artifact }: { artifact: RunArtifact }) {
  const lines = artifact.content.split("\n").length;
  const isLong = lines > 20;
  const [expanded, setExpanded] = useState(!isLong);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b flex-wrap">
        <span className="text-sm font-medium flex-1 min-w-0 truncate">
          {artifact.title}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${artifactTypeColor(artifact.artifact_type)}`}
        >
          {artifact.artifact_type}
        </span>
        {artifact.language && (
          <Badge variant="outline" className="text-xs h-5 shrink-0 font-mono">
            {artifact.language}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => copyToClipboard(artifact.content)}
          aria-label="Inhalt kopieren"
        >
          <ClipboardCopy className="size-3" />
        </Button>
      </div>

      <div className="relative">
        <pre
          className={`text-xs font-mono p-4 overflow-x-auto leading-relaxed text-foreground/80 ${
            !expanded ? "max-h-48 overflow-y-hidden" : "max-h-[500px] overflow-y-auto"
          }`}
        >
          {artifact.content}
        </pre>

        {isLong && (
          <div
            className={`${
              !expanded
                ? "absolute bottom-0 left-0 right-0 pt-8 pb-2 bg-gradient-to-t from-background"
                : "border-t"
            } flex justify-center`}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3" />
                  Weniger anzeigen
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" />
                  Alles anzeigen ({lines} Zeilen)
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const routineId = params.id as string;
  const runId = params.runId as string;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInputContext, setShowInputContext] = useState(false);

  useEffect(() => {
    async function fetchRun() {
      setLoading(true);
      try {
        const data = await api.get<{ run: RunDetail }>(
          `/routines/${routineId}/runs/${runId}`
        );
        setRun(data.run);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Fehler beim Laden der Ausfuhrung.";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchRun();
  }, [routineId, runId]);

  if (loading) {
    return <RunDetailSkeleton />;
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 p-6">
        <AlertTriangle className="size-10 text-muted-foreground" />
        <p className="text-lg font-semibold">Ausfuhrung nicht gefunden</p>
        <Button
          variant="outline"
          onClick={() => router.push(`/routines/${routineId}`)}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Zuruck zum Workflow
        </Button>
      </div>
    );
  }

  const isFailed = run.status === "failed";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">

      {/* ─ Header ─ */}
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push(`/routines/${routineId}`)}
          className="shrink-0"
          aria-label="Zuruck zum Workflow"
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">
            Ausfuhrungsdetails
          </p>
          <h1 className="text-xl font-bold tracking-tight">
            Ausfuhrung vom {formatDateShort(run.started_at ?? run.created_at)}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(run.status)}`}
            >
              {statusLabel(run.status)}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              {triggerLabel(run.trigger_type)}
            </span>
          </div>
        </div>
      </div>

      {/* ─ Error Banner ─ */}
      {isFailed && run.error_message && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
          <AlertTriangle className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            {run.error_type && (
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                {run.error_type}
              </p>
            )}
            <p className="text-sm text-red-700 dark:text-red-400 font-mono break-words">
              {run.error_message}
            </p>
          </div>
        </div>
      )}

      {/* ─ Condition Check ─ */}
      {run.condition_result && (
        <Card>
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-medium">Bedingungsprufung</p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${conditionResultColor(run.condition_result)}`}
              >
                {run.condition_result === "pass"
                  ? "Bestanden"
                  : run.condition_result === "fail"
                  ? "Nicht bestanden"
                  : run.condition_result === "skip"
                  ? "Ubersprungen"
                  : run.condition_result}
              </span>
            </div>
            {run.condition_reason && (
              <p className="text-sm text-muted-foreground mt-2">
                {run.condition_reason}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─ Stat Cards ─ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Dauer"
          value={formatDuration(run.duration_ms)}
        />
        <StatCard
          icon={Zap}
          label="Tokens"
          value={run.total_tokens.toLocaleString("de-DE")}
          sub={`${run.input_tokens.toLocaleString("de-DE")} / ${run.output_tokens.toLocaleString("de-DE")}`}
        />
        <StatCard
          icon={Coins}
          label="Kosten"
          value={formatCost(run.estimated_cost_cents)}
        />
        <StatCard
          icon={Wrench}
          label="Tools"
          value={String(run.tool_calls_count)}
          sub={`${run.tool_rounds} Runde${run.tool_rounds !== 1 ? "n" : ""}`}
        />
      </div>

      {/* ─ Prompt ─ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Prompt</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => copyToClipboard(run.resolved_prompt)}
              aria-label="Prompt kopieren"
            >
              <ClipboardCopy className="size-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted/50 border overflow-hidden">
            <pre className="text-xs font-mono p-4 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto text-foreground/80">
              {run.resolved_prompt}
            </pre>
          </div>

          {run.input_context && (
            <div>
              <button
                type="button"
                onClick={() => setShowInputContext((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showInputContext ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
                Eingabekontext
              </button>
              {showInputContext && (
                <div className="mt-2 rounded-md bg-muted/50 border overflow-hidden">
                  <pre className="text-xs font-mono p-4 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto text-foreground/80">
                    {JSON.stringify(run.input_context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─ Result ─ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ergebnis</CardTitle>
            {run.result_text && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => copyToClipboard(run.result_text!)}
                aria-label="Ergebnis kopieren"
              >
                <ClipboardCopy className="size-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {run.result_text ? (
            <div className="space-y-3">
              {run.result_summary && (
                <p className="text-sm italic text-muted-foreground">
                  {run.result_summary}
                </p>
              )}
              <div className="rounded-md bg-muted/50 border overflow-hidden">
                <div className="text-sm p-4 whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                  {run.result_text}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Kein Ergebnis vorhanden
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─ Artifacts ─ */}
      {run.artifacts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Artefakte ({run.artifacts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {run.artifacts.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ─ Metadata ─ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Run-ID</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs truncate flex-1 min-w-0">
                  {run.id}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => copyToClipboard(run.id)}
                  aria-label="Run-ID kopieren"
                >
                  <ClipboardCopy className="size-3" />
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                Workflow-ID
              </p>
              <p className="font-mono text-xs truncate">{run.routine_id}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Modell</p>
              <p className="font-medium">{run.model_used ?? "—"}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Trigger</p>
              <p className="font-medium">{triggerLabel(run.trigger_type)}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Erstellt</p>
              <p className="font-medium">{formatDate(run.created_at)}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Gestartet</p>
              <p className="font-medium">{formatDate(run.started_at)}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                Abgeschlossen
              </p>
              <p className="font-medium">{formatDate(run.completed_at)}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                Wiederholungen
              </p>
              <p className="font-medium">{run.retry_count}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
