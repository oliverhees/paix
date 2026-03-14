"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  Clock,
  Coins,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  success_rate: number;
  total_tokens: number;
  total_cost_cents: number;
  avg_duration_ms: number;
}

interface DailyRun {
  date: string;
  total: number;
  success: number;
  failed: number;
}

interface RoutinePerformance {
  routine_id: string;
  routine_name: string;
  run_count: number;
  success_count: number;
  avg_duration_ms: number;
  total_tokens: number;
  total_cost_cents: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  daily_runs: DailyRun[];
  per_routine: RoutinePerformance[];
}

type SortField =
  | "routine_name"
  | "run_count"
  | "success_rate"
  | "avg_duration_ms"
  | "total_tokens"
  | "total_cost_cents";
type SortDirection = "asc" | "desc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatCost(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("de-DE");
}

function successRateColor(rate: number): string {
  if (rate >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 pb-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full rounded-md" />
        </CardContent>
      </Card>

      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
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
  valueClass,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
          <Icon className="size-4 shrink-0" />
          <span>{label}</span>
        </div>
        <p className={`text-2xl font-bold tracking-tight ${valueClass ?? ""}`}>
          {value}
        </p>
        {sub && (
          <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Daily Chart ──────────────────────────────────────────────────────────────

function DailyChart({ data }: { data: DailyRun[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Noch keine Ausführungsdaten vorhanden
      </p>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-0.5 h-48 w-full overflow-hidden">
        {data.map((day, i) => {
          const successPct = (day.success / maxTotal) * 100;
          const failedPct = (day.failed / maxTotal) * 100;
          const totalPct = successPct + failedPct;

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col-reverse min-w-0"
              style={{ height: "100%" }}
              title={`${day.date}: ${day.total} gesamt, ${day.success} erfolgreich, ${day.failed} fehlgeschlagen`}
            >
              {/* Container that aligns bars to bottom */}
              <div
                className="flex flex-col-reverse w-full"
                style={{ height: `${totalPct}%` }}
              >
                {/* Failed (top of stack = rendered first in flex-col-reverse) */}
                {day.failed > 0 && (
                  <div
                    className="w-full bg-red-400 dark:bg-red-500 rounded-t-sm"
                    style={{ height: `${(day.failed / (day.total || 1)) * 100}%` }}
                  />
                )}
                {/* Success (bottom of stack) */}
                {day.success > 0 && (
                  <div
                    className="w-full bg-emerald-500 dark:bg-emerald-400"
                    style={{ height: `${(day.success / (day.total || 1)) * 100}%` }}
                  />
                )}
              </div>
              {/* Date label every 5th day */}
              {i % 5 === 0 && (
                <div className="text-[9px] text-muted-foreground text-center leading-none mt-1 overflow-hidden whitespace-nowrap">
                  {new Date(day.date).toLocaleDateString("de-DE", {
                    day: "numeric",
                    month: "numeric",
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-emerald-500" />
          Erfolgreich
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-red-400" />
          Fehlgeschlagen
        </span>
      </div>
    </div>
  );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({
  field,
  current,
  direction,
}: {
  field: SortField;
  current: SortField;
  direction: SortDirection;
}) {
  if (field !== current) {
    return <ChevronsUpDown className="size-3 text-muted-foreground/50" />;
  }
  return direction === "asc" ? (
    <ChevronUp className="size-3 text-foreground" />
  ) : (
    <ChevronDown className="size-3 text-foreground" />
  );
}

// ─── Performance Table ────────────────────────────────────────────────────────

function PerformanceTable({ data }: { data: RoutinePerformance[] }) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>("run_count");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  const sorted = [...data].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    switch (sortField) {
      case "routine_name":
        aVal = a.routine_name.toLowerCase();
        bVal = b.routine_name.toLowerCase();
        break;
      case "success_rate":
        aVal = a.run_count > 0 ? a.success_count / a.run_count : 0;
        bVal = b.run_count > 0 ? b.success_count / b.run_count : 0;
        break;
      default:
        aVal = a[sortField] as number;
        bVal = b[sortField] as number;
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Keine Routinen vorhanden
      </p>
    );
  }

  function Th({
    field,
    children,
    align = "left",
  }: {
    field: SortField;
    children: React.ReactNode;
    align?: "left" | "right";
  }) {
    return (
      <th
        className={`px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors ${
          align === "right" ? "text-right" : "text-left"
        }`}
        onClick={() => toggleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <SortIcon field={field} current={sortField} direction={sortDirection} />
        </span>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <Th field="routine_name">Routine</Th>
            <Th field="run_count" align="right">Ausführungen</Th>
            <Th field="success_rate" align="right">Erfolgsrate</Th>
            <Th field="avg_duration_ms" align="right">Ø Dauer</Th>
            <Th field="total_tokens" align="right">Tokens</Th>
            <Th field="total_cost_cents" align="right">Kosten</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const rate =
              row.run_count > 0
                ? Math.round((row.success_count / row.run_count) * 100)
                : 0;

            return (
              <tr
                key={row.routine_id}
                className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/routines/${row.routine_id}`)}
              >
                <td className="px-3 py-3 font-medium max-w-[200px] truncate">
                  {row.routine_name}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatNumber(row.run_count)}
                </td>
                <td className={`px-3 py-3 text-right font-medium tabular-nums ${successRateColor(rate)}`}>
                  {rate} %
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {formatDuration(row.avg_duration_ms)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {formatNumber(row.total_tokens)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCost(row.total_cost_cents)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutinesAnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const data = await api.get<AnalyticsData>("/routines/analytics");
        setAnalytics(data);
      } catch {
        toast.error("Fehler beim Laden der Statistiken");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const summary = analytics?.summary;
  const successRate = summary?.success_rate ?? 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 mt-0.5"
          onClick={() => router.push("/routines")}
          aria-label="Zuruck zu Routinen"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Routine-Statistiken
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ubersicht uber Ausfuhrungen, Kosten und Performance
          </p>
        </div>
      </div>

      {loading ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Activity}
              label="Gesamte Ausfuhrungen"
              value={formatNumber(summary?.total_runs ?? 0)}
              sub={`${formatNumber(summary?.successful_runs ?? 0)} erfolgreich`}
            />
            <StatCard
              icon={CheckCircle2}
              label="Erfolgsrate"
              value={`${Math.round(successRate)} %`}
              valueClass={successRateColor(successRate)}
              sub={`${formatNumber(summary?.failed_runs ?? 0)} fehlgeschlagen`}
            />
            <StatCard
              icon={Coins}
              label="Gesamtkosten"
              value={formatCost(summary?.total_cost_cents ?? 0)}
              sub={`${formatNumber(summary?.total_tokens ?? 0)} Tokens`}
            />
            <StatCard
              icon={Clock}
              label="Ø Dauer"
              value={formatDuration(summary?.avg_duration_ms ?? 0)}
              sub="pro Ausfuhrung"
            />
          </div>

          {/* Daily Runs Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Ausfuhrungen der letzten 30 Tage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DailyChart data={analytics?.daily_runs ?? []} />
            </CardContent>
          </Card>

          {/* Per-Routine Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Performance pro Routine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceTable data={analytics?.per_routine ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
