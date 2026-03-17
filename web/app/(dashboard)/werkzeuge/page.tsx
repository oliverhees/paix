"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wrench,
  Plus,
  Search,
  Loader2,
  Zap,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  Info,
  Check,
  ExternalLink,
  Library,
  Settings2,
  Globe,
  X,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  settingsService,
  type McpServer,
  type McpServerRequest,
  type McpServerUpdateRequest,
  type ApiWerkzeug,
  type ApiWerkzeugRequest,
  type ApiEndpointDef,
} from "@/lib/settings-service";
import {
  WERKZEUG_PRESETS,
  WERKZEUG_CATEGORIES,
  type WerkzeugPreset,
} from "@/lib/werkzeuge-presets";

// ── Helpers ──

type TransportType = "stdio" | "sse" | "streamable_http";

function parseAddress(address: string): {
  transport_type: TransportType;
  config: Record<string, unknown>;
} {
  const trimmed = address.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return { transport_type: "streamable_http", config: { url: trimmed } };
  }
  const parts = trimmed.split(/\s+/);
  return {
    transport_type: "stdio",
    config: {
      command: parts[0] || "",
      ...(parts.length > 1 ? { args: parts.slice(1) } : {}),
    },
  };
}

function configToAddress(
  transport_type: string,
  config: Record<string, unknown>
): string {
  if (transport_type !== "stdio") {
    return typeof config?.url === "string" ? config.url : "";
  }
  const cmd = typeof config?.command === "string" ? config.command : "";
  const args = Array.isArray(config?.args)
    ? (config.args as string[]).join(" ")
    : "";
  return [cmd, args].filter(Boolean).join(" ");
}

// ── Preset Card ──

