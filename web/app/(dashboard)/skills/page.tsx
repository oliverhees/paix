"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Zap,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Loader2,
  ScrollText,
  Settings2,
  Plus,
  Trash2,
  Wrench,
  Sparkles,
  Send,
  RotateCcw,
  Bot,
  User,
  FileText,
  Eye,
  Code2,
  Save,
  Library,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  Check,
  Info,
  History,
  AlertCircle,
  MessageSquare,
  CalendarClock,
  Timer,
  BarChart3,
  TrendingUp,
  Activity,
  FolderOpen,
  Link2,
  ArrowRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  settingsService,
  type SkillItem,
  type SkillDetail,
  type SkillLogEntry,
  type SkillParameterDef,
  type SkillToolCall,
  type SkillFile,
  type McpServer,
  type SkillCreateRequest,
  type SkillGenerateMessage,
  type SkillGenerateResponse,
  type SkillExecutionEntry,
  type SkillAnalytics,
} from "@/lib/settings-service";
import {
  SKILL_PRESETS,
  SKILL_CATEGORIES,
  type SkillPreset,
} from "@/lib/skill-presets";

// ─── Category Labels (German) ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  productivity: "Produktivitaet",
  writing: "Schreiben",
  communication: "Kommunikation",
  creativity: "Kreativitaet",
  research: "Recherche",
  automation: "Automatisierung",
  analytics: "Analytik",
  "": "Allgemein",
};

const ALL_CATEGORIES = [
  { key: "", label: "Alle" },
  { key: "productivity", label: "Produktivitaet" },
  { key: "writing", label: "Schreiben" },
  { key: "communication", label: "Kommunikation" },
  { key: "creativity", label: "Kreativitaet" },
  { key: "research", label: "Recherche" },
  { key: "automation", label: "Automatisierung" },
  { key: "analytics", label: "Analytik" },
];

// ─── Simple Markdown Renderer ────────────────────────────────────────────────

function renderMarkdownToHtml(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="bg-zinc-900 border border-zinc-800 rounded-lg p-3 overflow-x-auto my-3"><code class="text-xs font-mono text-zinc-300">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold mt-4 mb-1 text-foreground">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2 text-foreground">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2 text-foreground">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-5 mb-2 text-foreground">$1</h1>');

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-muted-foreground">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm text-muted-foreground">$1</li>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-4 border-zinc-800" />');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p class="text-sm text-muted-foreground mb-2">');

  // Single newlines -> <br>
  html = html.replace(/\n/g, "<br />");

  return `<div class="space-y-1"><p class="text-sm text-muted-foreground mb-2">${html}</p></div>`;
}

// ─── SKILL.md Generator ──────────────────────────────────────────────────────

function generateSkillMd(
  name: string,
  description: string,
  instructions: string,
  params: ParamDraft[]
): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`name: "${name}"`);
  lines.push(`description: "${description}"`);
  if (params.length > 0) {
    lines.push("parameters:");
    for (const p of params) {
      if (!p.key.trim()) continue;
      lines.push(`  ${p.key}:`);
      lines.push(`    type: "${p.type}"`);
      lines.push(`    required: ${p.required}`);
      lines.push(`    description: "${p.description}"`);
    }
  }
  lines.push("---");
  lines.push("");
  if (instructions.trim()) {
    lines.push(instructions.trim());
  } else {
    lines.push("# " + name);
    lines.push("");
    lines.push(description);
  }
  lines.push("");
  return lines.join("\n");
}

// ─── SKILL.md Parser ─────────────────────────────────────────────────────────

function parseSkillMd(skillMd: string): {
  name: string;
  description: string;
  instructions: string;
  params: ParamDraft[];
} {
  const result = {
    name: "",
    description: "",
    instructions: "",
    params: [] as ParamDraft[],
  };

  if (!skillMd) return result;

  const fmMatch = skillMd.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    result.instructions = skillMd;
    return result;
  }

  const frontmatter = fmMatch[1];
  result.instructions = fmMatch[2].trim();

  // Parse name
  const nameMatch = frontmatter.match(/^name:\s*"?([^"\n]+)"?/m);
  if (nameMatch) result.name = nameMatch[1].trim();

  // Parse description
  const descMatch = frontmatter.match(/^description:\s*"?([^"\n]+)"?/m);
  if (descMatch) result.description = descMatch[1].trim();

  // Parse parameters
  const paramSection = frontmatter.match(/parameters:\n([\s\S]*?)(?=\n\w|$)/);
  if (paramSection) {
    const paramLines = paramSection[1].split("\n");
    let currentParam: ParamDraft | null = null;
    for (const line of paramLines) {
      const keyMatch = line.match(/^\s{2}(\w+):\s*$/);
      if (keyMatch) {
        if (currentParam) result.params.push(currentParam);
        currentParam = { key: keyMatch[1], type: "string", required: false, description: "" };
        continue;
      }
      if (currentParam) {
        const typeMatch = line.match(/^\s{4}type:\s*"?(\w+)"?/);
        if (typeMatch) currentParam.type = typeMatch[1];
        const reqMatch = line.match(/^\s{4}required:\s*(true|false)/);
        if (reqMatch) currentParam.required = reqMatch[1] === "true";
        const descMatch2 = line.match(/^\s{4}description:\s*"?([^"]*)"?/);
        if (descMatch2) currentParam.description = descMatch2[1];
      }
    }
    if (currentParam) result.params.push(currentParam);
  }

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "--";
  return new Date(isoDate).toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── MCP Tool Selector ───────────────────────────────────────────────────────

