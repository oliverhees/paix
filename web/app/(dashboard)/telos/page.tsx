"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Clock,
  Brain,
  Plus,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Target,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { useTelosStore, type TelosDimension } from "@/lib/stores/telos-store";
import type { TelosEntry } from "@/lib/telos-service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ── Relative Time ──────────────────────────────────── */

function formatLastUpdated(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return "vor weniger als 1 Stunde";
  if (hours < 24) return `vor ${hours} Stunde${hours > 1 ? "n" : ""}`;
  if (days < 7) return `vor ${days} Tag${days > 1 ? "en" : ""}`;
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ── Entry Item Component ───────────────────────────── */

function EntryItem({
  entry,
  dimensionId,
  onDelete,
  onConfirm,
}: {
  entry: TelosEntry;
  dimensionId: string;
  onDelete: (entryId: string) => void;
  onConfirm: (entryId: string) => void;
}) {
  const isAgent = entry.source === "agent";
  const needsReview = entry.status === "review_needed";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-md border p-3 text-sm transition-colors",
        isAgent && needsReview
          ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
          : "border-border"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="whitespace-pre-wrap">{entry.content}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge
            variant={isAgent ? "success" : "secondary"}
            className="text-[10px]"
          >
            {isAgent ? "Agent" : "Nutzer"}
          </Badge>
          {needsReview && (
            <Badge variant="warning" className="text-[10px]">
              Review
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {needsReview && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-600 hover:text-green-700"
            onClick={() => onConfirm(entry.id)}
            title="Bestätigen"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(entry.id)}
          title="Löschen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ── Dimension Editor Card ──────────────────────────── */

function DimensionEditor({ dimension }: { dimension: TelosDimension }) {
  const { saveDimension, addEntry, deleteEntry, confirmEntry } =
    useTelosStore();
  const [content, setContent] = useState(dimension.content);
  const [hasChanges, setHasChanges] = useState(false);
  const [newEntryContent, setNewEntryContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showEntries, setShowEntries] = useState(false);

  useEffect(() => {
    setContent(dimension.content);
    setHasChanges(false);
  }, [dimension.content, dimension.id]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(value !== dimension.content);
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveDimension(dimension.id, content);
      setHasChanges(false);
      toast.success(`${dimension.name} gespeichert`);
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }, [content, dimension.id, dimension.name, saveDimension]);

  const handleAddEntry = useCallback(async () => {
    if (!newEntryContent.trim()) return;
    await addEntry(dimension.id, newEntryContent.trim());
    setNewEntryContent("");
    toast.success("Eintrag hinzugefügt");
  }, [newEntryContent, dimension.id, addEntry]);

  const handleDeleteEntry = useCallback(
    async (entryId: string) => {
      await deleteEntry(dimension.id, entryId);
      toast.success("Eintrag gelöscht");
    },
    [dimension.id, deleteEntry]
  );

  const handleConfirmEntry = useCallback(
    async (entryId: string) => {
      await confirmEntry(dimension.id, entryId);
      toast.success("Agent-Vorschlag bestätigt");
    },
    [dimension.id, confirmEntry]
  );

  const activeEntries = dimension.entries.filter(
    (e) => e.status !== "archived"
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{dimension.name}</CardTitle>
            <CardDescription>{dimension.description}</CardDescription>
          </div>
          <Badge
            variant={dimension.updatedBy === "agent" ? "success" : "secondary"}
            className="shrink-0"
          >
            {dimension.updatedBy === "agent" ? "Agent" : "Nutzer"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Free-text editor */}
        <Textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="min-h-[200px] font-mono text-sm"
          placeholder={`Beschreibe deine ${dimension.name}...`}
        />

        {/* Agent Additions */}
        {dimension.agentAdditions && dimension.agentAdditions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Ergänzungen von PAIONE:
            </p>
            {dimension.agentAdditions.map((addition, i) => (
              <div
                key={i}
                className="rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900/40 dark:bg-green-950/20"
              >
                {addition}
              </div>
            ))}
          </div>
        )}

        {/* Structured Entries (collapsed by default) */}
        {activeEntries.length > 0 && (
          <>
            <Separator />
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEntries(!showEntries)}
                className="mb-2 text-xs text-muted-foreground"
              >
                {showEntries ? "Einträge ausblenden" : `${activeEntries.length} Einträge anzeigen`}
              </Button>
              {showEntries && (
                <div className="space-y-2">
                  {activeEntries.map((entry) => (
                    <EntryItem
                      key={entry.id}
                      entry={entry}
                      dimensionId={dimension.id}
                      onDelete={handleDeleteEntry}
                      onConfirm={handleConfirmEntry}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Add New Entry */}
        <div className="flex gap-2">
          <Input
            value={newEntryContent}
            onChange={(e) => setNewEntryContent(e.target.value)}
            placeholder="Neuen Eintrag hinzufügen..."
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddEntry();
              }
            }}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleAddEntry}
            disabled={!newEntryContent.trim()}
            title="Eintrag hinzufügen"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Zuletzt aktualisiert: {formatLastUpdated(dimension.lastUpdated)}
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          size="sm"
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Speichern
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ── Mobile Accordion ───────────────────────────────── */

function MobileAccordion({
  dimensions,
}: {
  dimensions: TelosDimension[];
}) {
  const [openId, setOpenId] = useState<string | null>(
    dimensions[0]?.id ?? null
  );

  return (
    <div className="space-y-2">
      {dimensions.map((dim) => (
        <div key={dim.id} className="rounded-lg border">
          <button
            onClick={() => setOpenId(openId === dim.id ? null : dim.id)}
            className={cn(
              "flex w-full items-center justify-between p-4 text-left text-sm font-medium transition-colors hover:bg-accent",
              openId === dim.id && "border-b"
            )}
          >
            <span>{dim.name}</span>
            <Badge
              variant={dim.updatedBy === "agent" ? "success" : "secondary"}
              className="text-[10px]"
            >
              {dim.updatedBy === "agent" ? "Agent" : "Nutzer"}
            </Badge>
          </button>
          {openId === dim.id && (
            <div className="p-2">
              <DimensionEditor dimension={dim} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── TELOS Explainer ────────────────────────────────── */

function TelosExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <span className="font-medium">Was ist TELOS und wie nutze ich es?</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <CardContent className="space-y-5 border-t pt-4">
          {/* Was ist TELOS */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Brain className="h-4 w-4 text-primary" />
              Was ist TELOS?
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              TELOS ist dein <strong>Identity Layer</strong> — dein persönliches Profil, das PAIONE
              sagt, wer du bist, was dir wichtig ist und wohin du willst. Je mehr du hier einträgst,
              desto besser kann PAIONE dich unterstützen, weil es den Kontext deines Lebens versteht.
            </p>
          </div>

          {/* Warum TELOS */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Target className="h-4 w-4 text-primary" />
              Warum ist das wichtig?
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ohne TELOS ist PAIONE ein generischer Assistent. <strong>Mit</strong> TELOS wird es zu
              deinem persönlichen Berater: Es kennt deine Ziele, versteht deine Herausforderungen
              und kann proaktiv Vorschläge machen, die zu deinem Leben passen.
            </p>
          </div>

          {/* Die 10 Dimensionen */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Die 10 Dimensionen
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { name: "Mission", desc: "Dein übergeordneter Lebenszweck" },
                { name: "Ziele", desc: "Konkrete Ziele für die nächsten Monate" },
                { name: "Projekte", desc: "Woran du gerade arbeitest" },
                { name: "Überzeugungen", desc: "Deine Kernwerte und Annahmen" },
                { name: "Modelle", desc: "Mentale Frameworks, die du nutzt" },
                { name: "Strategien", desc: "Wie du deine Ziele erreichst" },
                { name: "Narrative", desc: "Geschichten, die du erzählst" },
                { name: "Gelerntes", desc: "Erkenntnisse und Lessons Learned" },
                { name: "Herausforderungen", desc: "Aktuelle Hindernisse" },
                { name: "Ideen", desc: "Neue Einfälle und Möglichkeiten" },
              ].map((d) => (
                <div key={d.name} className="rounded-md border bg-background p-2.5 text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground"> — {d.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Wie nutze ich es */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Lightbulb className="h-4 w-4 text-primary" />
              So nutzt du TELOS am besten
            </h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-medium text-foreground">1.</span>
                <span>
                  <strong>Fang mit der Mission an</strong> — Was treibt dich an? Ein Satz reicht.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">2.</span>
                <span>
                  <strong>Trage deine Ziele ein</strong> — Was willst du in den nächsten 3-12 Monaten
                  erreichen?
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">3.</span>
                <span>
                  <strong>Fülle nach und nach</strong> — Du musst nicht alles auf einmal ausfüllen.
                  Komm immer wieder zurück.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">4.</span>
                <span>
                  <strong>PAIONE lernt mit</strong> — Im Chat kann PAIONE Vorschläge machen, die hier
                  als grüne Einträge erscheinen. Du bestätigst oder löschst sie.
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ── Main TELOS Page ────────────────────────────────── */

export default function TelosPage() {
  const {
    dimensions,
    activeDimension,
    setActiveDimension,
    isLoading,
    error,
    fetchAllDimensions,
  } = useTelosStore();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fetch from backend on mount
  useEffect(() => {
    fetchAllDimensions();
  }, [fetchAllDimensions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <Brain className="h-8 w-8" />
          TELOS
        </h1>
        <p className="text-muted-foreground">
          Dein Identity Layer — 10 Dimensionen, die PAIONE sagen, wer du bist.
        </p>
      </div>

      {/* Explainer */}
      <TelosExplainer />

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <>
          {isMobile ? (
            <MobileAccordion dimensions={dimensions} />
          ) : (
            <Tabs
              value={activeDimension}
              onValueChange={setActiveDimension}
              className="space-y-4"
            >
              <ScrollArea className="w-full">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
                  {dimensions.map((dim) => (
                    <TabsTrigger
                      key={dim.id}
                      value={dim.id}
                      className="px-3 text-xs"
                    >
                      {dim.name}
                      {dim.agentAdditions.length > 0 && (
                        <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] text-white">
                          {dim.agentAdditions.length}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>

              {dimensions.map((dim) => (
                <TabsContent key={dim.id} value={dim.id}>
                  <DimensionEditor dimension={dim} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
