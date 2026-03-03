"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Bell,
  ShieldCheck,
  Palette,
  Sun,
  Moon,
  Monitor,
  Check,
  X,
  Loader2,
  Save,
  Send,
  Info,
  Key,
  Eye,
  EyeOff,
  Trash2,
  Wrench,
  Plus,
  ChevronDown,
  ChevronUp,
  Bot,
  Brain,
  Clock,
} from "lucide-react";
import {
  settingsService,
  type McpServer,
  type McpServerRequest,
  type McpServerUpdateRequest,
} from "@/lib/settings-service";
import { useTheme } from "next-themes";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { AgentStateEntry, AgentStateResponse } from "@/lib/types/auth";

/* ── Profile Section ─────────────────────────────────── */

function ProfileSection() {
  const { profile, profileLoading, fetchProfile } = useSettingsStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setTimezone(profile.timezone);
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
    try {
      await api.put("/auth/me", { name, timezone });
      toast.success("Profil gespeichert");
      setHasChanges(false);
    } catch (err) {
      toast.error("Fehler beim Speichern");
    }
  }, [name, timezone]);

  if (profileLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Deine persoenlichen Daten</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasChanges(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setHasChanges(true);
              }}
            />
          </div>
        </div>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="timezone">Zeitzone</Label>
          <Select
            value={timezone}
            onValueChange={(value) => {
              setTimezone(value);
              setHasChanges(true);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Zeitzone waehlen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Europe/Berlin">
                Europe/Berlin (CET)
              </SelectItem>
              <SelectItem value="Europe/London">
                Europe/London (GMT)
              </SelectItem>
              <SelectItem value="America/New_York">
                America/New_York (EST)
              </SelectItem>
              <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {profile?.created_at && (
          <p className="text-xs text-muted-foreground">
            Mitglied seit:{" "}
            {new Date(profile.created_at).toLocaleDateString("de-DE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}

        <Separator />
        <Button onClick={handleSave} disabled={!hasChanges} className="gap-2">
          <Save className="h-4 w-4" />
          Profil speichern
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Notifications Section ────────────────────────────── */

function NotificationsSection() {
  const {
    notificationSettings,
    notificationSettingsLoading,
    fetchNotificationSettings,
    updateNotificationSettings,
    sendTestNotification,
  } = useSettingsStore();
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetchNotificationSettings();
  }, [fetchNotificationSettings]);

  const handleToggle = useCallback(
    (key: string, value: boolean) => {
      updateNotificationSettings({ [key]: value });
      toast.success("Einstellung aktualisiert");
    },
    [updateNotificationSettings]
  );

  const handleChannelToggle = useCallback(
    (channel: string) => {
      if (!notificationSettings) return;
      const newChannels = {
        ...notificationSettings.channels,
        [channel]: !notificationSettings.channels[channel],
      };
      updateNotificationSettings({ channels: newChannels });
      toast.success(`${channel} ${newChannels[channel] ? "aktiviert" : "deaktiviert"}`);
    },
    [notificationSettings, updateNotificationSettings]
  );

  const handleTest = useCallback(
    async (channel: string) => {
      setIsTesting(true);
      try {
        await sendTestNotification(channel);
        toast.success(`Test-Benachrichtigung an ${channel} gesendet`);
      } catch {
        toast.error("Test fehlgeschlagen");
      } finally {
        setIsTesting(false);
      }
    },
    [sendTestNotification]
  );

  if (notificationSettingsLoading || !notificationSettings) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const triggers = [
    {
      key: "daily_briefing_enabled",
      label: "Tages-Briefing",
      description: `Taeglich um ${notificationSettings.daily_briefing_time}`,
      enabled: notificationSettings.daily_briefing_enabled,
    },
    {
      key: "pre_meeting_enabled",
      label: "Pre-Meeting Alert",
      description: `${notificationSettings.pre_meeting_minutes} Min vor jedem Termin`,
      enabled: notificationSettings.pre_meeting_enabled,
    },
    {
      key: "follow_up_enabled",
      label: "Follow-up Erinnerung",
      description: `${notificationSettings.follow_up_hours} Std nach wichtigen Meetings`,
      enabled: notificationSettings.follow_up_enabled,
    },
    {
      key: "deadline_warning_enabled",
      label: "Deadline-Warnung",
      description: `${notificationSettings.deadline_warning_hours} Std vor einer Deadline`,
      enabled: notificationSettings.deadline_warning_enabled,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Trigger Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Benachrichtigungs-Trigger</CardTitle>
          <CardDescription>
            Steuere, welche proaktiven Trigger aktiv sein sollen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {triggers.map((trigger) => (
            <div
              key={trigger.key}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{trigger.label}</p>
                <p className="text-xs text-muted-foreground">
                  {trigger.description}
                </p>
              </div>
              <Switch
                checked={trigger.enabled}
                onCheckedChange={(checked) =>
                  handleToggle(trigger.key, checked)
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle>Kanaele</CardTitle>
          <CardDescription>
            Ueber welche Kanaele PAI-X dich erreichen darf.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(notificationSettings.channels).map(
            ([channel, enabled]) => (
              <div
                key={channel}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-bold uppercase">
                    {channel.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {channel.replace("_", " ")}
                    </p>
                    <Badge
                      variant={enabled ? "success" : "secondary"}
                      className="mt-0.5"
                    >
                      {enabled ? (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3" /> Aktiv
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <X className="h-3 w-3" /> Inaktiv
                        </span>
                      )}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {enabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(channel)}
                      disabled={isTesting}
                      className="gap-1"
                    >
                      {isTesting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Test
                    </Button>
                  )}
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => handleChannelToggle(channel)}
                  />
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Autonomy Section ─────────────────────────────────── */

function AutonomySection() {
  const {
    skills,
    skillsLoading,
    fetchSkills,
    updateSkillAutonomy,
    toggleSkillActive,
  } = useSettingsStore();

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  if (skillsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autonomie-Level</CardTitle>
        <CardDescription>
          Bestimme, wie selbststaendig PAI-X pro Skill handeln darf. Level 1 =
          immer fragen, Level 5 = volle Autonomie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{skill.name}</p>
                <Switch
                  checked={skill.active}
                  onCheckedChange={() => {
                    toggleSkillActive(skill.id);
                    toast.success(
                      `${skill.name} ${skill.active ? "deaktiviert" : "aktiviert"}`
                    );
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {skill.description}
              </p>
              {skill.execution_count > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {skill.execution_count}x ausgefuehrt | Erfolgsrate:{" "}
                  {Math.round(skill.success_rate * 100)}%
                </p>
              )}
            </div>
            <Select
              value={String(skill.autonomy_level)}
              onValueChange={(value) => {
                updateSkillAutonomy(skill.id, parseInt(value));
                toast.success(
                  `${skill.name} auf Level ${value} gesetzt`
                );
              }}
              disabled={!skill.active}
            >
              <SelectTrigger className="w-24">
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
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Appearance Section ───────────────────────────────── */

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [compact, setCompact] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Darstellung</CardTitle>
        <CardDescription>
          Passe das Erscheinungsbild von PAI-X an.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Selection */}
        <div className="space-y-3">
          <Label>Farbschema</Label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent ${
                theme === "light" ? "border-primary bg-accent" : ""
              }`}
            >
              <Sun className="h-6 w-6" />
              <span className="text-sm">Hell</span>
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent ${
                theme === "dark" ? "border-primary bg-accent" : ""
              }`}
            >
              <Moon className="h-6 w-6" />
              <span className="text-sm">Dunkel</span>
            </button>
            <button
              onClick={() => setTheme("system")}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent ${
                theme === "system" ? "border-primary bg-accent" : ""
              }`}
            >
              <Monitor className="h-6 w-6" />
              <span className="text-sm">System</span>
            </button>
          </div>
        </div>

        <Separator />

        {/* Compact Mode */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Kompakte Ansicht</Label>
            <p className="text-xs text-muted-foreground">
              Reduziert Abstaende fuer mehr Inhalt auf dem Bildschirm.
            </p>
          </div>
          <Switch checked={compact} onCheckedChange={setCompact} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ── About Section ────────────────────────────────────── */

function AboutSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ueber PAI-X</CardTitle>
        <CardDescription>
          Dein Personal AI Assistant
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Version</span>
            <span className="text-sm font-mono">0.1.0-alpha</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Backend</span>
            <span className="text-sm font-mono">FastAPI + PostgreSQL</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Frontend</span>
            <span className="text-sm font-mono">Next.js 15 + shadcn/ui</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">AI Engine</span>
            <span className="text-sm font-mono">Claude (Anthropic)</span>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            PAI-X ist ein Produkt von HR Code Labs. Bei Fragen oder Feedback
            wende dich an{" "}
            <a
              href="mailto:oliver@hrcodelabs.de"
              className="underline"
            >
              oliver@hrcodelabs.de
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── API Keys Section ─────────────────────────────────── */

interface ApiKeyRecord {
  provider: string;
  key_hint: string;
  created_at: string;
  updated_at: string;
}

interface ApiKeysResponse {
  keys: ApiKeyRecord[];
}

interface ApiKeyPutResponse {
  provider: string;
  key_hint: string;
  created_at: string;
  updated_at: string;
}

interface ProviderKeyState {
  provider: string;
  label: string;
  description: string;
  placeholder: string;
  keyHint: string | null;
  inputValue: string;
  showInput: boolean;
  saving: boolean;
  deleting: boolean;
  validating: boolean;
  validationResult: { valid: boolean; error?: string } | null;
  mode?: "api_key" | "subscription";
}

const INITIAL_PROVIDERS: Omit<ProviderKeyState, "keyHint" | "inputValue" | "showInput" | "saving" | "deleting" | "validating" | "validationResult">[] = [
  {
    provider: "anthropic",
    label: "Anthropic",
    description: "Fuer Claude-Modelle (Opus, Sonnet, Haiku)",
    placeholder: "sk-ant-...",
  },
  {
    provider: "openai",
    label: "OpenAI",
    description: "Fuer GPT-Modelle und Embeddings",
    placeholder: "sk-...",
  },
  {
    provider: "google",
    label: "Google AI",
    description: "Fuer Gemini-Modelle (Flash, Pro)",
    placeholder: "AIza...",
  },
];

function APIKeysSection() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderKeyState[]>(
    INITIAL_PROVIDERS.map((p) => ({
      ...p,
      keyHint: null,
      inputValue: "",
      showInput: false,
      saving: false,
      deleting: false,
      validating: false,
      validationResult: null,
    }))
  );
  const [anthropicMode, setAnthropicMode] = useState<"api_key" | "subscription">("api_key");

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const data = await api.get<ApiKeysResponse>("/settings/api-keys");
        setProviders((prev) =>
          prev.map((p) => {
            const found = data.keys.find((k) => k.provider === p.provider);
            return { ...p, keyHint: found ? found.key_hint : null };
          })
        );
        const anthropicKey = data.keys.find((k: {provider: string; key_hint: string}) => k.provider === "anthropic");
        if (anthropicKey?.key_hint?.includes("oat01")) {
          setAnthropicMode("subscription");
        }
      } catch {
        toast.error("API-Schluessel konnten nicht geladen werden");
      } finally {
        setLoading(false);
      }
    };

    fetchKeys();
  }, []);

  const handleSave = useCallback(async (providerName: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.provider === providerName ? { ...p, saving: true } : p))
    );
    try {
      const state = providers.find((p) => p.provider === providerName);
      if (!state || !state.inputValue.trim()) {
        toast.error("Bitte einen API-Schluessel eingeben");
        return;
      }
      const result = await api.put<ApiKeyPutResponse>("/settings/api-keys", {
        provider: providerName,
        api_key: state.inputValue.trim(),
      });
      setProviders((prev) =>
        prev.map((p) =>
          p.provider === providerName
            ? { ...p, keyHint: result.key_hint, inputValue: "", saving: false, validationResult: null }
            : p
        )
      );
      toast.success("API-Schluessel gespeichert");
    } catch {
      toast.error("Fehler beim Speichern des API-Schluessels");
      setProviders((prev) =>
        prev.map((p) => (p.provider === providerName ? { ...p, saving: false } : p))
      );
    }
  }, [providers]);

  const handleDelete = useCallback(async (providerName: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.provider === providerName ? { ...p, deleting: true } : p))
    );
    try {
      await api.delete(`/settings/api-keys/${providerName}`);
      setProviders((prev) =>
        prev.map((p) =>
          p.provider === providerName
            ? { ...p, keyHint: null, inputValue: "", deleting: false }
            : p
        )
      );
      toast.success("API-Schluessel geloescht");
    } catch {
      toast.error("Fehler beim Loeschen des API-Schluessels");
      setProviders((prev) =>
        prev.map((p) => (p.provider === providerName ? { ...p, deleting: false } : p))
      );
    }
  }, []);

  const handleInputChange = useCallback((providerName: string, value: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.provider === providerName ? { ...p, inputValue: value, validationResult: null } : p))
    );
  }, []);

  const handleToggleShow = useCallback((providerName: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.provider === providerName ? { ...p, showInput: !p.showInput } : p
      )
    );
  }, []);

  const handleValidate = useCallback(async (providerName: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.provider === providerName ? { ...p, validating: true, validationResult: null } : p))
    );
    try {
      const state = providers.find((p) => p.provider === providerName);
      if (!state || !state.inputValue.trim()) {
        toast.error("Bitte einen API-Schluessel eingeben");
        setProviders((prev) =>
          prev.map((p) => (p.provider === providerName ? { ...p, validating: false } : p))
        );
        return;
      }
      const result = await api.post<{ valid: boolean; error?: string }>("/settings/api-keys/validate", {
        provider: providerName,
        api_key: state.inputValue.trim(),
      });
      setProviders((prev) =>
        prev.map((p) =>
          p.provider === providerName
            ? { ...p, validating: false, validationResult: result }
            : p
        )
      );
      if (result.valid) {
        toast.success("API-Schluessel ist gueltig!");
      } else {
        toast.error(`Schluessel ungueltig: ${result.error || "Unbekannter Fehler"}`);
      }
    } catch {
      setProviders((prev) =>
        prev.map((p) =>
          p.provider === providerName
            ? { ...p, validating: false, validationResult: { valid: false, error: "Validierung fehlgeschlagen" } }
            : p
        )
      );
      toast.error("Validierung fehlgeschlagen");
    }
  }, [providers]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>KI-Modelle</CardTitle>
        <CardDescription>Verwalte deine API-Schluessel fuer KI-Dienste.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {providers.map((p) => (
          <div key={p.provider} className="rounded-lg border p-4 space-y-3">
            {/* Provider Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </div>
              <Badge variant={p.keyHint ? "success" : "secondary"}>
                {p.keyHint ? (
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Verbunden
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <X className="h-3 w-3" />
                    Nicht verbunden
                  </span>
                )}
              </Badge>
            </div>

            {/* Key hint display */}
            {p.keyHint && (
              <p className="text-xs text-muted-foreground font-mono">
                Aktuell gespeichert: <span className="text-foreground">****{p.keyHint}</span>
              </p>
            )}

            {/* Anthropic mode toggle */}
            {p.provider === "anthropic" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setAnthropicMode("api_key"); handleInputChange(p.provider, ""); }}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    anthropicMode === "api_key"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🔑 API Key
                </button>
                <button
                  type="button"
                  onClick={() => { setAnthropicMode("subscription"); handleInputChange(p.provider, ""); }}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    anthropicMode === "subscription"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ⚡ Claude Subscription
                </button>
              </div>
            )}

            {/* Anthropic subscription info box */}
            {p.provider === "anthropic" && anthropicMode === "subscription" && (
              <div className="rounded-md bg-muted/50 border border-border p-3 text-xs space-y-2">
                <p className="font-medium">Claude Pro/Max Subscription nutzen</p>
                <p className="text-muted-foreground">Token generieren mit Claude Code CLI:</p>
                <code className="block bg-background rounded px-2 py-1 font-mono text-xs">claude setup-token</code>
                <p className="text-muted-foreground">Token beginnt mit <code className="font-mono">sk-ant-oat01-</code></p>
              </div>
            )}

            {/* Input row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={p.showInput ? "text" : "password"}
                  value={p.inputValue}
                  onChange={(e) => handleInputChange(p.provider, e.target.value)}
                  placeholder={p.provider === "anthropic"
                    ? (anthropicMode === "subscription" ? "sk-ant-oat01-..." : "sk-ant-api03-...")
                    : p.placeholder}
                  disabled={p.saving}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => handleToggleShow(p.provider)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {p.showInput ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleValidate(p.provider)}
                disabled={p.validating || !p.inputValue.trim()}
                className="gap-1.5 shrink-0"
              >
                {p.validating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : p.validationResult?.valid ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Testen
              </Button>

              <Button
                size="sm"
                onClick={() => handleSave(p.provider)}
                disabled={p.saving || !p.inputValue.trim()}
                className="gap-1.5 shrink-0"
              >
                {p.saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Speichern
              </Button>

              {p.keyHint !== null && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(p.provider)}
                  disabled={p.deleting}
                  className="gap-1.5 shrink-0 text-destructive hover:text-destructive"
                >
                  {p.deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Loeschen
                </Button>
              )}
            </div>

            {/* Validation result feedback */}
            {p.validationResult && (
              <div className={`flex items-center gap-2 text-xs ${
                p.validationResult.valid
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}>
                {p.validationResult.valid ? (
                  <>
                    <Check className="h-3 w-3" />
                    Schluessel erfolgreich validiert
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3" />
                    {p.validationResult.error || "Schluessel ungueltig"}
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Security info box */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            API-Schluessel werden verschluesselt gespeichert und nur fuer deine KI-Anfragen verwendet.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Werkzeuge Section ────────────────────────────────── */

type TransportType = "stdio" | "sse" | "streamable_http";

interface WerkzeugFormState {
  name: string;
  description: string;
  transport_type: TransportType;
  command: string;
  args: string;
  url: string;
  tools: string;
}

const EMPTY_FORM: WerkzeugFormState = {
  name: "",
  description: "",
  transport_type: "stdio",
  command: "",
  args: "",
  url: "",
  tools: "",
};

function WerkzeugForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: WerkzeugFormState;
  onSave: (data: McpServerRequest) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<WerkzeugFormState>(
    initial ?? EMPTY_FORM
  );

  function set<K extends keyof WerkzeugFormState>(
    key: K,
    value: WerkzeugFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const config: Record<string, unknown> = {};
    if (form.transport_type === "stdio") {
      if (form.command.trim()) config["command"] = form.command.trim();
      if (form.args.trim()) {
        config["args"] = form.args
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
      }
    } else {
      if (form.url.trim()) config["url"] = form.url.trim();
    }

    const tools = form.tools
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await onSave({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      transport_type: form.transport_type,
      config: Object.keys(config).length > 0 ? config : undefined,
      tools: tools.length > 0 ? tools : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wz-name">
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="wz-name"
            placeholder="z.B. github"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={saving}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wz-transport">Transport</Label>
          <Select
            value={form.transport_type}
            onValueChange={(v) => set("transport_type", v as TransportType)}
            disabled={saving}
          >
            <SelectTrigger id="wz-transport">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stdio">stdio</SelectItem>
              <SelectItem value="sse">sse</SelectItem>
              <SelectItem value="streamable_http">streamable_http</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wz-desc">Beschreibung</Label>
        <Input
          id="wz-desc"
          placeholder="Kurze Beschreibung des MCP-Servers"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          disabled={saving}
        />
      </div>

      {form.transport_type === "stdio" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wz-cmd">Befehl</Label>
            <Input
              id="wz-cmd"
              placeholder="z.B. npx"
              value={form.command}
              onChange={(e) => set("command", e.target.value)}
              disabled={saving}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wz-args">Argumente (kommagetrennt)</Label>
            <Input
              id="wz-args"
              placeholder="-y, @github/mcp-server"
              value={form.args}
              onChange={(e) => set("args", e.target.value)}
              disabled={saving}
              className="font-mono text-xs"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="wz-url">URL</Label>
          <Input
            id="wz-url"
            placeholder="https://mcp.example.com/sse"
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
            disabled={saving}
            className="font-mono text-xs"
            type="url"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="wz-tools">
          Tools{" "}
          <span className="text-muted-foreground text-xs">(kommagetrennt)</span>
        </Label>
        <Input
          id="wz-tools"
          placeholder="search_code, create_issue, list_repos"
          value={form.tools}
          onChange={(e) => set("tools", e.target.value)}
          disabled={saving}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={saving || !form.name.trim()}
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

function WerkzeugCard({
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
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const existingConfig = server.config as Record<string, unknown>;

  const initialForm: WerkzeugFormState = {
    name: server.name,
    description: server.description,
    transport_type: server.transport_type,
    command: typeof existingConfig?.command === "string" ? existingConfig.command : "",
    args: Array.isArray(existingConfig?.args)
      ? (existingConfig.args as string[]).join(", ")
      : "",
    url: typeof existingConfig?.url === "string" ? existingConfig.url : "",
    tools: server.tools.join(", "),
  };

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(server.id, !server.active);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `MCP-Server "${server.name}" wirklich loeschen?`
      )
    )
      return;
    setDeleting(true);
    try {
      await onDelete(server.id);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave(data: McpServerRequest) {
    setSaving(true);
    try {
      await onUpdate(server.id, data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border">
      {/* Card Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => !editing && setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{server.name}</p>
              <Badge variant="outline" className="text-xs">
                {server.transport_type}
              </Badge>
              {server.tools.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {server.tools.length} Tools
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

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t p-4 space-y-4">
          {editing ? (
            <WerkzeugForm
              initial={initialForm}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
              saving={saving}
            />
          ) : (
            <>
              {/* Tools */}
              {server.tools.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Tools
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {server.tools.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="text-xs font-mono"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Config preview */}
              {Object.keys(server.config).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Konfiguration
                  </p>
                  <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(server.config, null, 2)}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                >
                  Bearbeiten
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
                  Loeschen
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function WerkzeugeSection() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getWerkzeuge();
      setServers(data.servers ?? []);
    } catch {
      toast.error("MCP-Server konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  async function handleCreate(data: McpServerRequest) {
    setCreating(true);
    try {
      const result = await settingsService.createWerkzeug(data);
      setServers((prev) => [...prev, result.server]);
      setShowForm(false);
      toast.success("MCP-Server registriert");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Erstellen";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      const result = await settingsService.updateWerkzeug(id, { active });
      setServers((prev) =>
        prev.map((s) => (s.id === id ? result.server : s))
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
      toast.success("MCP-Server entfernt");
    } catch {
      toast.error("Fehler beim Loeschen");
    }
  }

  async function handleUpdate(id: string, data: McpServerUpdateRequest) {
    try {
      const result = await settingsService.updateWerkzeug(id, data);
      setServers((prev) =>
        prev.map((s) => (s.id === id ? result.server : s))
      );
      toast.success("MCP-Server aktualisiert");
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>MCP-Server (Werkzeuge)</CardTitle>
              <CardDescription>
                Registriere und verwalte Model Context Protocol Server. Tools
                dieser Server koennen Skills zugewiesen werden.
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowForm((v) => !v)}
              className="gap-2 shrink-0"
              variant={showForm ? "outline" : "default"}
            >
              <Plus className="h-4 w-4" />
              Hinzufuegen
            </Button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="border-t pt-4">
            <WerkzeugForm
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
              saving={creating}
            />
          </CardContent>
        )}
      </Card>

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-lg border border-dashed">
          <Wrench className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-sm">
            Noch keine MCP-Server registriert. Fuege deinen ersten Server
            hinzu, um dessen Tools in Skills zu verwenden.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <WerkzeugCard
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
          MCP-Server werden im Format{" "}
          <span className="font-mono">mcp__servername__toolname</span> in Skills
          referenziert. Stelle sicher, dass PAI-X Zugriff auf den angegebenen
          Befehl oder die URL hat.
        </p>
      </div>
    </div>
  );
}

/* ── Persona Section ──────────────────────────────────── */

function PersonaSection() {
  const { profile, profileLoading, fetchProfile } = useSettingsStore();
  const [personaName, setPersonaName] = useState("");
  const [personaPrompt, setPersonaPrompt] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setPersonaName(profile.persona_name ?? "");
      setPersonaPrompt(profile.persona_prompt ?? "");
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.put("/auth/me", {
        persona_name: personaName || null,
        persona_prompt: personaPrompt || null,
      });
      toast.success("Persona gespeichert");
      setHasChanges(false);
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }, [personaName, personaPrompt]);

  if (profileLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>KI-Assistent</CardTitle>
        <CardDescription>
          Passe die Persoenlichkeit deines KI-Assistenten an.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="persona-name">Name des Assistenten</Label>
          <Input
            id="persona-name"
            placeholder="PAI-X"
            value={personaName}
            onChange={(e) => {
              setPersonaName(e.target.value);
              setHasChanges(true);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="persona-prompt">Benutzerdefinierte Anweisungen</Label>
          <Textarea
            id="persona-prompt"
            placeholder="z.B. 'Du bist ein freundlicher Assistent namens Luna, der formell auf Deutsch antwortet...'"
            value={personaPrompt}
            onChange={(e) => {
              setPersonaPrompt(e.target.value);
              setHasChanges(true);
            }}
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            Diese Anweisungen definieren die Persoenlichkeit und das Verhalten
            deines KI-Assistenten. Leer lassen fuer die Standard-Persona.
          </p>
        </div>

        <Separator />
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Persona speichern
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Agent Memory Section ─────────────────────────────── */

function formatKeyLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function AgentMemorySection() {
  const [entries, setEntries] = useState<AgentStateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());
  const [clearingAll, setClearingAll] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<AgentStateResponse>("/agent-state");
      setEntries(data.entries ?? []);
    } catch {
      toast.error("Erinnerungen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleDelete = useCallback(async (key: string) => {
    setDeletingKeys((prev) => new Set(prev).add(key));
    try {
      await api.delete(`/agent-state/${encodeURIComponent(key)}`);
      setEntries((prev) => prev.filter((e) => e.key !== key));
      toast.success("Erinnerung geloescht");
    } catch {
      toast.error("Fehler beim Loeschen");
    } finally {
      setDeletingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    if (!window.confirm("Alle Erinnerungen wirklich loeschen?")) return;
    setClearingAll(true);
    try {
      await Promise.all(
        entries.map((e) =>
          api.delete(`/agent-state/${encodeURIComponent(e.key)}`)
        )
      );
      setEntries([]);
      toast.success("Alle Erinnerungen geloescht");
    } catch {
      toast.error("Fehler beim Loeschen aller Erinnerungen");
      await fetchEntries();
    } finally {
      setClearingAll(false);
    }
  }, [entries, fetchEntries]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Agent-Gedaechtnis</CardTitle>
              <CardDescription>
                Gespeicherte Erinnerungen und Kontext deines Assistenten
              </CardDescription>
            </div>
            {entries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={clearingAll}
                className="gap-2 shrink-0 text-destructive hover:text-destructive"
              >
                {clearingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Alle loeschen
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Entry List */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-lg border border-dashed">
          <Brain className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Noch keine Erinnerungen gespeichert
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const valueStr = formatValue(entry.value);
            const isLong = valueStr.length > 200;
            const isExpanded = expandedKeys.has(entry.key);
            const displayValue = isLong && !isExpanded
              ? valueStr.slice(0, 200) + "..."
              : valueStr;

            return (
              <Card key={entry.key}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Key + Scope badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">
                          {formatKeyLabel(entry.key)}
                        </p>
                        <Badge
                          variant={
                            entry.scope === "global" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {entry.scope === "global" ? "Global" : "Session"}
                        </Badge>
                      </div>

                      {/* Timestamp */}
                      {entry.updated_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(entry.updated_at).toLocaleString(
                              "de-DE",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                      )}

                      {/* Value preview */}
                      <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                        {displayValue}
                      </pre>

                      {/* Expand toggle */}
                      {isLong && (
                        <button
                          onClick={() => toggleExpand(entry.key)}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              Weniger anzeigen
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              Mehr anzeigen
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Delete button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(entry.key)}
                      disabled={deletingKeys.has(entry.key)}
                      className="gap-1.5 shrink-0 text-destructive hover:text-destructive"
                    >
                      {deletingKeys.has(entry.key) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Loeschen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Settings Page ────────────────────────────────────── */

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground">
          Verwalte dein Profil, Benachrichtigungen und Integrationen.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Benachrichtigungen
          </TabsTrigger>
          <TabsTrigger value="autonomy" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Autonomie
          </TabsTrigger>
          <TabsTrigger value="persona" className="gap-2">
            <Bot className="size-4" />
            KI-Assistent
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            Darstellung
          </TabsTrigger>
          <TabsTrigger value="ai-models" className="gap-2">
            <Key className="h-4 w-4" />
            KI-Modelle
          </TabsTrigger>
          <TabsTrigger value="werkzeuge" className="gap-2">
            <Wrench className="h-4 w-4" />
            Werkzeuge
          </TabsTrigger>
          <TabsTrigger value="gedaechtnis" className="gap-2">
            <Brain className="h-4 w-4" />
            Gedaechtnis
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-2">
            <Info className="h-4 w-4" />
            Ueber PAI-X
          </TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <ProfileSection />
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <NotificationsSection />
        </TabsContent>

        {/* Autonomy */}
        <TabsContent value="autonomy">
          <AutonomySection />
        </TabsContent>

        {/* Persona */}
        <TabsContent value="persona">
          <PersonaSection />
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance">
          <AppearanceSection />
        </TabsContent>

        {/* AI Models / API Keys */}
        <TabsContent value="ai-models">
          <APIKeysSection />
        </TabsContent>

        {/* Werkzeuge */}
        <TabsContent value="werkzeuge">
          <WerkzeugeSection />
        </TabsContent>

        {/* Agent Memory */}
        <TabsContent value="gedaechtnis">
          <AgentMemorySection />
        </TabsContent>

        {/* About */}
        <TabsContent value="about">
          <AboutSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
