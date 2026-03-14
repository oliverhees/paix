"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Check, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NotificationItem {
  id: string;
  run_id: string;
  title: string;
  summary: string;
  notification_type: string;
  is_pinned: boolean;
  is_read: boolean;
  created_at: string | null;
}

interface NotificationCounts {
  pinned: number;
  unread: number;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  return `vor ${diffD} Tag${diffD > 1 ? "en" : ""}`;
}

export function NotificationBell() {
  const router = useRouter();
  const [counts, setCounts] = useState<NotificationCounts>({ pinned: 0, unread: 0 });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Fetch counts periodically
  const fetchCounts = useCallback(async () => {
    try {
      const data = await api.get<NotificationCounts>("/routines/notifications/count");
      setCounts(data);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchCounts]);

  // Fetch notification list when popover opens
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ notifications: NotificationItem[] }>(
        "/routines/notifications?pinned_only=false&limit=20"
      );
      setNotifications(data.notifications ?? []);
    } catch {
      toast.error("Fehler beim Laden der Benachrichtigungen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  async function handleDismiss(notifId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await api.put(`/routines/notifications/${notifId}/dismiss`);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      setCounts((prev) => ({
        pinned: Math.max(0, prev.pinned - 1),
        unread: Math.max(0, prev.unread - 1),
      }));
    } catch {
      toast.error("Fehler beim Verwerfen");
    }
  }

  async function handleDismissAll() {
    try {
      await api.post("/routines/notifications/dismiss-all");
      setNotifications([]);
      setCounts({ pinned: 0, unread: 0 });
      toast.success("Alle Benachrichtigungen verworfen");
    } catch {
      toast.error("Fehler beim Verwerfen");
    }
  }

  function handleClickNotification(_notif: NotificationItem) {
    setOpen(false);
    router.push("/routines");
  }

  const totalBadge = counts.unread;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {totalBadge > 0 ? (
            <BellRing className="size-4" />
          ) : (
            <Bell className="size-4" />
          )}
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {totalBadge > 99 ? "99+" : totalBadge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 overflow-hidden"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-sm font-semibold">Benachrichtigungen</h4>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={handleDismissAll}
            >
              Alle verwerfen
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Laden...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Keine Benachrichtigungen
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  onClick={() => handleClickNotification(notif)}
                >
                  <div className="mt-0.5 shrink-0">
                    {notif.is_read ? (
                      <Check className="size-3.5 text-muted-foreground" />
                    ) : (
                      <div className="size-2 rounded-full bg-primary mt-1" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{notif.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notif.summary}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={(e) => handleDismiss(notif.id, e)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
