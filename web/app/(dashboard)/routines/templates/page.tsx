"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ChevronLeft,
  Search,
  Star,
  RefreshCw,
  Wand2,
  Clock,
  Bot,
  Brain,
  Users,
  Check,
  Pencil,
  X,
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
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

interface TemplateVariable {
  name: string;
  label: string;
  type: string;
  default?: string;
}

interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  prompt_template: string;
  system_prompt_override: string | null;
  suggested_cron: string;
  suggested_skills: string[];
  default_model: string;
  default_max_tokens: number;
  variables: TemplateVariable[];
  is_featured: boolean;
  usage_count: number;
}

interface AIBuilderSuggestion {
  name: string;
  description: string;
  prompt: string;
  cron_expression: string;
  model: string;
  max_tokens: number;
  temperature: number;
  tags: string[];
  skill_ids: string[];
}

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "alle", label: "Alle" },
  { value: "Produktivitat", label: "Produktivitat" },
  { value: "Monitoring", label: "Monitoring" },
  { value: "Sicherheit", label: "Sicherheit" },
  { value: "Reporting", label: "Reporting" },
  { value: "Daten", label: "Daten" },
  { value: "Kommunikation", label: "Kommunikation" },
  { value: "Lernen", label: "Lernen" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Produktivitat: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Monitoring: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Sicherheit: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Reporting: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Daten: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Kommunikation: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Lernen: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
};

// ─── Skeleton Components ──────────────────────────────────────────────────────

function TemplateSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-7 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Use Template Dialog ──────────────────────────────────────────────────────

function UseTemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: TemplateResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [cronOverride, setCronOverride] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (template) {
      const defaults: Record<string, string> = {};
      for (const v of template.variables) {
        defaults[v.name] = v.default ?? "";
      }
      setVariableValues(defaults);
      setCronOverride("");
    }
  }, [template]);

  if (!template) return null;

  async function handleCreate() {
    if (!template) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        variable_values: variableValues,
      };
      if (cronOverride.trim()) {
        body.cron_expression = cronOverride.trim();
      }
      const result = await api.post<{ id: string }>(
        `/routines/from-template/${template.id}`,
        body
      );
      toast.success("Workflow aus Vorlage erstellt.");
      onOpenChange(false);
      router.push(`/routines/${result.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Erstellen.";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  const categoryColor =
    CATEGORY_COLORS[template.category] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{template.icon}</span>
            <div>
              <DialogTitle>{template.name}</DialogTitle>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${categoryColor}`}>
                {template.category}
              </span>
            </div>
          </div>
          <DialogDescription className="text-left">
            {template.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prompt Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Prompt-Vorlage
            </Label>
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground max-h-32 overflow-y-auto font-mono text-xs leading-relaxed">
              {template.prompt_template}
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {template.suggested_cron}
            </span>
            <span className="flex items-center gap-1">
              <Bot className="size-3" />
              {template.default_model}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {template.usage_count} mal verwendet
            </span>
          </div>

          {/* Variables */}
          {template.variables.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Anpassbare Felder
              </Label>
              {template.variables.map((variable) => (
                <div key={variable.name} className="space-y-1.5">
                  <Label htmlFor={`var-${variable.name}`}>
                    {variable.label}
                  </Label>
                  {variable.type === "textarea" ? (
                    <Textarea
                      id={`var-${variable.name}`}
                      value={variableValues[variable.name] ?? ""}
                      onChange={(e) =>
                        setVariableValues((prev) => ({
                          ...prev,
                          [variable.name]: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder={variable.default ?? ""}
                    />
                  ) : (
                    <Input
                      id={`var-${variable.name}`}
                      type={variable.type === "number" ? "number" : "text"}
                      value={variableValues[variable.name] ?? ""}
                      onChange={(e) =>
                        setVariableValues((prev) => ({
                          ...prev,
                          [variable.name]: e.target.value,
                        }))
                      }
                      placeholder={variable.default ?? ""}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Optional cron override */}
          <div className="space-y-1.5">
            <Label htmlFor="cron-override">
              Zeitplan uberschreiben (optional)
            </Label>
            <Input
              id="cron-override"
              placeholder={`Standardwert: ${template.suggested_cron}`}
              value={cronOverride}
              onChange={(e) => setCronOverride(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leer lassen um den empfohlenen Zeitplan zu verwenden.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
            {creating ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                Erstellen...
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                Workflow erstellen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AI Builder Section ───────────────────────────────────────────────────────

function AIBuilderSection() {
  const router = useRouter();
  const availableModels = useAvailableModels();
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<AIBuilderSuggestion | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedSuggestion, setEditedSuggestion] = useState<AIBuilderSuggestion | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleGenerate() {
    if (!description.trim()) {
      toast.error("Bitte beschreibe deinen gewunschten Workflow.");
      return;
    }
    setGenerating(true);
    setSuggestion(null);
    setEditing(false);
    try {
      const result = await api.post<AIBuilderSuggestion>("/routines/ai-builder", {
        description: description.trim(),
      });
      setSuggestion(result);
      setEditedSuggestion(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Generieren.";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateFromSuggestion() {
    const data = editing ? editedSuggestion : suggestion;
    if (!data) return;
    setCreating(true);
    try {
      const result = await api.post<{ id: string }>("/routines", {
        name: data.name,
        description: data.description,
        prompt: data.prompt,
        cron_expression: data.cron_expression,
        model: data.model,
        max_tokens: data.max_tokens,
        temperature: data.temperature,
        tags: data.tags,
        skill_ids: data.skill_ids,
      });
      toast.success("Workflow erfolgreich erstellt.");
      router.push(`/routines/${result.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Erstellen.";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  const activeSuggestion = editing ? editedSuggestion : suggestion;

  return (
    <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-primary/10 p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-primary/10 p-2">
          <Wand2 className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-base">KI-Assistent</h2>
          <p className="text-xs text-muted-foreground">
            Beschreibe deinen Workflow — die KI konfiguriert alles automatisch
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Beschreibe deinen gewunschten Workflow... z.B. 'Jeden Morgen eine Zusammenfassung meiner E-Mails und Kalendertermine erstellen'"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="bg-background/60 resize-none"
        />
        <Button
          onClick={handleGenerate}
          disabled={generating || !description.trim()}
          className="gap-2 w-full sm:w-auto"
        >
          {generating ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Generiere...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generieren
            </>
          )}
        </Button>
      </div>

      {/* Result Preview */}
      {activeSuggestion && (
        <div className="rounded-lg border bg-background/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Generierter Vorschlag</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                setEditing(!editing);
                if (!editing) setEditedSuggestion(suggestion);
              }}
            >
              {editing ? (
                <>
                  <X className="size-3" />
                  Abbrechen
                </>
              ) : (
                <>
                  <Pencil className="size-3" />
                  Anpassen
                </>
              )}
            </Button>
          </div>

          {editing && editedSuggestion ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs">Name</Label>
                <Input
                  id="edit-name"
                  value={editedSuggestion.name}
                  onChange={(e) =>
                    setEditedSuggestion((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc" className="text-xs">Beschreibung</Label>
                <Input
                  id="edit-desc"
                  value={editedSuggestion.description}
                  onChange={(e) =>
                    setEditedSuggestion((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-prompt" className="text-xs">Prompt</Label>
                <Textarea
                  id="edit-prompt"
                  value={editedSuggestion.prompt}
                  onChange={(e) =>
                    setEditedSuggestion((prev) =>
                      prev ? { ...prev, prompt: e.target.value } : prev
                    )
                  }
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-cron" className="text-xs">Cron-Ausdruck</Label>
                  <Input
                    id="edit-cron"
                    value={editedSuggestion.cron_expression}
                    onChange={(e) =>
                      setEditedSuggestion((prev) =>
                        prev ? { ...prev, cron_expression: e.target.value } : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-model" className="text-xs flex items-center gap-1.5">
                    <Brain className="size-3 text-muted-foreground" />
                    KI-Modell
                  </Label>
                  <ModelSelector
                    id="edit-model"
                    value={editedSuggestion.model}
                    onValueChange={(v) =>
                      setEditedSuggestion((prev) =>
                        prev ? { ...prev, model: v } : prev
                      )
                    }
                    models={availableModels}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">{activeSuggestion.name}</span>
                {activeSuggestion.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeSuggestion.description}
                  </p>
                )}
              </div>
              <div className="rounded-md bg-muted p-2.5 text-xs font-mono text-muted-foreground line-clamp-3">
                {activeSuggestion.prompt}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {activeSuggestion.cron_expression}
                </span>
                <span className="flex items-center gap-1">
                  <Bot className="size-3" />
                  {activeSuggestion.model}
                </span>
              </div>
              {activeSuggestion.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {activeSuggestion.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleCreateFromSuggestion}
            disabled={creating}
            size="sm"
            className="gap-1.5 w-full"
          >
            {creating ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                Erstellen...
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                Workflow erstellen
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onClick,
}: {
  template: TemplateResponse;
  onClick: () => void;
}) {
  const categoryColor =
    CATEGORY_COLORS[template.category] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:bg-muted/20 group relative"
      onClick={onClick}
    >
      {template.is_featured && (
        <div className="absolute top-3 right-3">
          <Badge className="gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-0">
            <Star className="size-3 fill-current" />
            Featured
          </Badge>
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0 leading-none mt-0.5">
            {template.icon}
          </span>
          <div className="min-w-0 flex-1 pr-16">
            <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
              {template.name}
            </p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {template.description}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor}`}
            >
              {template.category}
            </span>
            {template.usage_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3" />
                {template.usage_count}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <Sparkles className="size-3" />
            Verwenden
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty Templates State ────────────────────────────────────────────────────

function EmptyTemplatesState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3 col-span-full">
      <div className="rounded-full bg-muted p-5">
        <Search className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">Keine Vorlagen gefunden</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {query
            ? `Keine Vorlagen fur "${query}" vorhanden. Versuche einen anderen Suchbegriff.`
            : "Keine Vorlagen in dieser Kategorie vorhanden."}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("alle");
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ templates: TemplateResponse[] }>(
        "/routines/templates"
      );
      setTemplates(data.templates ?? []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Laden der Vorlagen.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filtered = templates.filter((t) => {
    const matchesCategory =
      category === "alle" || t.category === category;
    const matchesSearch =
      !search.trim() ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  function handleSelectTemplate(template: TemplateResponse) {
    setSelectedTemplate(template);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 -ml-1 shrink-0 mt-0.5"
          onClick={() => router.push("/routines")}
        >
          <ChevronLeft className="size-4" />
          Workflows
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Workflow-Vorlagen
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Starte mit einer Vorlage oder lass die KI deinen Workflow erstellen
          </p>
        </div>
      </div>

      {/* AI Builder */}
      <AIBuilderSection />

      {/* Template Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-base">Vorlagen-Bibliothek</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Vorlagen suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
            {CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.value}
                value={cat.value}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full text-xs px-3 py-1 h-7 border border-border data-[state=inactive]:bg-transparent"
              >
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <TemplateSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid grid-cols-1">
            <EmptyTemplatesState query={search} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => handleSelectTemplate(template)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Use Template Dialog */}
      <UseTemplateDialog
        template={selectedTemplate}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