function McpToolSelector({
  servers,
  selected,
  onChange,
  loading,
}: {
  servers: McpServer[];
  selected: string[];
  onChange: (tools: string[]) => void;
  loading: boolean;
}) {
  function toggle(tool: string) {
    if (selected.includes(tool)) {
      onChange(selected.filter((t) => t !== tool));
    } else {
      onChange([...selected, tool]);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Wrench className="size-4 shrink-0" />
        <span>
          Keine MCP-Server registriert. Fuege Werkzeuge in den Einstellungen
          hinzu.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {servers.map((server) => (
        <div key={server.id} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Wrench className="size-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {server.name}
            </p>
            <Badge variant="secondary" className="text-xs">
              {server.transport_type}
            </Badge>
          </div>
          {server.tools.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-5">
              Keine Tools definiert
            </p>
          ) : (
            <div className="space-y-1.5 pl-5">
              {server.tools.map((tool) => {
                const toolName = typeof tool === "string" ? tool : tool.name;
                const toolKey = `mcp__${server.name}__${toolName}`;
                const isChecked = selected.includes(toolKey);
                return (
                  <label
                    key={toolName}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(toolKey)}
                      className="size-3.5 rounded accent-primary cursor-pointer"
                    />
                    <span className="text-xs font-mono group-hover:text-foreground transition-colors text-muted-foreground">
                      {toolName}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Schedule Constants ──────────────────────────────────────────────────────

type ScheduleFrequency = "daily" | "weekly" | "monthly" | "hourly";

const FREQUENCY_OPTIONS: { value: ScheduleFrequency; label: string }[] = [
  { value: "daily", label: "Taeglich" },
  { value: "weekly", label: "Woechentlich" },
  { value: "monthly", label: "Monatlich" },
  { value: "hourly", label: "Stuendlich" },
];

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const MINUTE_OPTIONS = [0, 15, 30, 45];
const HOUR_INTERVAL_OPTIONS = [1, 2, 3, 4, 6, 8, 12];

const TIMEZONE_OPTIONS = [
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "UTC",
] as const;

// ─── Schedule Dialog ────────────────────────────────────────────────────────

function SkillScheduleDialog({
  skill,
  open,
  onOpenChange,
}: {
  skill: SkillItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(30);
  const [weekday, setWeekday] = useState(1); // 0=So, 1=Mo
  const [monthday, setMonthday] = useState(1);
  const [everyHours, setEveryHours] = useState(6);
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [showCustomCron, setShowCustomCron] = useState(false);
  const [customCron, setCustomCron] = useState("");
  const [saving, setSaving] = useState(false);

  const getCronExpression = (): string => {
    if (showCustomCron && customCron.trim()) return customCron.trim();
    switch (frequency) {
      case "daily":
        return `${minute} ${hour} * * *`;
      case "weekly":
        return `${minute} ${hour} * * ${weekday}`;
      case "monthly":
        return `${minute} ${hour} ${monthday} * *`;
      case "hourly":
        return `${minute} */${everyHours} * * *`;
    }
  };

  const getPreviewText = (): string => {
    if (showCustomCron && customCron.trim()) return `Cron: ${customCron.trim()}`;
    const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    switch (frequency) {
      case "daily":
        return `Wird taeglich um ${time} Uhr ausgefuehrt`;
      case "weekly":
        return `Wird jeden ${WEEKDAYS[weekday]} um ${time} Uhr ausgefuehrt`;
      case "monthly":
        return `Wird am ${monthday}. jedes Monats um ${time} Uhr ausgefuehrt`;
      case "hourly":
        return `Wird alle ${everyHours} Stunden ausgefuehrt (ab Minute ${minute.toString().padStart(2, "0")})`;
    }
  };

  async function handleSave() {
    const cron = getCronExpression();
    if (!cron) {
      toast.error("Bitte konfiguriere einen Zeitplan.");
      return;
    }
    setSaving(true);
    try {
      await settingsService.scheduleSkill(skill.id, cron, timezone);
      toast.success("Skill geplant! Wird automatisch ausgefuehrt.");
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Planen";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5" />
            Skill planen: {skill.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step 1: Frequency */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Haeufigkeit</Label>
            <div className="flex flex-wrap gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setFrequency(opt.value);
                    setShowCustomCron(false);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    frequency === opt.value && !showCustomCron
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Timer className="size-3" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Details based on frequency */}
          {!showCustomCron && (
            <div className="space-y-3">
              {/* Weekly: Weekday picker */}
              {frequency === "weekly" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tag</Label>
                  <Select
                    value={weekday.toString()}
                    onValueChange={(v) => setWeekday(parseInt(v))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day, i) => (
                        <SelectItem key={i} value={i.toString()} className="text-sm">
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Monthly: Day picker */}
              {frequency === "monthly" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tag des Monats</Label>
                  <Select
                    value={monthday.toString()}
                    onValueChange={(v) => setMonthday(parseInt(v))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={d.toString()} className="text-sm">
                          {d}.
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Hourly: Interval picker */}
              {frequency === "hourly" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Intervall</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Alle</span>
                    <Select
                      value={everyHours.toString()}
                      onValueChange={(v) => setEveryHours(parseInt(v))}
                    >
                      <SelectTrigger className="h-9 w-20 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOUR_INTERVAL_OPTIONS.map((h) => (
                          <SelectItem key={h} value={h.toString()} className="text-sm">
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">Stunden</span>
                  </div>
                </div>
              )}

              {/* Time picker (for daily, weekly, monthly) */}
              {frequency !== "hourly" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Uhrzeit</Label>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={hour.toString()}
                      onValueChange={(v) => setHour(parseInt(v))}
                    >
                      <SelectTrigger className="h-9 w-20 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                          <SelectItem key={h} value={h.toString()} className="text-sm">
                            {h.toString().padStart(2, "0")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm font-medium text-muted-foreground">:</span>
                    <Select
                      value={minute.toString()}
                      onValueChange={(v) => setMinute(parseInt(v))}
                    >
                      <SelectTrigger className="h-9 w-20 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MINUTE_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m.toString()} className="text-sm">
                            {m.toString().padStart(2, "0")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Start-Minute</Label>
                  <Select
                    value={minute.toString()}
                    onValueChange={(v) => setMinute(parseInt(v))}
                  >
                    <SelectTrigger className="h-9 w-20 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTE_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m.toString()} className="text-sm">
                          {m.toString().padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Zeitzone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz} value={tz} className="text-sm">
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-muted/50 border p-3 text-xs flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-primary" />
            <span className="italic text-muted-foreground">
              {getPreviewText()} ({timezone})
            </span>
          </div>

          {/* Custom Cron Toggle (Power User) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowCustomCron(!showCustomCron)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCustomCron ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              Eigener Cron-Ausdruck
            </button>
            {showCustomCron && (
              <div className="space-y-1">
                <Input
                  placeholder="z.B. 30 7 * * * (Min Std Tag Mon Wtag)"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  className="h-9 text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Format: Minute Stunde Tag Monat Wochentag
                </p>
              </div>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarClock className="size-4" />
            )}
            {saving ? "Wird geplant..." : "Zeitplan speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skill Card (List View) ─────────────────────────────────────────────────

function SkillCard({
  skill,
  onSelect,
  onToggle,
}: {
  skill: SkillItem;
  onSelect: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const hasSkillMd = Boolean(skill.skill_md);

  async function handleToggle() {
    setToggling(true);
    try {
      onToggle(skill.id, !skill.active);
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <Card
        className={`transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-sm ${
          !skill.active ? "opacity-60" : ""
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex items-center gap-3 flex-1 min-w-0"
              onClick={() => onSelect(skill.id)}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl">
                {skill.icon || "\u26a1"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold truncate">
                    {skill.name}
                  </CardTitle>
                  <Badge
                    variant={skill.active ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 h-5 shrink-0"
                  >
                    {skill.active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 shrink-0 capitalize"
                  >
                    {CATEGORY_LABELS[skill.category ?? ""] ?? "Allgemein"}
                  </Badge>
                  {hasSkillMd && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-5 shrink-0 gap-1 border-emerald-700/50 text-emerald-400"
                    >
                      <FileText className="size-2.5" />
                      SKILL.md
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-0.5 line-clamp-2">
                  {skill.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setScheduleOpen(true);
                }}
              >
                <CalendarClock className="size-3" />
                Planen
              </Button>
              <Switch
                checked={skill.active}
                onCheckedChange={handleToggle}
                disabled={toggling}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0" onClick={() => onSelect(skill.id)}>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Play className="size-3" />
              {skill.execution_count}x ausgefuehrt
            </span>
            {skill.execution_count > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                {Math.round(skill.success_rate * 100)}% Erfolg
              </span>
            )}
            {skill.last_execution && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(skill.last_execution)}
              </span>
            )}
            {skill.description && (
              <span className="flex items-center gap-1 text-primary/60">
                <Sparkles className="size-3" />
                Auto-Trigger via Beschreibung
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <SkillScheduleDialog
        skill={skill}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
      />
    </>
  );
}

// ─── Skill List Skeleton ────────────────────────────────────────────────────

function SkillListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Execution Log Entry ────────────────────────────────────────────────────

function LogEntry({ log }: { log: SkillLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {log.status === "success" ? (
            <CheckCircle2 className="size-4 text-green-500 shrink-0" />
          ) : (
            <XCircle className="size-4 text-red-500 shrink-0" />
          )}
          <span className="text-xs text-muted-foreground truncate">
            {formatDate(log.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={log.status === "success" ? "default" : "destructive"}
            className="text-xs"
          >
            {log.status}
          </Badge>
          {log.duration_ms !== null && (
            <span className="text-xs text-muted-foreground">
              {formatDuration(log.duration_ms)}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 pt-1">
          {log.input_summary && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Input
              </p>
              <p className="text-xs bg-muted rounded p-2 whitespace-pre-wrap break-words">
                {log.input_summary}
              </p>
            </div>
          )}
          {log.output_summary && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Output
              </p>
              <p className="text-xs bg-muted rounded p-2 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                {log.output_summary}
              </p>
            </div>
          )}
          {log.error_message && (
            <div>
              <p className="text-xs font-medium text-red-500 mb-1">Fehler</p>
              <p className="text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded p-2">
                {log.error_message}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Parameter Editor ────────────────────────────────────────────────────────

interface ParamDraft {
  key: string;
  type: string;
  required: boolean;
  description: string;
}

function ParameterEditor({
  params,
  onChange,
}: {
  params: ParamDraft[];
  onChange: (params: ParamDraft[]) => void;
}) {
  function addParam() {
    onChange([
      ...params,
      { key: "", type: "string", required: false, description: "" },
    ]);
  }

  function removeParam(index: number) {
    onChange(params.filter((_, i) => i !== index));
  }

  function updateParam(index: number, field: keyof ParamDraft, value: string | boolean) {
    onChange(
      params.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  return (
    <div className="space-y-3">
      {params.map((param, index) => (
        <div
          key={index}
          className="rounded-lg border p-3 space-y-2 relative"
        >
          <button
            type="button"
            onClick={() => removeParam(index)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
          >
            <XCircle className="size-4" />
          </button>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Key</Label>
              <Input
                placeholder="z.B. topic"
                value={param.key}
                onChange={(e) => updateParam(index, "key", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Typ</Label>
              <Select
                value={param.type}
                onValueChange={(v) => updateParam(index, "type", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="number">number</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Beschreibung</Label>
            <Input
              placeholder="Wofuer wird dieser Parameter genutzt?"
              value={param.description}
              onChange={(e) =>
                updateParam(index, "description", e.target.value)
              }
              className="h-8 text-xs"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={param.required}
              onChange={(e) => updateParam(index, "required", e.target.checked)}
              className="size-3.5 rounded accent-primary"
            />
            <span className="text-xs text-muted-foreground">Pflichtfeld</span>
          </label>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addParam}
        className="gap-1.5 w-full"
      >
        <Plus className="size-3.5" />
        Parameter hinzufuegen
      </Button>
    </div>
  );
}

// ─── Skill Create View (Manual with SKILL.md) ──────────────────────────────

function SkillCreateView({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [params, setParams] = useState<ParamDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");

  const generatedMd = useMemo(
    () => generateSkillMd(name, description, instructions, params),
    [name, description, instructions, params]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      toast.error("Name und Beschreibung sind Pflichtfelder");
      return;
    }

    const parameters: Record<string, SkillParameterDef> = {};
    for (const p of params) {
      if (!p.key.trim()) continue;
      parameters[p.key.trim()] = {
        type: p.type,
        required: p.required,
        description: p.description,
      };
    }

    const payload: SkillCreateRequest = {
      name: name.trim(),
      description: description.trim(),
      system_prompt: instructions.trim() || undefined,
      parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
      skill_md: generatedMd,
    };

    setSubmitting(true);
    try {
      await settingsService.createSkill(payload);
      toast.success("Skill erstellt");
      onCreated();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Erstellen des Skills";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Skill erstellen</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Erstelle einen neuen Skill im Open Standard Format (SKILL.md)
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="edit" className="gap-1.5">
            <Settings2 className="size-3.5" />
            Formular
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="size-3.5" />
            SKILL.md Vorschau
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4 mt-4">
          {/* Grunddaten */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Grunddaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="skill-name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="skill-name"
                  placeholder="z.B. daily_summary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skill-desc">
                  Beschreibung <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="skill-desc"
                  placeholder="Was macht dieser Skill? Claude nutzt diese Beschreibung um zu entscheiden, wann der Skill automatisch genutzt wird."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  rows={2}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Claude nutzt diese Beschreibung um zu entscheiden, wann der Skill automatisch ausgeloest wird.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skill-instructions">
                  Anweisungen (Markdown)
                </Label>
                <Textarea
                  id="skill-instructions"
                  placeholder="# Anweisungen&#10;&#10;Beschreibe hier die genauen Schritte die der Skill ausfuehren soll...&#10;&#10;## Regeln&#10;- Regel 1&#10;- Regel 2"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  disabled={submitting}
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Parameter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Parameter</CardTitle>
              <CardDescription className="text-xs">
                Definiere optionale Eingabe-Parameter fuer diesen Skill.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ParameterEditor params={params} onChange={setParams} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-emerald-400" />
                <CardTitle className="text-sm">SKILL.md Vorschau</CardTitle>
              </div>
              <CardDescription className="text-xs">
                So wird dein Skill als SKILL.md gespeichert (Anthropic Skills Open Standard)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap text-zinc-300 max-h-[500px] overflow-y-auto">
                {generatedMd}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={submitting || !name.trim() || !description.trim()}
          className="gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Wird erstellt...
            </>
          ) : (
            <>
              <Plus className="size-4" />
              Skill erstellen
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

// ─── Skill Detail View ──────────────────────────────────────────────────────

function SkillDetailView({
  skillId,
  onBack,
  onDeleted,
  allSkills,
}: {
  skillId: string;
  onBack: () => void;
  onDeleted: () => void;
  allSkills: SkillItem[];
}) {
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [logs, setLogs] = useState<SkillLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [executionToolCalls, setExecutionToolCalls] = useState<SkillToolCall[]>([]);
  const [toolCallsExpanded, setToolCallsExpanded] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("overview");

  // SKILL.md editor state
  const [skillMdDraft, setSkillMdDraft] = useState("");
  const [savingMd, setSavingMd] = useState(false);

  // Tool editing state
  const [servers, setServers] = useState<McpServer[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [editingTools, setEditingTools] = useState(false);
  const [draftTools, setDraftTools] = useState<string[]>([]);
  const [savingTools, setSavingTools] = useState(false);

  // Chain state
  const [savingChain, setSavingChain] = useState(false);

  // Skill files state
  const [skillFiles, setSkillFiles] = useState<SkillFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<{ id?: string; filename: string; content: string; file_type: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);

  const fetchSkillFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const data = await settingsService.getSkillFiles(skillId);
      setSkillFiles(data.files);
    } catch {
      setSkillFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [skillId]);

  function openNewFileDialog() {
    setEditingFile({ filename: "", content: "", file_type: "reference" });
    setFileDialogOpen(true);
  }

  async function openEditFileDialog(file: SkillFile) {
    try {
      const data = await settingsService.getSkillFile(skillId, file.id);
      setEditingFile({ id: data.id, filename: data.filename, content: data.content, file_type: data.file_type });
      setFileDialogOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Laden";
      toast.error(msg);
    }
  }

  async function handleSaveFile() {
    if (!editingFile || !editingFile.filename.trim() || !editingFile.content.trim()) {
      toast.error("Dateiname und Inhalt sind erforderlich");
      return;
    }
    if (editingFile.content.length > 100 * 1024) {
      toast.error("Datei zu gross (max 100KB)");
      return;
    }
    setSavingFile(true);
    try {
      await settingsService.uploadSkillFile(skillId, editingFile.filename.trim(), editingFile.content, editingFile.file_type);
      toast.success(`Datei '${editingFile.filename}' gespeichert`);
      setFileDialogOpen(false);
      setEditingFile(null);
      fetchSkillFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Speichern fehlgeschlagen";
      toast.error(msg);
    } finally {
      setSavingFile(false);
    }
  }

  async function handleDeleteFile(fileId: string, filename: string) {
    if (!window.confirm(`Datei '${filename}' wirklich loeschen?`)) return;
    try {
      await settingsService.deleteSkillFile(skillId, fileId);
      toast.success(`Datei '${filename}' geloescht`);
      fetchSkillFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Loeschen fehlgeschlagen";
      toast.error(msg);
    }
  }

  const fetchSkill = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getSkill(skillId);
      setSkill(data.skill);
      setDraftTools(data.skill.allowed_tools ?? []);
      setSkillMdDraft(data.skill.skill_md ?? "");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Laden des Skills.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await settingsService.getSkillLogs(skillId, 20);
      setLogs(data.logs);
    } catch {
      // Silently fail for logs
    } finally {
      setLogsLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    fetchSkill();
    fetchLogs();
    fetchSkillFiles();
  }, [fetchSkill, fetchLogs, fetchSkillFiles]);

  useEffect(() => {
    async function fetchServers() {
      setServersLoading(true);
      try {
        const data = await settingsService.getWerkzeuge();
        setServers(data.werkzeuge ?? []);
      } catch {
        // Non-critical
      } finally {
        setServersLoading(false);
      }
    }
    fetchServers();
  }, []);

  async function handleExecute() {
    if (!skill) return;
    setExecuting(true);
    setExecutionResult(null);
    setExecutionToolCalls([]);
    setToolCallsExpanded(false);

    // Request browser notification permission on first execution
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    try {
      const data = await settingsService.executeSkill(skillId, {
        input: userInput,
        parameters:
          Object.keys(paramValues).length > 0 ? paramValues : undefined,
      });
      setExecutionResult(data.execution.output);
      setExecutionToolCalls(data.execution.tool_calls || []);
      toast.success(
        `Skill ausgefuehrt in ${formatDuration(data.execution.duration_ms)}`
      );

      // Browser notification when tab is in background
      if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        new Notification("PAI-X — Skill abgeschlossen", {
          body: `${skill.name} wurde erfolgreich ausgefuehrt`,
          icon: "/icon.png",
        });
      }

      fetchLogs();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler bei der Ausfuehrung.";
      toast.error(msg);
    } finally {
      setExecuting(false);
    }
  }

  async function handleToggleActive() {
    if (!skill) return;
    try {
      await settingsService.updateSkill(skillId, { active: !skill.active });
      setSkill({ ...skill, active: !skill.active });
      toast.success(skill.active ? "Skill deaktiviert" : "Skill aktiviert");
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  }

  async function handleAutonomyChange(level: string) {
    if (!skill) return;
    const numLevel = parseInt(level, 10);
    try {
      await settingsService.updateSkill(skillId, {
        autonomy_level: numLevel,
      });
      setSkill({ ...skill, autonomy_level: numLevel });
      toast.success(`Autonomie-Level auf ${numLevel} gesetzt`);
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  }

  async function handleSaveTools() {
    if (!skill) return;
    setSavingTools(true);
    try {
      await settingsService.updateSkill(skillId, {
        allowed_tools: draftTools,
      });
      setSkill({ ...skill, allowed_tools: draftTools });
      setEditingTools(false);
      toast.success("Werkzeuge aktualisiert");
    } catch {
      toast.error("Fehler beim Speichern der Werkzeuge");
    } finally {
      setSavingTools(false);
    }
  }

  async function handleSaveSkillMd() {
    if (!skill) return;
    setSavingMd(true);
    try {
      await settingsService.updateSkill(skillId, { skill_md: skillMdDraft });
      setSkill({ ...skill, skill_md: skillMdDraft });
      toast.success("SKILL.md gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSavingMd(false);
    }
  }

  // ── Chain helpers ──

  // Build the pipeline chain by following next_skill_id links
  const pipelineChain = useMemo(() => {
    const chain: { id: string; name: string; icon?: string | null }[] = [];
    if (!skill) return chain;
    chain.push({ id: skillId, name: skill.name, icon: skill.icon });
    const visited = new Set<string>([skillId]);
    let currentId = skill.next_skill_id;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const s = allSkills.find((sk) => sk.id === currentId);
      if (!s) break;
      chain.push({ id: s.id, name: s.name, icon: s.icon });
      currentId = s.next_skill_id;
    }
    return chain;
  }, [skill, skillId, allSkills]);

  // Detect if selecting a target would create a cycle
  function wouldCreateCycle(targetId: string): boolean {
    const visited = new Set<string>([skillId]);
    let currentId: string | null | undefined = targetId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const s = allSkills.find((sk) => sk.id === currentId);
      if (!s) break;
      currentId = s.next_skill_id;
    }
    return currentId === skillId;
  }

  async function handleSetNextSkill(nextId: string | null) {
    if (!skill) return;
    setSavingChain(true);
    try {
      await settingsService.updateSkill(skillId, { next_skill_id: nextId ?? "" });
      setSkill({ ...skill, next_skill_id: nextId });
      toast.success(nextId ? "Verkettung gespeichert" : "Verkettung entfernt");
    } catch {
      toast.error("Fehler beim Speichern der Verkettung");
    } finally {
      setSavingChain(false);
    }
  }

  async function handleDelete() {
    if (!skill) return;
    if (
      !window.confirm(
        `Skill "${skill.name}" wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.`
      )
    )
      return;

    setDeleting(true);
    try {
      await settingsService.deleteSkill(skillId);
      toast.success("Skill geloescht");
      onDeleted();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Loeschen des Skills";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  // Parse SKILL.md for overview rendering
  const parsedMd = useMemo(() => {
    if (!skill?.skill_md) return null;
    return parseSkillMd(skill.skill_md);
  }, [skill?.skill_md]);

  const renderedInstructions = useMemo(() => {
    if (!parsedMd?.instructions) return "";
    return renderMarkdownToHtml(parsedMd.instructions);
  }, [parsedMd?.instructions]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <div className="space-y-3 mt-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Skill nicht gefunden.</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          Zurueck
        </Button>
      </div>
    );
  }

  const parameters = skill.parameters || {};
  const hasParameters = Object.keys(parameters).length > 0;
  const allowedTools = skill.allowed_tools ?? [];
  const hasSkillMd = Boolean(skill.skill_md);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 mt-0.5"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight truncate">
              {skill.name}
            </h2>
            <Badge variant={skill.active ? "default" : "secondary"}>
              {skill.active ? "Aktiv" : "Inaktiv"}
            </Badge>
            {skill.is_custom && (
              <Badge variant="outline" className="text-xs">
                Custom
              </Badge>
            )}
            {hasSkillMd && (
              <Badge
                variant="outline"
                className="text-xs gap-1 border-emerald-700/50 text-emerald-400"
              >
                <FileText className="size-3" />
                SKILL.md
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {skill.description}
          </p>
        </div>
        {skill.is_custom && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-1.5 shrink-0 text-destructive hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Loeschen
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Eye className="size-3.5" />
            Uebersicht
          </TabsTrigger>
          <TabsTrigger value="skillmd" className="gap-1.5">
            <Code2 className="size-3.5" />
            SKILL.md
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ScrollText className="size-3.5" />
            Verlauf
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5">
            <FolderOpen className="size-3.5" />
            Dateien
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings2 className="size-3.5" />
            Konfiguration
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Rendered SKILL.md Instructions */}
          {hasSkillMd && parsedMd?.instructions ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="size-4 text-emerald-400" />
                  Skill-Anweisungen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose-custom max-h-[500px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: renderedInstructions }}
                />
              </CardContent>
            </Card>
          ) : skill.system_prompt ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">System-Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs bg-muted rounded-lg p-3 font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {skill.system_prompt}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Execution Section */}
          {hasParameters && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Parameter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(parameters).map(
                  ([key, param]: [string, SkillParameterDef]) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`param-${key}`} className="text-xs">
                        {param.description}
                        {param.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </Label>
                      <Input
                        id={`param-${key}`}
                        placeholder={key}
                        value={paramValues[key] || ""}
                        onChange={(e) =>
                          setParamValues((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        disabled={executing || !skill.active}
                      />
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill ausfuehren</CardTitle>
              <CardDescription className="text-xs">
                Optionaler Freitext fuer zusaetzlichen Kontext.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Zusaetzlicher Kontext oder Anweisungen..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={3}
                disabled={executing || !skill.active}
              />
            </CardContent>
          </Card>

          <Button
            onClick={handleExecute}
            disabled={executing || !skill.active}
            className="gap-2 w-full sm:w-auto"
            size="lg"
          >
            {executing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Wird ausgefuehrt...
              </>
            ) : (
              <>
                <Play className="size-4" />
                Skill ausfuehren
              </>
            )}
          </Button>

          {executionResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-500" />
                  Ergebnis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="whitespace-pre-wrap text-sm bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
                  {executionResult}
                </div>

                {executionToolCalls.length > 0 && (
                  <div className="border rounded-lg">
                    <button
                      onClick={() => setToolCallsExpanded(!toolCallsExpanded)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors rounded-lg"
                    >
                      <Wrench className="size-3.5" />
                      <span>{executionToolCalls.length} Tool-Call{executionToolCalls.length !== 1 ? "s" : ""} ausgefuehrt</span>
                      {toolCallsExpanded ? (
                        <ChevronUp className="size-3.5 ml-auto" />
                      ) : (
                        <ChevronDown className="size-3.5 ml-auto" />
                      )}
                    </button>
                    {toolCallsExpanded && (
                      <div className="border-t px-3 py-2 space-y-2">
                        {executionToolCalls.map((tc, i) => (
                          <div
                            key={i}
                            className="text-xs bg-muted/50 rounded-md p-2 space-y-1"
                          >
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              <Code2 className="size-3" />
                              <span>{tc.name}</span>
                              {tc.round && (
                                <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0">
                                  Runde {tc.round}
                                </Badge>
                              )}
                            </div>
                            <pre className="text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all font-mono">
                              {JSON.stringify(tc.input, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Skill Chain Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link2 className="size-4 text-blue-400" />
                Verkettung
              </CardTitle>
              <CardDescription className="text-xs">
                Nach Abschluss automatisch einen anderen Skill ausfuehren.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Select
                  value={skill.next_skill_id ?? "__none__"}
                  onValueChange={(val) => handleSetNextSkill(val === "__none__" ? null : val)}
                  disabled={savingChain}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Skill auswaehlen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Kein Folge-Skill</SelectItem>
                    {allSkills
                      .filter((s) => s.id !== skillId)
                      .map((s) => {
                        const cycle = wouldCreateCycle(s.id);
                        return (
                          <SelectItem key={s.id} value={s.id} disabled={cycle}>
                            {s.icon ?? "⚡"} {s.name}
                            {cycle ? " (Zyklus!)" : ""}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                {skill.next_skill_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSetNextSkill(null)}
                    disabled={savingChain}
                    title="Verkettung entfernen"
                  >
                    {savingChain ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                )}
              </div>

              {/* Pipeline Preview */}
              {pipelineChain.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Pipeline-Vorschau:</p>
                  <div className="flex items-center gap-1 flex-wrap text-xs">
                    {pipelineChain.map((step, i) => (
                      <span key={step.id} className="flex items-center gap-1">
                        {i > 0 && <ArrowRight className="size-3 text-muted-foreground shrink-0" />}
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
                            i === 0
                              ? "bg-primary/10 text-primary font-medium"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {step.icon ?? "⚡"} {step.name}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!skill.active && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <Zap className="size-4 shrink-0" />
              <p>
                Dieser Skill ist deaktiviert. Aktiviere ihn in der
                Konfiguration, um ihn auszufuehren.
              </p>
            </div>
          )}
        </TabsContent>

        {/* SKILL.md Editor Tab */}
        <TabsContent value="skillmd" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-emerald-400" />
                  <CardTitle className="text-sm">SKILL.md Editor</CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveSkillMd}
                  disabled={savingMd}
                  className="gap-1.5"
                >
                  {savingMd ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Speichern
                </Button>
              </div>
              <CardDescription className="text-xs">
                Bearbeite den SKILL.md Inhalt direkt (Anthropic Skills Open Standard Format)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={skillMdDraft}
                onChange={(e) => setSkillMdDraft(e.target.value)}
                rows={20}
                className="font-mono text-xs bg-zinc-900 border-zinc-800 text-zinc-300 resize-y"
                placeholder={`---\nname: "${skill.name}"\ndescription: "${skill.description}"\n---\n\n# ${skill.name}\n\nSchreibe hier die Anweisungen fuer den Skill...`}
              />
            </CardContent>
          </Card>

          {/* Live preview of the SKILL.md */}
          {skillMdDraft && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="size-4" />
                  Vorschau
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose-custom"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownToHtml(
                      parseSkillMd(skillMdDraft).instructions || skillMdDraft
                    ),
                  }}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-3 mt-4">
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-3">
                <ScrollText className="size-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Noch keine Ausfuehrungen. Starte den Skill, um Logs zu sehen.
              </p>
            </div>
          ) : (
            logs.map((log) => <LogEntry key={log.id} log={log} />)
          )}
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="size-4" />
                Skill-Dateien
              </CardTitle>
              <CardDescription className="text-xs">
                Werden beim Ausfuehren automatisch als Kontext geladen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File list */}
              {filesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : skillFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Keine Dateien vorhanden. Erstelle Templates, Beispiele oder Referenzen.
                </p>
              ) : (
                <div className="space-y-1">
                  {skillFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{f.filename}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {f.file_type === "template" ? "Template" : f.file_type === "example" ? "Beispiel" : "Referenz"}
                        </Badge>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {f.size > 1024
                            ? `${(f.size / 1024).toFixed(1)} KB`
                            : `${f.size} B`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEditFileDialog(f)}
                        >
                          <Settings2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteFile(f.id, f.filename)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <Button
                variant="outline"
                size="sm"
                onClick={openNewFileDialog}
                className="gap-1.5 w-full"
              >
                <Plus className="size-3.5" />
                Datei hinzufuegen
              </Button>
            </CardContent>
          </Card>

          {/* File Edit Dialog */}
          <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-sm">
                  {editingFile?.id ? "Datei bearbeiten" : "Neue Datei erstellen"}
                </DialogTitle>
              </DialogHeader>
              {editingFile && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Dateiname</Label>
                      <Input
                        placeholder="z.B. template.md"
                        value={editingFile.filename}
                        onChange={(e) => setEditingFile({ ...editingFile, filename: e.target.value })}
                        className="text-xs"
                        disabled={!!editingFile.id}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Typ</Label>
                      <Select
                        value={editingFile.file_type}
                        onValueChange={(v) => setEditingFile({ ...editingFile, file_type: v })}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="template">Template</SelectItem>
                          <SelectItem value="example">Beispiel</SelectItem>
                          <SelectItem value="reference">Referenz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Inhalt</Label>
                    <Textarea
                      placeholder="Markdown-Inhalt..."
                      value={editingFile.content}
                      onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                      className="font-mono text-xs min-h-[300px]"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {editingFile.content.length > 1024
                        ? `${(editingFile.content.length / 1024).toFixed(1)} KB`
                        : `${editingFile.content.length} B`} / 100 KB
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setFileDialogOpen(false)}>
                      Abbrechen
                    </Button>
                    <Button size="sm" onClick={handleSaveFile} disabled={savingFile} className="gap-1.5">
                      {savingFile ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      Speichern
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill-Einstellungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Active Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Skill aktiv</p>
                  <p className="text-xs text-muted-foreground">
                    Aktiviere oder deaktiviere diesen Skill
                  </p>
                </div>
                <Switch
                  checked={skill.active}
                  onCheckedChange={handleToggleActive}
                />
              </div>

              {/* Autonomy Level */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Autonomie-Level</p>
                  <p className="text-xs text-muted-foreground">
                    Wie selbststaendig darf PAI-X diesen Skill nutzen?
                  </p>
                </div>
                <Select
                  value={String(skill.autonomy_level)}
                  onValueChange={handleAutonomyChange}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                    <SelectItem value="5">Level 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Allowed Tools */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Erlaubte Werkzeuge</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    MCP-Tools die dieser Skill verwenden darf
                  </CardDescription>
                </div>
                {!editingTools ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDraftTools(allowedTools);
                      setEditingTools(true);
                    }}
                  >
                    Bearbeiten
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveTools}
                      disabled={savingTools}
                      className="gap-1.5"
                    >
                      {savingTools ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      Speichern
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDraftTools(allowedTools);
                        setEditingTools(false);
                      }}
                      disabled={savingTools}
                    >
                      Abbrechen
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingTools ? (
                <McpToolSelector
                  servers={servers}
                  selected={draftTools}
                  onChange={setDraftTools}
                  loading={serversLoading}
                />
              ) : allowedTools.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Keine Werkzeuge ausgewaehlt — Skill hat Zugriff auf alle
                  Standard-Tools.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allowedTools.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="text-xs font-mono"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Prompt Preview */}
          {skill.system_prompt && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">System-Prompt</CardTitle>
                <CardDescription className="text-xs">
                  Der Prompt, der an Claude gesendet wird.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs bg-muted rounded-lg p-3 font-mono whitespace-pre-wrap">
                  {skill.system_prompt}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parameter Definitions */}
          {hasParameters && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Parameter-Definitionen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(parameters).map(
                    ([key, param]: [string, SkillParameterDef]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded border p-2.5"
                      >
                        <div>
                          <p className="text-xs font-medium font-mono">{key}</p>
                          <p className="text-xs text-muted-foreground">
                            {param.description}
                          </p>
                        </div>
                        <Badge
                          variant={param.required ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {param.required ? "Pflicht" : "Optional"}
                        </Badge>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── AI Skill Chat Modal ────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function SkillChatModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [apiMessages, setApiMessages] = useState<SkillGenerateMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedSkill, setGeneratedSkill] = useState<SkillCreateRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, loading]);

  // Send initial message when modal opens
  useEffect(() => {
    if (open && !initializedRef.current) {
      initializedRef.current = true;
      sendToAgent([]);
    }
    if (!open) {
      // Reset state when modal closes
      initializedRef.current = false;
      setChatMessages([]);
      setApiMessages([]);
      setInputValue("");
      setGeneratedSkill(null);
      setCreating(false);
      setLoading(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate SKILL.md preview from generated skill
  const skillMdPreview = useMemo(() => {
    if (!generatedSkill) return "";
    const params: ParamDraft[] = generatedSkill.parameters
      ? Object.entries(generatedSkill.parameters).map(([key, param]) => ({
          key,
          type: param.type,
          required: param.required,
          description: param.description,
        }))
      : [];
    return generateSkillMd(
      generatedSkill.name,
      generatedSkill.description,
      generatedSkill.system_prompt || "",
      params
    );
  }, [generatedSkill]);

  async function sendToAgent(messages: SkillGenerateMessage[]) {
    setLoading(true);
    try {
      const response: SkillGenerateResponse = await settingsService.generateSkill(messages);

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.message },
      ]);
      setApiMessages(response.messages);

      if (response.type === "skill_ready" && response.skill) {
        setGeneratedSkill(response.skill);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler bei der KI-Kommunikation";
      toast.error(msg);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.",
        },
      ]);
    } finally {
      setLoading(false);
      // Focus input after response
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleSend() {
    const text = inputValue.trim();
    if (!text || loading) return;

    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setInputValue("");
    setGeneratedSkill(null);

    const updatedMessages: SkillGenerateMessage[] = [
      ...apiMessages,
      { role: "user", content: text },
    ];
    sendToAgent(updatedMessages);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleCreate() {
    if (!generatedSkill) return;
    setCreating(true);
    try {
      await settingsService.createSkill({
        ...generatedSkill,
        skill_md: skillMdPreview,
      });
      toast.success(`Skill "${generatedSkill.name}" erstellt`);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Erstellen des Skills";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  function handleRetry() {
    setGeneratedSkill(null);
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: "Bitte passe den Skill an. Ich moechte noch etwas aendern." },
    ]);
    const updatedMessages: SkillGenerateMessage[] = [
      ...apiMessages,
      { role: "user", content: "Bitte passe den Skill an. Ich moechte noch etwas aendern." },
    ];
    sendToAgent(updatedMessages);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Skill mit KI erstellen
          </DialogTitle>
        </DialogHeader>

        {/* Chat Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                  <Bot className="size-4" />
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-zinc-300 mt-0.5">
                  <User className="size-4" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                <Bot className="size-4" />
              </div>
              <div className="rounded-2xl px-4 py-2.5 bg-muted text-muted-foreground text-sm">
                <span className="flex items-center gap-1">
                  <span className="animate-pulse">.</span>
                  <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
                  <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
                </span>
              </div>
            </div>
          )}

          {/* Skill Preview Card — now shows SKILL.md */}
          {generatedSkill && (
            <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-emerald-400" />
                <p className="text-sm font-semibold">Generiertes SKILL.md</p>
              </div>

              {/* SKILL.md Preview */}
              <pre className="text-xs font-mono bg-zinc-900 border border-zinc-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-zinc-300 max-h-48 overflow-y-auto">
                {skillMdPreview}
              </pre>

              <Separator />
              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="gap-2"
                  size="sm"
                >
                  {creating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Wird erstellt...
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5" />
                      Erstellen
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  disabled={creating || loading}
                  className="gap-2"
                  size="sm"
                >
                  <RotateCcw className="size-3.5" />
                  Anpassen
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t px-6 py-4 shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Beschreibe deinen Skill..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || creating}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || loading || creating}
              size="icon"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skill Preset Card ──────────────────────────────────────────────────────

function SkillPresetCard({
  preset,
  installed,
  installing,
  onInstall,
}: {
  preset: SkillPreset;
  installed: boolean;
  installing: boolean;
  onInstall: (preset: SkillPreset) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={`transition-all duration-200 ${
        installed ? "opacity-60 border-green-800/30" : "hover:border-primary/50 hover:shadow-sm"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{preset.name}</p>
                {installed && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-5 shrink-0 gap-1 border-green-700/50 text-green-400"
                  >
                    <Check className="size-2.5" />
                    Installiert
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {preset.summary}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant={installed ? "outline" : "default"}
              disabled={installed || installing}
              onClick={() => onInstall(preset)}
              className="gap-1.5"
            >
              {installing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : installed ? (
                <Check className="size-3.5" />
              ) : (
                <Download className="size-3.5" />
              )}
              {installing ? "..." : installed ? "Installiert" : "Installieren"}
            </Button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              {expanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground">{preset.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {preset.features.map((f) => (
              <Badge key={f} variant="secondary" className="text-xs">
                {f}
              </Badge>
            ))}
          </div>

          {preset.parameters && Object.keys(preset.parameters).length > 0 && (
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Parameter</p>
              {Object.entries(preset.parameters).map(([key, param]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{key}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{param.description}</span>
                    <Badge
                      variant={param.required ? "default" : "secondary"}
                      className="text-[10px] px-1 py-0"
                    >
                      {param.required ? "Pflicht" : "Optional"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {preset.hint && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              <span>{preset.hint}</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Duration Formatter (human-readable) ─────────────────────────────────────

function formatDurationHuman(ms: number | null | undefined): string {
  if (ms == null || ms === 0) return "--";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ─── Skill Analytics Dashboard ───────────────────────────────────────────────

function SkillAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<SkillAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetchAnalytics = useCallback(async (periodDays: number) => {
    setLoading(true);
    try {
      const data = await settingsService.getSkillAnalytics(periodDays);
      setAnalytics(data);
    } catch {
      // silently fail — dashboard is supplementary
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, fetchAnalytics]);

  const periodOptions = [
    { value: 7, label: "7 Tage" },
    { value: 30, label: "30 Tage" },
    { value: 90, label: "90 Tage" },
  ];

  if (loading && !analytics) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!analytics || analytics.totals.total_runs === 0) {
    return null; // Don't show dashboard if no data
  }

  const { totals, per_skill } = analytics;

  const successRateColor =
    totals.success_rate >= 90
      ? "text-emerald-500"
      : totals.success_rate >= 50
        ? "text-yellow-500"
        : "text-red-500";

  const errorCardClass =
    totals.error_count > 0
      ? "border-red-500/30 bg-red-500/5"
      : "";

  return (
    <div className="space-y-4">
      {/* Period filter chips */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Monitoring</span>
        </div>
        <div className="flex gap-1.5">
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                days === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total runs */}
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold">{totals.total_runs}</div>
          <div className="text-xs text-muted-foreground mt-1">Ausfuehrungen</div>
        </div>

        {/* Success rate */}
        <div className="rounded-lg border p-4">
          <div className={`text-2xl font-bold ${successRateColor}`}>
            {totals.success_rate}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">Erfolgsrate</div>
        </div>

        {/* Average duration */}
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {formatDurationHuman(totals.avg_duration_ms)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Durchschnitt Dauer</div>
        </div>

        {/* Errors */}
        <div className={`rounded-lg border p-4 ${errorCardClass}`}>
          <div className={`text-2xl font-bold ${totals.error_count > 0 ? "text-red-500" : ""}`}>
            {totals.error_count}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Fehler</div>
        </div>
      </div>

      {/* Per-skill breakdown table */}
      {per_skill.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Skill</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Runs</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Erfolg</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Durchschnitt Dauer</th>
              </tr>
            </thead>
            <tbody>
              {per_skill.map((skill) => {
                const rateColor =
                  skill.success_rate >= 90
                    ? "text-emerald-500"
                    : skill.success_rate >= 50
                      ? "text-yellow-500"
                      : "text-red-500";
                return (
                  <tr key={skill.skill_id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{skill.skill_name}</td>
                    <td className="text-right px-4 py-2.5 tabular-nums">{skill.runs}</td>
                    <td className={`text-right px-4 py-2.5 tabular-nums ${rateColor}`}>{skill.success_rate}%</td>
                    <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground hidden sm:table-cell">
                      {formatDurationHuman(skill.avg_duration_ms)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Separator />
    </div>
  );
}

// ─── Skill History Tab (Global) ──────────────────────────────────────────────

function SkillHistoryTab() {
  const [executions, setExecutions] = useState<SkillExecutionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 20;
  const router = useRouter();

  const fetchExecutions = useCallback(async (currentOffset: number) => {
    setLoading(true);
    try {
      const data = await settingsService.getSkillExecutions(limit, currentOffset);
      setExecutions(data.executions ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Fehler beim Laden des Verlaufs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutions(offset);
  }, [offset, fetchExecutions]);

  function formatDuration(ms: number | null): string {
    if (ms == null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading && executions.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!loading && executions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="rounded-full bg-muted p-6">
          <History className="size-10 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">Noch keine Ausfuehrungen</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Sobald du Skills ausfuehrst, erscheint hier der chronologische Verlauf
            aller Skill-Aktivitaeten.
          </p>
        </div>
      </div>
    );
  }

  const hasMore = offset + limit < total;
  const hasPrev = offset > 0;

  return (
    <div className="space-y-3">
      {executions.map((ex) => {
        const isExpanded = expandedId === ex.id;
        const isSuccess = ex.status === "success";

        return (
          <Card
            key={ex.id}
            className="cursor-pointer transition-colors hover:bg-muted/30"
            onClick={() => setExpandedId(isExpanded ? null : ex.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <div
                  className={`shrink-0 rounded-full p-1.5 ${
                    isSuccess
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {ex.skill_name}
                    </span>
                    <Badge
                      variant={isSuccess ? "secondary" : "destructive"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {isSuccess ? "Erfolg" : "Fehler"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(ex.created_at)}
                    </span>
                    {ex.duration_ms != null && (
                      <span>{formatDuration(ex.duration_ms)}</span>
                    )}
                  </div>
                </div>

                {/* Expand indicator */}
                <div className="shrink-0 text-muted-foreground">
                  {isExpanded ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  {ex.input_summary && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Eingabe
                      </p>
                      <p className="text-sm bg-muted/50 rounded-md p-2">
                        {ex.input_summary}
                      </p>
                    </div>
                  )}
                  {ex.output_summary && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Ausgabe
                      </p>
                      <p className="text-sm bg-muted/50 rounded-md p-2 whitespace-pre-wrap">
                        {ex.output_summary}
                      </p>
                    </div>
                  )}
                  {ex.error_message && (
                    <div>
                      <p className="text-xs font-medium text-red-400 mb-1 flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        Fehler
                      </p>
                      <p className="text-sm bg-red-500/10 text-red-400 rounded-md p-2">
                        {ex.error_message}
                      </p>
                    </div>
                  )}
                  {ex.output_summary && (
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          const params = new URLSearchParams({
                            context: `Hier ist das Ergebnis meines "${ex.skill_name}" Skills:\n\n${ex.output_summary}`,
                          });
                          router.push(`/chat?${params.toString()}`);
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                        Im Chat oeffnen
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Pagination */}
      {(hasPrev || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
          >
            <ChevronLeft className="size-4 mr-1" />
            Zurueck
          </Button>
          <span className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + limit, total)} von {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => setOffset((prev) => prev + limit)}
          >
            Weiter
            <ChevronDown className="size-4 ml-1 -rotate-90" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Skills Page ────────────────────────────────────────────────────────────

type PageMode = "list" | "detail" | "create";

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PageMode>("list");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [presetSearch, setPresetSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const filteredSkills = useMemo(() => {
    if (!categoryFilter) return skills;
    return skills.filter((s) => (s.category ?? "") === categoryFilter);
  }, [skills, categoryFilter]);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getSkills();
      setSkills(data.skills ?? []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Laden der Skills.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  async function handleToggle(skillId: string, active: boolean) {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, active } : s))
    );
    try {
      await settingsService.updateSkill(skillId, { active });
      toast.success(active ? "Skill aktiviert" : "Skill deaktiviert");
    } catch {
      setSkills((prev) =>
        prev.map((s) => (s.id === skillId ? { ...s, active: !active } : s))
      );
      toast.error("Fehler beim Aktualisieren");
    }
  }

  function handleSelectSkill(id: string) {
    setSelectedSkillId(id);
    setMode("detail");
  }

  function handleBackToList() {
    setSelectedSkillId(null);
    setMode("list");
    fetchSkills();
  }

  // Installed skill names for deduplication
  const installedNames = useMemo(
    () => new Set(skills.map((s) => s.name.toLowerCase())),
    [skills]
  );

  // Filter presets
  const filteredPresets = useMemo(() => {
    if (!presetSearch.trim()) return SKILL_PRESETS;
    const q = presetSearch.toLowerCase();
    return SKILL_PRESETS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.features.some((f) => f.toLowerCase().includes(q))
    );
  }, [presetSearch]);

  // Group presets by category
  const groupedPresets = useMemo(() => {
    const groups = new Map<string, SkillPreset[]>();
    for (const preset of filteredPresets) {
      const list = groups.get(preset.category) || [];
      list.push(preset);
      groups.set(preset.category, list);
    }
    return groups;
  }, [filteredPresets]);

  async function handleInstallPreset(preset: SkillPreset) {
    setInstalling(preset.id);
    try {
      const skillMdLines: string[] = [
        "---",
        `name: "${preset.name}"`,
        `description: "${preset.summary}"`,
      ];
      if (preset.parameters && Object.keys(preset.parameters).length > 0) {
        skillMdLines.push("parameters:");
        for (const [key, param] of Object.entries(preset.parameters)) {
          skillMdLines.push(`  ${key}:`);
          skillMdLines.push(`    type: "${param.type}"`);
          skillMdLines.push(`    required: ${param.required}`);
          skillMdLines.push(`    description: "${param.description}"`);
        }
      }
      skillMdLines.push("---", "", preset.system_prompt, "");

      await settingsService.createSkill({
        name: preset.name,
        description: preset.summary,
        system_prompt: preset.system_prompt,
        parameters: preset.parameters,
        skill_md: skillMdLines.join("\n"),
      });
      toast.success(`${preset.name} installiert`);
      fetchSkills();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Installieren";
      toast.error(msg);
    } finally {
      setInstalling(null);
    }
  }

  // Detail view
  if (mode === "detail" && selectedSkillId) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
        <SkillDetailView
          skillId={selectedSkillId}
          onBack={handleBackToList}
          onDeleted={handleBackToList}
          allSkills={skills}
        />
      </div>
    );
  }

  // Create view
  if (mode === "create") {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
        <SkillCreateView
          onBack={() => setMode("list")}
          onCreated={() => {
            setMode("list");
            fetchSkills();
          }}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verwalte deine PAI-X Skills im Anthropic Open Standard Format
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => setAiChatOpen(true)}
            className="gap-2"
          >
            <Sparkles className="size-4" />
            Mit KI erstellen
          </Button>
          <Button
            onClick={() => setMode("create")}
            className="gap-2"
          >
            <Plus className="size-4" />
            Skill erstellen
          </Button>
        </div>
      </div>

      {/* AI Chat Modal */}
      <SkillChatModal
        open={aiChatOpen}
        onOpenChange={setAiChatOpen}
        onCreated={() => {
          fetchSkills();
        }}
      />

      {/* Tabs: Verlauf + Meine Skills + Bibliothek */}
      <Tabs defaultValue="verlauf">
        <TabsList>
          <TabsTrigger value="verlauf" className="gap-2">
            <History className="size-4" />
            Verlauf
          </TabsTrigger>
          <TabsTrigger value="meine" className="gap-2">
            <Zap className="size-4" />
            Meine Skills
            {skills.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1">
                {skills.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bibliothek" className="gap-2">
            <Library className="size-4" />
            Bibliothek
          </TabsTrigger>
        </TabsList>

        {/* ── Verlauf Tab (Global History) ── */}
        <TabsContent value="verlauf" className="space-y-4 mt-4">
          <SkillAnalyticsDashboard />
          <SkillHistoryTab />
        </TabsContent>

        {/* ── Bibliothek Tab ── */}
        <TabsContent value="bibliothek" className="space-y-4 mt-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Skills durchsuchen..."
              value={presetSearch}
              onChange={(e) => setPresetSearch(e.target.value)}
              className="w-full rounded-lg border bg-background px-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {presetSearch && (
              <button
                onClick={() => setPresetSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="size-4" />
              </button>
            )}
          </div>

          {/* Grouped Presets */}
          {filteredPresets.length === 0 ? (
            <div className="text-center py-12">
              <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-3">
                <Search className="size-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Keine Skills gefunden für &quot;{presetSearch}&quot;
              </p>
            </div>
          ) : (
            Array.from(groupedPresets.entries()).map(([category, presets]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                  {category}
                </h3>
                {presets.map((preset) => (
                  <SkillPresetCard
                    key={preset.id}
                    preset={preset}
                    installed={installedNames.has(preset.name.toLowerCase())}
                    installing={installing === preset.id}
                    onInstall={handleInstallPreset}
                  />
                ))}
              </div>
            ))
          )}

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0 mt-0.5" />
            <span>
              Installierte Skills erscheinen unter &quot;Meine Skills&quot; und
              stehen dem Chat-Agenten automatisch zur Verfügung. Du kannst
              Skills dort weiter konfigurieren.
            </span>
          </div>
        </TabsContent>

        {/* ── Meine Skills Tab ── */}
        <TabsContent value="meine" className="space-y-3 mt-4">
          {/* Category Filter Chips */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    categoryFilter === cat.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat.label}
                  {cat.key === ""
                    ? ` (${skills.length})`
                    : (() => {
                        const count = skills.filter(
                          (s) => (s.category ?? "") === cat.key
                        ).length;
                        return count > 0 ? ` (${count})` : "";
                      })()}
                </button>
              ))}
            </div>
          )}
          {loading ? (
            <SkillListSkeleton />
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <div className="rounded-full bg-muted p-6">
                <Zap className="size-10 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">Keine Skills installiert</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Gehe zur Bibliothek und installiere deinen ersten Skill, oder
                  erstelle einen eigenen.
                </p>
              </div>
              <Button onClick={() => setMode("create")} className="gap-2">
                <Plus className="size-4" />
                Skill erstellen
              </Button>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                Keine Skills in dieser Kategorie.
              </p>
            </div>
          ) : (
            filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onSelect={handleSelectSkill}
                onToggle={handleToggle}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
