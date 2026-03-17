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
  ChevronDown,
  ChevronUp,
  Bot,
  Brain,
  Clock,
  Zap,
  FolderOpen,
  MessageCircle,
  Copy,
  Link2,
  Unlink,
  ExternalLink,
  RefreshCw,
  Globe,
} from "lucide-react";
import {
  settingsService,
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

function TelegramConnectCard({ chatId, onRefresh }: { chatId: string | null; onRefresh: () => void }) {
  const [linking, setLinking] = useState(false);
  const [linkData, setLinkData] = useState<{
    code: string;
    bot_link: string;
    bot_name: string;
  } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleGenerateCode = async () => {
    setLinking(true);
    try {
      const data = await settingsService.createTelegramLink();
      setLinkData({ code: data.code, bot_link: data.bot_link, bot_name: data.bot_name });
    } catch {
      toast.error("Code konnte nicht generiert werden");
    } finally {
      setLinking(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await settingsService.disconnectTelegram();
      toast.success("Telegram-Verknüpfung getrennt");
      setLinkData(null);
      onRefresh();
    } catch {
      toast.error("Fehler beim Trennen");
    } finally {
      setDisconnecting(false);
    }
  };

  const copyCode = () => {
    if (linkData?.code) {
      navigator.clipboard.writeText(`/start ${linkData.code}`);
      toast.success("Code kopiert");
    }
  };

  const isConnected = !!chatId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Telegram
          {isConnected ? (
            <Badge variant="default" className="bg-green-600">Verbunden</Badge>
          ) : (
            <Badge variant="secondary">Nicht verbunden</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Verbinde deinen Telegram-Account um Benachrichtigungen und Chat-Nachrichten zu empfangen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800 dark:text-green-200">
                Telegram ist verbunden (Chat-ID: {chatId})
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="gap-2 text-red-600 hover:text-red-700"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Verknüpfung trennen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {!linkData ? (
              <Button onClick={handleGenerateCode} disabled={linking} className="gap-2">
                {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Mit Telegram verbinden
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <p className="text-sm font-medium">So verbindest du:</p>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                      Oeffne den Bot:{" "}
                      {linkData.bot_link ? (
                        <a
                          href={linkData.bot_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline inline-flex items-center gap-1"
                        >
                          @{linkData.bot_name} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Bot-Token nicht konfiguriert</span>
                      )}
                    </li>
                    <li>Sende diese Nachricht an den Bot:</li>
                  </ol>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm border">
                      /start {linkData.code}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyCode} className="gap-1">
                      <Copy className="h-3 w-3" />
                      Kopieren
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Code ist 10 Minuten gueltig. Nach dem Senden wird dein Account automatisch verknuepft.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Status pruefen
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setLinkData(null)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TelegramBotConfigCard() {
  const { profile, fetchProfile } = useSettingsStore();
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setBotToken(profile.telegram_bot_token || "");
      setChatId(profile.telegram_chat_id || "");
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/auth/me", {
        telegram_bot_token: botToken,
        telegram_chat_id: chatId,
      });
      await fetchProfile();
      toast.success("Telegram-Konfiguration gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await api.post("/notifications/telegram/test-config", {});
      setTestResult({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Test fehlgeschlagen";
      setTestResult({ ok: false, error: msg });
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = !!(profile?.telegram_bot_token && profile?.telegram_chat_id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Telegram Bot Konfiguration
          {isConfigured ? (
            <Badge variant="default" className="bg-green-600">Konfiguriert</Badge>
          ) : (
            <Badge variant="secondary">Nicht konfiguriert</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Konfiguriere deinen eigenen Telegram Bot fuer Benachrichtigungen.
          Erstelle einen Bot bei{" "}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline inline-flex items-center gap-1"
          >
            @BotFather <ExternalLink className="h-3 w-3" />
          </a>{" "}
          und kopiere den Bot Token hierher.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telegram-bot-token">Bot Token</Label>
            <div className="relative">
              <Input
                id="telegram-bot-token"
                type={showToken ? "text" : "password"}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyz"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Den Token erhaeltst du von @BotFather nach dem Erstellen eines neuen Bots.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telegram-chat-id">Chat-ID</Label>
            <Input
              id="telegram-chat-id"
              placeholder="123456789"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deine Telegram Chat-ID. Sende /start an deinen Bot, dann /myid oder nutze @userinfobot.
            </p>
          </div>
        </div>

        {testResult && (
          <div className={`rounded-md px-3 py-2 text-sm ${
            testResult.ok
              ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
              : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
          }`}>
            {testResult.ok ? (
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Test-Nachricht erfolgreich gesendet
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <X className="h-4 w-4" /> {testResult.error || "Test fehlgeschlagen"}
              </span>
            )}
          </div>
        )}

        <Separator />

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Speichern
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !isConfigured}
          >
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Verbindung testen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
      {/* Telegram Connection (server-wide bot) */}
      <TelegramConnectCard
        chatId={notificationSettings.telegram_chat_id}
        onRefresh={fetchNotificationSettings}
      />

      {/* Per-user Telegram Bot Config */}
      <TelegramBotConfigCard />

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

      {/* Alerting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Alerting
          </CardTitle>
          <CardDescription>
            Automatische Benachrichtigungen bei Fehlern in Skills und Routinen/Workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Skill-Fehler</p>
              <p className="text-xs text-muted-foreground">
                In-App Benachrichtigung wenn ein Skill fehlschlaegt
              </p>
            </div>
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" /> Immer aktiv
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Workflow/Routine-Fehler</p>
              <p className="text-xs text-muted-foreground">
                In-App Benachrichtigung wenn eine Routine fehlschlaegt
              </p>
            </div>
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" /> Immer aktiv
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Telegram-Alerts</p>
              <p className="text-xs text-muted-foreground">
                Fehler-Alerts zusaetzlich per Telegram senden
              </p>
            </div>
            {notificationSettings.channels?.telegram ? (
              <Badge variant="success" className="gap-1">
                <Check className="h-3 w-3" /> Aktiv
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <X className="h-3 w-3" /> Telegram nicht aktiv
              </Badge>
            )}
          </div>
          {!notificationSettings.channels?.telegram && (
            <p className="text-xs text-muted-foreground">
              Aktiviere den Telegram-Kanal weiter unten, um Fehler-Alerts auch per Telegram zu erhalten.
            </p>
          )}
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
        <CardTitle>Über PAI-X</CardTitle>
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

function BraveSearchKeySection() {
  const { profile, fetchProfile } = useSettingsStore();
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasKey = !!profile?.brave_search_api_key;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.put("/auth/me", { brave_search_api_key: inputValue.trim() });
      toast.success("Brave Search API Key gespeichert");
      setInputValue("");
      fetchProfile();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }, [inputValue, fetchProfile]);

  const handleDelete = useCallback(async () => {
    setSaving(true);
    try {
      await api.put("/auth/me", { brave_search_api_key: "" });
      toast.success("Brave Search API Key entfernt");
      setInputValue("");
      fetchProfile();
    } catch {
      toast.error("Fehler beim Entfernen");
    } finally {
      setSaving(false);
    }
  }, [fetchProfile]);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            Brave Search API Key
          </p>
          <p className="text-xs text-muted-foreground">
            Fuer Websuchen im Chat und in Workflows.{" "}
            <a
              href="https://brave.com/search/api/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Kostenlos unter brave.com/search/api
            </a>
          </p>
        </div>
        <Badge variant={hasKey ? "success" : "secondary"}>
          {hasKey ? (
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

      {hasKey && (
        <p className="text-xs text-muted-foreground font-mono">
          Aktuell gespeichert: <span className="text-foreground">{profile.brave_search_api_key}</span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={showInput ? "text" : "password"}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="BSA..."
            disabled={saving}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowInput(!showInput)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !inputValue.trim()}
          className="gap-1.5 shrink-0"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Speichern
        </Button>

        {hasKey && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={saving}
            className="gap-1.5 shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Löschen
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Ohne eigenen Key wird DuckDuckGo als Fallback genutzt (limitiert).
      </p>
    </div>
  );
}

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
  const [connectingClaude, setConnectingClaude] = useState(false);

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
      toast.error("Fehler beim Löschen des API-Schluessels");
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
      if (!state || (!state.inputValue.trim() && state.keyHint === null)) {
        toast.error("Bitte einen API-Schluessel eingeben");
        setProviders((prev) =>
          prev.map((p) => (p.provider === providerName ? { ...p, validating: false } : p))
        );
        return;
      }
      // If no new input but key is stored, send empty string to test stored key
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

  async function openClaudeOAuth() {
    setConnectingClaude(true);
    try {
      const data = await api.get<{ auth_url: string }>("/auth/claude/start");
      const popup = window.open(data.auth_url, "claude_oauth", "width=600,height=700,scrollbars=yes");

      // Listen for completion message from popup
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "claude_oauth") {
          window.removeEventListener("message", handler);
          if (event.data.success === "true") {
            // Refresh the key hints
            api.get<ApiKeysResponse>("/settings/api-keys").then((fresh) => {
              setProviders((prev) =>
                prev.map((p) => {
                  const found = fresh.keys.find((k: {provider: string; key_hint: string}) => k.provider === p.provider);
                  return { ...p, keyHint: found ? found.key_hint : null };
                })
              );
              setAnthropicMode("subscription");
            });
          }
          setConnectingClaude(false);
          popup?.close();
        }
      };
      window.addEventListener("message", handler);

      // Fallback: stop loading after 5 minutes
      setTimeout(() => {
        window.removeEventListener("message", handler);
        setConnectingClaude(false);
      }, 300000);
    } catch (err) {
      setConnectingClaude(false);
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
                <Button
                  size="sm"
                  variant="default"
                  onClick={openClaudeOAuth}
                  disabled={connectingClaude}
                  className="w-full gap-2 mt-2"
                >
                  {connectingClaude ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verbinde...</>
                  ) : (
                    <><Zap className="h-3.5 w-3.5" /> Mit Anthropic verbinden</>
                  )}
                </Button>
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
                disabled={p.validating || (!p.inputValue.trim() && p.keyHint === null)}
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
                  Löschen
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

        <Separator />

        {/* Brave Search API Key */}
        <BraveSearchKeySection />

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

/* ── Werkzeuge Section — moved to /werkzeuge ────────── */

/* ── Persona Section ──────────────────────────────────── */

function PersonaSection() {
  const { profile, profileLoading, fetchProfile } = useSettingsStore();
  const [personaName, setPersonaName] = useState("");
  const [personaPersonality, setPersonaPersonality] = useState("");
  const [personaAboutUser, setPersonaAboutUser] = useState("");
  const [personaCommunication, setPersonaCommunication] = useState("");
  const [personaPrompt, setPersonaPrompt] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setPersonaName(profile.persona_name ?? "");
      setPersonaPersonality(profile.persona_personality ?? "");
      setPersonaAboutUser(profile.persona_about_user ?? "");
      setPersonaCommunication(profile.persona_communication ?? "");
      setPersonaPrompt(profile.persona_prompt ?? "");
      // Auto-expand advanced section if legacy prompt is set but structured fields are empty
      if (
        profile.persona_prompt &&
        !profile.persona_personality &&
        !profile.persona_about_user &&
        !profile.persona_communication
      ) {
        setAdvancedOpen(true);
      }
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.put("/auth/me", {
        persona_name: personaName || null,
        persona_personality: personaPersonality || null,
        persona_about_user: personaAboutUser || null,
        persona_communication: personaCommunication || null,
        persona_prompt: personaPrompt || null,
      });
      toast.success("Persona gespeichert");
      setHasChanges(false);
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }, [personaName, personaPersonality, personaAboutUser, personaCommunication, personaPrompt]);

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
      <CardContent className="space-y-5">
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

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="persona-personality">Persoenlichkeit</Label>
          <Textarea
            id="persona-personality"
            placeholder="Freundlich und direkt. Nutze gelegentlich Humor. Sei proaktiv mit Vorschlaegen."
            value={personaPersonality}
            onChange={(e) => {
              setPersonaPersonality(e.target.value);
              setHasChanges(true);
            }}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Wie soll dein Assistent kommunizieren? Ton, Stil, Humor, Formalitaet.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="persona-about-user">Ueber dich</Label>
          <Textarea
            id="persona-about-user"
            placeholder="Ich bin Softwareentwickler, arbeite an AI-Projekten. Ich spreche Deutsch und Englisch."
            value={personaAboutUser}
            onChange={(e) => {
              setPersonaAboutUser(e.target.value);
              setHasChanges(true);
            }}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Was soll dein Assistent ueber dich wissen? Beruf, Interessen, Kontext.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="persona-communication">Kommunikationsstil</Label>
          <Textarea
            id="persona-communication"
            placeholder="Duze mich. Antworte auf Deutsch. Halte Antworten kurz und praegnant."
            value={personaCommunication}
            onChange={(e) => {
              setPersonaCommunication(e.target.value);
              setHasChanges(true);
            }}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Formelle Anrede, Ausfuehrlichkeit, Sprache, Emoji-Nutzung.
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {advancedOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Erweitert: Freitext System-Prompt
          </button>
          {advancedOpen && (
            <div className="space-y-2 pt-2">
              <Textarea
                id="persona-prompt"
                placeholder="Vollstaendiger System-Prompt (ueberschreibt die strukturierten Felder, wenn keine ausgefuellt sind)"
                value={personaPrompt}
                onChange={(e) => {
                  setPersonaPrompt(e.target.value);
                  setHasChanges(true);
                }}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Dieser Freitext wird nur verwendet wenn die strukturierten Felder
                oben leer sind. Er dient als Fallback fuer fortgeschrittene Nutzer.
              </p>
            </div>
          )}
        </div>

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

interface KnowledgeGraphStatus {
  connected: boolean;
  error: string | null;
  backend: string;
  host: string;
  port: number;
}

function KnowledgeGraphCard() {
  const [status, setStatus] = useState<KnowledgeGraphStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<KnowledgeGraphStatus>("/memory/status");
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="size-5" />
              Knowledge Graph
            </CardTitle>
            <CardDescription>
              Automatisches Lernen aus Gesprächen — Entitäten, Beziehungen und Fakten werden per NLP extrahiert und gespeichert.
            </CardDescription>
          </div>
          {!loading && (
            <Badge variant={status?.connected ? "default" : "secondary"} className={status?.connected ? "bg-green-600" : ""}>
              {status?.connected ? "Verbunden" : "Getrennt"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Status wird geprüft...
          </div>
        ) : status?.connected ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Backend</p>
              <p className="font-medium">{status.backend}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Server</p>
              <p className="font-medium">{status.host}:{status.port}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Der Knowledge Graph ist nicht verbunden. Das automatische Lernen ist deaktiviert, aber Chat und TELOS funktionieren weiterhin.
            </p>
            {status?.error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
                {status.error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Storage Section ─────────────────────────────── */

function StorageSection() {
  const [config, setConfig] = useState({
    endpoint_url: "",
    access_key: "",
    secret_key: "",
    bucket_name: "paix-files",
    region: "fsn1",
  });
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    error?: string | null;
  } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { storageService } = await import("@/lib/storage-service");
        const cfg = await storageService.getConfig();
        setConfig({
          endpoint_url: cfg.endpoint_url,
          access_key: cfg.access_key,
          secret_key: cfg.secret_key,
          bucket_name: cfg.bucket_name,
          region: cfg.region,
        });
        setConfigured(cfg.configured);
      } catch {
        // not configured yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { storageService } = await import("@/lib/storage-service");
      const result = await storageService.updateConfig(config);
      setConfigured(result.configured);
      toast.success("Speicher-Konfiguration gespeichert");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { storageService } = await import("@/lib/storage-service");
      const result = await storageService.testConnection();
      setTestResult(result);
    } catch (e: unknown) {
      setTestResult({ connected: false, error: e instanceof Error ? e.message : "Verbindung fehlgeschlagen" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Objektspeicher (S3)
          {configured ? (
            <Badge variant="default" className="bg-green-600">Verbunden</Badge>
          ) : (
            <Badge variant="secondary">Nicht konfiguriert</Badge>
          )}
        </CardTitle>
        <CardDescription>
          S3-kompatibler Objektspeicher für Dateien (z.B. Hetzner Object Storage, AWS S3, MinIO).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="s3-endpoint">Endpoint URL</Label>
            <Input
              id="s3-endpoint"
              placeholder="https://fsn1.your-objectstorage.com"
              value={config.endpoint_url}
              onChange={(e) => setConfig((c) => ({ ...c, endpoint_url: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s3-access-key">Access Key</Label>
            <Input
              id="s3-access-key"
              placeholder="Dein Access Key"
              value={config.access_key}
              onChange={(e) => setConfig((c) => ({ ...c, access_key: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s3-secret-key">Secret Key</Label>
            <div className="relative">
              <Input
                id="s3-secret-key"
                type={showSecret ? "text" : "password"}
                placeholder="Dein Secret Key"
                value={config.secret_key}
                onChange={(e) => setConfig((c) => ({ ...c, secret_key: e.target.value }))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s3-bucket">Bucket Name</Label>
            <Input
              id="s3-bucket"
              placeholder="paix-files"
              value={config.bucket_name}
              onChange={(e) => setConfig((c) => ({ ...c, bucket_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s3-region">Region</Label>
            <Input
              id="s3-region"
              placeholder="fsn1"
              value={config.region}
              onChange={(e) => setConfig((c) => ({ ...c, region: e.target.value }))}
            />
          </div>
        </div>

        {testResult && (
          <div className={`rounded-md px-3 py-2 text-sm ${
            testResult.connected
              ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
              : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
          }`}>
            {testResult.connected ? (
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Verbindung erfolgreich
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <X className="h-4 w-4" /> {testResult.error || "Verbindung fehlgeschlagen"}
              </span>
            )}
          </div>
        )}

        <Separator />

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Speichern
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Verbindung testen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
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
      toast.success("Erinnerung gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    } finally {
      setDeletingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    if (!window.confirm("Alle Erinnerungen wirklich löschen?")) return;
    setClearingAll(true);
    try {
      await Promise.all(
        entries.map((e) =>
          api.delete(`/agent-state/${encodeURIComponent(e.key)}`)
        )
      );
      setEntries([]);
      toast.success("Alle Erinnerungen gelöscht");
    } catch {
      toast.error("Fehler beim Löschen aller Erinnerungen");
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
      {/* Knowledge Graph Status */}
      <KnowledgeGraphCard />

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Agent-Gedächtnis</CardTitle>
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
                Alle löschen
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
                      Löschen
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
          <TabsTrigger value="speicher" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Speicher
          </TabsTrigger>
          {/* Werkzeuge has its own page now → /werkzeuge */}
          <TabsTrigger value="gedaechtnis" className="gap-2">
            <Brain className="h-4 w-4" />
            Gedächtnis
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-2">
            <Info className="h-4 w-4" />
            Über PAI-X
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

        {/* Werkzeuge — moved to /werkzeuge */}

        {/* Storage */}
        <TabsContent value="speicher">
          <StorageSection />
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