function PresetCard({
  preset,
  installed,
  installing,
  onInstall,
}: {
  preset: WerkzeugPreset;
  installed: boolean;
  installing: boolean;
  onInstall: (preset: WerkzeugPreset, env?: Record<string, string>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const hasRequirements = Object.keys(preset.requirements).length > 0;
  const reqKeys = Object.keys(preset.requirements);
  const [credentials, setCredentials] = useState<Record<string, string>>(
    () => Object.fromEntries(reqKeys.map((k) => [k, ""]))
  );

  const allFilled = reqKeys.every((k) => credentials[k]?.trim());

  function handleConnect(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (hasRequirements && !showCredentials) {
      // Open the card and show credential form
      setExpanded(true);
      setShowCredentials(true);
      return;
    }
    if (hasRequirements && !allFilled) return;
    onInstall(preset, hasRequirements ? credentials : undefined);
  }

  return (
    <div className="rounded-lg border bg-card transition-colors hover:border-primary/30">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Wrench className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{preset.name}</p>
            {installed && (
              <Badge
                variant="secondary"
                className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
              >
                <Check className="size-3" />
                Verbunden
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {preset.summary}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!installed && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              disabled={installing}
              onClick={handleConnect}
            >
              {installing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Verbinden
            </Button>
          )}
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <p className="text-sm text-muted-foreground">{preset.description}</p>

          <div>
            <p className="text-xs font-medium mb-1.5">Funktionen</p>
            <div className="flex flex-wrap gap-1.5">
              {preset.features.map((f) => (
                <Badge key={f} variant="secondary" className="text-xs">
                  {f}
                </Badge>
              ))}
            </div>
          </div>

          {/* Credential Form — shown when user clicks Verbinden on a preset with requirements */}
          {hasRequirements && showCredentials && !installed && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-xs font-medium">
                Zugangsdaten eingeben
              </p>
              {Object.entries(preset.requirements).map(([key, desc]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`cred-${preset.id}-${key}`} className="text-xs">
                    {key}
                  </Label>
                  <Input
                    id={`cred-${preset.id}-${key}`}
                    type="password"
                    placeholder={desc}
                    value={credentials[key] || ""}
                    onChange={(e) =>
                      setCredentials((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className="font-mono text-xs h-8"
                    disabled={installing}
                  />
                </div>
              ))}
              {preset.hint && (
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <Info className="size-3.5 shrink-0 mt-0.5" />
                  {preset.hint}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={installing || !allFilled}
                  onClick={handleConnect}
                >
                  {installing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Zap className="size-3.5" />
                  )}
                  Jetzt verbinden
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCredentials(false)}
                  disabled={installing}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {/* Static info — shown when NOT in credential-entry mode */}
          {hasRequirements && !showCredentials && (
            <div>
              <p className="text-xs font-medium mb-1.5">
                Voraussetzungen
              </p>
              <div className="space-y-1.5">
                {Object.entries(preset.requirements).map(([key, desc]) => (
                  <div
                    key={key}
                    className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-1.5"
                  >
                    <code className="text-xs font-mono text-primary shrink-0 mt-px">
                      {key}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasRequirements && preset.hint && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              {preset.hint}
            </div>
          )}

          {!installed && !showCredentials && (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={installing}
              onClick={handleConnect}
            >
              {installing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {hasRequirements ? "Zugangsdaten eingeben" : "Werkzeug verbinden"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit Werkzeug Dialog ──

function EditWerkzeugDialog({
  server,
  open,
  onOpenChange,
  onSave,
}: {
  server: McpServer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: McpServerUpdateRequest) => Promise<void>;
}) {
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description || "");
  const [transportType, setTransportType] = useState<TransportType>(
    server.transport_type
  );
  const [address, setAddress] = useState(
    configToAddress(server.transport_type, server.config)
  );
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>(
    () => {
      const env =
        server.config?.env && typeof server.config.env === "object"
          ? (server.config.env as Record<string, string>)
          : {};
      const entries = Object.entries(env);
      return entries.length > 0
        ? entries.map(([key, value]) => ({ key, value: String(value) }))
        : [{ key: "", value: "" }];
    }
  );
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens with new server data
  useEffect(() => {
    if (open) {
      setName(server.name);
      setDescription(server.description || "");
      setTransportType(server.transport_type);
      setAddress(configToAddress(server.transport_type, server.config));
      const env =
        server.config?.env && typeof server.config.env === "object"
          ? (server.config.env as Record<string, string>)
          : {};
      const entries = Object.entries(env);
      setEnvPairs(
        entries.length > 0
          ? entries.map(([key, value]) => ({ key, value: String(value) }))
          : [{ key: "", value: "" }]
      );
    }
  }, [open, server]);

  function updateEnvPair(
    idx: number,
    field: "key" | "value",
    val: string
  ) {
    setEnvPairs((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p))
    );
  }

  function addEnvPair() {
    setEnvPairs((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeEnvPair(idx: number) {
    setEnvPairs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Build config from address/transport
      let config: Record<string, unknown>;
      if (transportType === "stdio") {
        const parts = address.trim().split(/\s+/);
        config = {
          command: parts[0] || "",
          ...(parts.length > 1 ? { args: parts.slice(1) } : {}),
        };
      } else {
        config = { url: address.trim() };
      }

      // Add env vars
      const envObj: Record<string, string> = {};
      for (const pair of envPairs) {
        if (pair.key.trim()) {
          envObj[pair.key.trim()] = pair.value;
        }
      }
      if (Object.keys(envObj).length > 0) {
        config.env = envObj;
      }

      await onSave(server.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        transport_type: transportType,
        config,
      });
      onOpenChange(false);
      toast.success("Werkzeug aktualisiert");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Fehler beim Speichern"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Werkzeug bearbeiten</DialogTitle>
          <DialogDescription>
            Konfiguration von &quot;{server.name}&quot; anpassen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Beschreibung</Label>
            <Input
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              placeholder="Wofuer ist dieses Werkzeug?"
            />
          </div>

          {/* Transport Type */}
          <div className="space-y-1.5">
            <Label>Transport</Label>
            <Select
              value={transportType}
              onValueChange={(v) => setTransportType(v as TransportType)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">stdio (lokal)</SelectItem>
                <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                <SelectItem value="streamable_http">
                  Streamable HTTP
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Address / Command */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-address">
              {transportType === "stdio" ? "Befehl" : "URL"}
            </Label>
            <Input
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={saving}
              className="font-mono text-xs"
              placeholder={
                transportType === "stdio"
                  ? "npx -y @name/mcp-server"
                  : "https://..."
              }
            />
          </div>

          {/* Environment Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Umgebungsvariablen</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addEnvPair}
                disabled={saving}
                className="gap-1 h-7 text-xs"
              >
                <Plus className="size-3" /> Hinzufuegen
              </Button>
            </div>
            <div className="space-y-2">
              {envPairs.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="KEY"
                    value={pair.key}
                    onChange={(e) => updateEnvPair(idx, "key", e.target.value)}
                    disabled={saving}
                    className="font-mono text-xs flex-1"
                  />
                  <Input
                    placeholder="Wert"
                    value={pair.value}
                    onChange={(e) =>
                      updateEnvPair(idx, "value", e.target.value)
                    }
                    disabled={saving}
                    className="font-mono text-xs flex-1"
                    type="password"
                  />
                  {envPairs.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeEnvPair(idx)}
                      disabled={saving}
                      className="h-8 w-8 p-0 shrink-0 text-muted-foreground"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              z.B. GHOST_API_URL, GHOST_ADMIN_API_KEY, API_TOKEN etc.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !address.trim()}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Connected Werkzeug Card ──

function ConnectedCard({
  server,
  onToggle,
  onDelete,
  onUpdate,
}: {
  server: McpServer;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: McpServerUpdateRequest) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error: string | null;
  } | null>(null);

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(server.id, !server.active);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`"${server.name}" wirklich entfernen?`)) return;
    setDeleting(true);
    try {
      await onDelete(server.id);
    } finally {
      setDeleting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await settingsService.testWerkzeugConnection(server.id);
      setTestResult({ success: result.success, error: result.error });
      if (result.success) {
        toast.success(`Verbindung OK — ${result.tools_count} Tools`);
      } else {
        toast.error("Verbindungstest fehlgeschlagen");
      }
    } catch {
      setTestResult({ success: false, error: "Verbindung fehlgeschlagen" });
      toast.error("Verbindungstest fehlgeschlagen");
    } finally {
      setTesting(false);
    }
  }

  async function handleDiscover() {
    setDiscovering(true);
    try {
      const result = await settingsService.discoverWerkzeugTools(server.id);
      toast.success(`${result.discovered_tools} Tools erkannt`);
      await onUpdate(server.id, {});
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Tool-Erkennung fehlgeschlagen"
      );
    } finally {
      setDiscovering(false);
    }
  }

  const toolCount = server.tools.length;

  return (
    <div className="rounded-lg border bg-card">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{server.name}</p>
              {toolCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {toolCount} Tools
                </Badge>
              )}
            </div>
            {server.description && (
              <p className="text-xs text-muted-foreground truncate">
                {server.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Switch
            checked={server.active}
            onCheckedChange={handleToggle}
            disabled={toggling}
            onClick={(e) => e.stopPropagation()}
          />
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-4">
          {testResult && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                testResult.success
                  ? "border-green-500/30 bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-200"
                  : "border-red-500/30 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-200"
              }`}
            >
              {testResult.success
                ? "Verbindung erfolgreich"
                : `Fehler: ${testResult.error}`}
            </div>
          )}

          {/* Tools */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Tools ({toolCount})
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs gap-1"
                onClick={handleDiscover}
                disabled={discovering}
              >
                {discovering ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Aktualisieren
              </Button>
            </div>
            {toolCount > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {server.tools.map((t) => {
                  const name = typeof t === "string" ? t : t.name;
                  const desc =
                    typeof t === "string" ? undefined : t.description;
                  return (
                    <Badge
                      key={name}
                      variant="secondary"
                      className="text-xs font-mono"
                      title={desc}
                    >
                      {name}
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Keine Tools erkannt. Klicke &quot;Aktualisieren&quot; um Tools
                abzurufen.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
              className="gap-1.5"
            >
              <Pencil className="size-3.5" />
              Bearbeiten
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="gap-1.5"
            >
              {testing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5" />
              )}
              Verbindung testen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Entfernen
            </Button>
          </div>

          {/* Edit Dialog */}
          <EditWerkzeugDialog
            server={server}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSave={onUpdate}
          />
        </div>
      )}
    </div>
  );
}

// ── Custom Add Form ──

function AddCustomForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (data: McpServerRequest) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    const { transport_type, config } = parseAddress(address);
    await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      transport_type,
      config: Object.keys(config).length > 0 ? config : undefined,
    });
  }

  const isRemote =
    address.startsWith("http://") || address.startsWith("https://");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="custom-name">
          Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="custom-name"
          placeholder="z.B. mein-server"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom-address">
          Adresse <span className="text-red-500">*</span>
        </Label>
        <Input
          id="custom-address"
          placeholder="npx -y @name/mcp-server  oder  https://..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={saving}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          {isRemote
            ? "Remote-Server erkannt — wird per HTTPS verbunden"
            : "Lokaler Befehl — wird auf dem Server ausgefuhrt"}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom-desc">Beschreibung (optional)</Label>
        <Input
          id="custom-desc"
          placeholder="Wofür ist dieses Werkzeug?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={saving || !name.trim() || !address.trim()}
          className="gap-1.5"
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Speichern
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

// ── API Werkzeug Add Form ──

function AddApiForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (data: ApiWerkzeugRequest) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [description, setDescription] = useState("");
  const [authType, setAuthType] = useState<"none" | "bearer" | "header">(
    "none"
  );
  const [authToken, setAuthToken] = useState("");
  const [authKey, setAuthKey] = useState("");
  const [authValue, setAuthValue] = useState("");
  const [endpoints, setEndpoints] = useState<ApiEndpointDef[]>([
    {
      name: "",
      description: "",
      method: "GET",
      path: "/",
      parameters: { type: "object", properties: {}, required: [] },
    },
  ]);

  function updateEndpoint(idx: number, field: string, value: string) {
    setEndpoints((prev) =>
      prev.map((ep, i) => (i === idx ? { ...ep, [field]: value } : ep))
    );
  }

  function addEndpoint() {
    setEndpoints((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        method: "GET",
        path: "/",
        parameters: { type: "object", properties: {}, required: [] },
      },
    ]);
  }

  function removeEndpoint(idx: number) {
    setEndpoints((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) return;
    const validEndpoints = endpoints.filter((ep) => ep.name.trim());

    let auth: Record<string, unknown> = {};
    if (authType === "bearer" && authToken.trim()) {
      auth = { type: "bearer", token: authToken.trim() };
    } else if (authType === "header" && authKey.trim() && authValue.trim()) {
      auth = { type: "header", key: authKey.trim(), value: authValue.trim() };
    }

    await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      base_url: baseUrl.trim(),
      auth: Object.keys(auth).length > 0 ? auth : undefined,
      endpoints: validEndpoints.length > 0 ? validEndpoints : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="api-name">
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="api-name"
            placeholder="z.B. weather-api"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="api-url">
            Base URL <span className="text-red-500">*</span>
          </Label>
          <Input
            id="api-url"
            placeholder="https://api.example.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={saving}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="api-desc">Beschreibung (optional)</Label>
        <Input
          id="api-desc"
          placeholder="Wofür ist diese API?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving}
        />
      </div>

      {/* Auth */}
      <div className="space-y-2">
        <Label>Authentifizierung</Label>
        <div className="flex gap-2">
          {(["none", "bearer", "header"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={authType === t ? "default" : "outline"}
              onClick={() => setAuthType(t)}
              disabled={saving}
            >
              {t === "none" ? "Keine" : t === "bearer" ? "Bearer Token" : "API Key Header"}
            </Button>
          ))}
        </div>
        {authType === "bearer" && (
          <Input
            type="password"
            placeholder="Bearer Token"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            disabled={saving}
            className="font-mono text-xs"
          />
        )}
        {authType === "header" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Header Name (z.B. X-API-Key)"
              value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              disabled={saving}
              className="font-mono text-xs"
            />
            <Input
              type="password"
              placeholder="Header Wert"
              value={authValue}
              onChange={(e) => setAuthValue(e.target.value)}
              disabled={saving}
              className="font-mono text-xs"
            />
          </div>
        )}
      </div>

      {/* Endpoints */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Endpoints (Tools für den Chat)</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addEndpoint}
            disabled={saving}
            className="gap-1 h-7 text-xs"
          >
            <Plus className="size-3" /> Endpoint
          </Button>
        </div>
        {endpoints.map((ep, idx) => (
          <div key={idx} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Name (z.B. get_weather)"
                  value={ep.name}
                  onChange={(e) => updateEndpoint(idx, "name", e.target.value)}
                  disabled={saving}
                  className="font-mono text-xs"
                />
                <select
                  value={ep.method}
                  onChange={(e) => updateEndpoint(idx, "method", e.target.value)}
                  disabled={saving}
                  className="h-9 rounded-md border px-3 text-xs bg-background"
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <Input
                  placeholder="/path"
                  value={ep.path}
                  onChange={(e) => updateEndpoint(idx, "path", e.target.value)}
                  disabled={saving}
                  className="font-mono text-xs"
                />
              </div>
              {endpoints.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeEndpoint(idx)}
                  disabled={saving}
                  className="h-8 w-8 p-0 text-muted-foreground"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            <Input
              placeholder="Beschreibung (was macht dieser Endpoint?)"
              value={ep.description}
              onChange={(e) =>
                updateEndpoint(idx, "description", e.target.value)
              }
              disabled={saving}
              className="text-xs"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={saving || !name.trim() || !baseUrl.trim()}
          className="gap-1.5"
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Speichern
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

// ── API Werkzeug Card ──

function ApiCard({
  werkzeug,
  onToggle,
  onDelete,
}: {
  werkzeug: ApiWerkzeug;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error: string | null;
  } | null>(null);

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(werkzeug.id, !werkzeug.active);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`"${werkzeug.name}" wirklich entfernen?`)) return;
    setDeleting(true);
    try {
      await onDelete(werkzeug.id);
    } finally {
      setDeleting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await settingsService.testApiWerkzeugConnection(werkzeug.id);
      setTestResult({ success: result.success, error: result.error });
      if (result.success) {
        toast.success("API erreichbar");
      } else {
        toast.error("Verbindung fehlgeschlagen");
      }
    } catch {
      setTestResult({ success: false, error: "Verbindung fehlgeschlagen" });
    } finally {
      setTesting(false);
    }
  }

  const epCount = werkzeug.endpoints.length;

  return (
    <div className="rounded-lg border bg-card">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Globe className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{werkzeug.name}</p>
              {epCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {epCount} Endpoint{epCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate font-mono">
              {werkzeug.base_url}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Switch
            checked={werkzeug.active}
            onCheckedChange={handleToggle}
            disabled={toggling}
            onClick={(e) => e.stopPropagation()}
          />
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-4">
          {werkzeug.description && (
            <p className="text-sm text-muted-foreground">{werkzeug.description}</p>
          )}

          {testResult && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                testResult.success
                  ? "border-green-500/30 bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-200"
                  : "border-red-500/30 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-200"
              }`}
            >
              {testResult.success
                ? "API erreichbar"
                : `Fehler: ${testResult.error}`}
            </div>
          )}

          {/* Endpoints */}
          {epCount > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Endpoints ({epCount})
              </p>
              <div className="space-y-1.5">
                {werkzeug.endpoints.map((ep) => (
                  <div
                    key={ep.name}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5"
                  >
                    <Badge variant="outline" className="text-xs font-mono shrink-0">
                      {ep.method}
                    </Badge>
                    <code className="text-xs font-mono text-primary">{ep.name}</code>
                    <span className="text-xs text-muted-foreground truncate">
                      {ep.path}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="gap-1.5"
            >
              {testing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5" />
              )}
              Verbindung testen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Entfernen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

export default function WerkzeugePage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [apiWerkzeuge, setApiWerkzeuge] = useState<ApiWerkzeug[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [showApiForm, setShowApiForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingApi, setCreatingApi] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const [mcpData, apiData] = await Promise.all([
        settingsService.getWerkzeuge(),
        settingsService.getApiWerkzeuge(),
      ]);
      setServers(mcpData.werkzeuge ?? []);
      setApiWerkzeuge(apiData.api_werkzeuge ?? []);
    } catch {
      toast.error("Werkzeuge konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const installedNames = new Set(
    servers.map((s) => s.name.toLowerCase())
  );

  async function handleInstallPreset(
    preset: WerkzeugPreset,
    env?: Record<string, string>
  ) {
    setInstalling(preset.id);
    try {
      const { transport_type, config } = parseAddress(preset.address);
      // Merge credentials into config.env so the MCP client can use them
      if (env && Object.keys(env).length > 0) {
        config.env = env;
      }
      // Auto-set defaults for known presets
      if (preset.id === "ghost-cms") {
        if (!config.env) config.env = {};
        config.env.GHOST_API_VERSION = "v5.0";
      }
      const result = await settingsService.createWerkzeug({
        name: preset.id,
        description: preset.summary,
        transport_type,
        config,
      });
      setServers((prev) => [...prev, result.werkzeug]);
      if (result.discovered_tools > 0) {
        toast.success(
          `${preset.name} verbunden — ${result.discovered_tools} Tools erkannt`
        );
      } else {
        toast.success(`${preset.name} verbunden`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Verbindung fehlgeschlagen"
      );
    } finally {
      setInstalling(null);
    }
  }

  async function handleCreateCustom(data: McpServerRequest) {
    setCreating(true);
    try {
      const result = await settingsService.createWerkzeug(data);
      setServers((prev) => [...prev, result.werkzeug]);
      setShowCustom(false);
      if (result.discovered_tools > 0) {
        toast.success(
          `Werkzeug verbunden — ${result.discovered_tools} Tools erkannt`
        );
      } else {
        toast.success("Werkzeug verbunden");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Fehler beim Erstellen"
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      const result = await settingsService.updateWerkzeug(id, { active });
      setServers((prev) =>
        prev.map((s) => (s.id === id ? result.werkzeug : s))
      );
      toast.success(active ? "Werkzeug aktiviert" : "Werkzeug deaktiviert");
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  }

  async function handleDelete(id: string) {
    try {
      await settingsService.deleteWerkzeug(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
      toast.success("Werkzeug entfernt");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  async function handleUpdate(id: string, data: McpServerUpdateRequest) {
    try {
      const result = await settingsService.updateWerkzeug(id, data);
      setServers((prev) =>
        prev.map((s) => (s.id === id ? result.werkzeug : s))
      );
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  }

  // ── API Werkzeug Handlers ──

  async function handleCreateApi(data: ApiWerkzeugRequest) {
    setCreatingApi(true);
    try {
      const result = await settingsService.createApiWerkzeug(data);
      setApiWerkzeuge((prev) => [...prev, result.api_werkzeug]);
      setShowApiForm(false);
      toast.success("API Werkzeug erstellt");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Fehler beim Erstellen"
      );
    } finally {
      setCreatingApi(false);
    }
  }

  async function handleToggleApi(id: string, active: boolean) {
    try {
      const result = await settingsService.updateApiWerkzeug(id, { active });
      setApiWerkzeuge((prev) =>
        prev.map((w) => (w.id === id ? result.api_werkzeug : w))
      );
      toast.success(active ? "API aktiviert" : "API deaktiviert");
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  }

  async function handleDeleteApi(id: string) {
    try {
      await settingsService.deleteApiWerkzeug(id);
      setApiWerkzeuge((prev) => prev.filter((w) => w.id !== id));
      toast.success("API Werkzeug entfernt");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }

  // Filter presets
  const filteredPresets = WERKZEUG_PRESETS.filter((p) => {
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by category
  const grouped = new Map<string, WerkzeugPreset[]>();
  for (const p of filteredPresets) {
    const list = grouped.get(p.category) || [];
    list.push(p);
    grouped.set(p.category, list);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Werkzeuge</h1>
        <p className="text-muted-foreground">
          Verbinde externe Dienste und erweitere die Möglichkeiten deines
          Assistenten.
        </p>
      </div>

      <Tabs defaultValue="bibliothek">
        <TabsList>
          <TabsTrigger value="bibliothek" className="gap-2">
            <Library className="size-4" />
            Bibliothek
          </TabsTrigger>
          <TabsTrigger value="meine" className="gap-2">
            <Settings2 className="size-4" />
            Meine Werkzeuge
            {servers.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {servers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="apis" className="gap-2">
            <Globe className="size-4" />
            REST APIs
            {apiWerkzeuge.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {apiWerkzeuge.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Library Tab ── */}
        <TabsContent value="bibliothek" className="space-y-4 mt-4">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Werkzeug suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                className="h-9"
              >
                Alle
              </Button>
              {WERKZEUG_CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={selectedCategory === cat ? "default" : "outline"}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat ? null : cat)
                  }
                  className="h-9"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Preset Grid */}
          {filteredPresets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                Keine Werkzeuge gefunden für &quot;{searchQuery}&quot;
              </p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, presets]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  {category}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {presets.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      installed={installedNames.has(preset.id)}
                      installing={installing === preset.id}
                      onInstall={handleInstallPreset}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Custom Section */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">
                  Eigenes Werkzeug verbinden
                </h3>
                <p className="text-xs text-muted-foreground">
                  Verbinde einen eigenen MCP-Server oder eine URL
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setShowCustom((v) => !v)}
              >
                <Plus className="size-3.5" />
                Eigenes hinzufügen
              </Button>
            </div>
            {showCustom && (
              <Card>
                <CardContent className="pt-4">
                  <AddCustomForm
                    onSave={handleCreateCustom}
                    onCancel={() => setShowCustom(false)}
                    saving={creating}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── My Tools Tab ── */}
        <TabsContent value="meine" className="space-y-4 mt-4">
          {servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-lg border border-dashed">
              <Wrench className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  Noch keine Werkzeuge verbunden
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gehe zur Bibliothek und verbinde dein erstes Werkzeug
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => (
                <ConnectedCard
                  key={server.id}
                  server={server}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Verbundene Werkzeuge stehen automatisch im Chat zur Verfügung.
              Die erkannten Tools können einzelnen Skills zugewiesen werden.
            </p>
          </div>
        </TabsContent>

        {/* ── REST API Tab ── */}
        <TabsContent value="apis" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">REST API Werkzeuge</h3>
              <p className="text-xs text-muted-foreground">
                Verbinde beliebige REST APIs als Tools für deinen Assistenten
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setShowApiForm((v) => !v)}
            >
              <Plus className="size-3.5" />
              API hinzufügen
            </Button>
          </div>

          {showApiForm && (
            <Card>
              <CardContent className="pt-4">
                <AddApiForm
                  onSave={handleCreateApi}
                  onCancel={() => setShowApiForm(false)}
                  saving={creatingApi}
                />
              </CardContent>
            </Card>
          )}

          {apiWerkzeuge.length === 0 && !showApiForm ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-lg border border-dashed">
              <Globe className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  Noch keine APIs verbunden
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Füge eine REST API hinzu um sie als Tool im Chat zu nutzen
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {apiWerkzeuge.map((w) => (
                <ApiCard
                  key={w.id}
                  werkzeug={w}
                  onToggle={handleToggleApi}
                  onDelete={handleDeleteApi}
                />
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Jeder Endpoint wird als eigenes Tool im Chat verfügbar. Der Assistent
              kann die API automatisch aufrufen wenn es zur Anfrage passt.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
