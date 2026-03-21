"use client";

import * as React from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Brain,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Timer,
  Zap,
  Wrench,
  FolderOpen,
  Store,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useActivityStatus } from "@/components/pai/activity-feed";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Home",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Chat",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    title: "TELOS",
    href: "/telos",
    icon: Brain,
  },
  {
    title: "Skills",
    href: "/skills",
    icon: Zap,
  },
  {
    title: "Werkzeuge",
    href: "/werkzeuge",
    icon: Wrench,
  },
  {
    title: "Dateien",
    href: "/dateien",
    icon: FolderOpen,
  },
  {
    title: "Workflows",
    href: "/routines",
    icon: Timer,
  },
  {
    title: "Marketplace",
    href: "/marketplace",
    icon: Store,
  },
  {
    title: "Erinnerungen",
    href: "/reminders",
    icon: Bell,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

/** Sidebar items that show a running indicator */
const RUNNING_BADGE_ITEMS = new Set(["/skills", "/routines"]);

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const { hasRunning } = useActivityStatus(10000);
  const { user, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  const userName = user?.name || "PAIONE";
  const userEmail = user?.email || "Personal AI";
  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "P1";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent cursor-default"
              asChild
            >
              <Link href="/">
                <div className="flex-1 text-left">
                  <div className="font-display text-2xl font-black tracking-[0.18em] leading-none drop-shadow-[0_0_8px_oklch(0.644_0.238_37/0.6)]">
                    <span className="text-sidebar-primary">PAI</span><span className="text-foreground">ONE</span>
                  </div>
                  <div className="text-[0.62rem] tracking-[0.12em] uppercase text-sidebar-foreground/50 mt-1">
                    Personal AI · ONE
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <div className="relative">
                          <item.icon />
                          {hasRunning && RUNNING_BADGE_ITEMS.has(item.href) && (
                            <span
                              className={cn(
                                "absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500",
                                "animate-pulse ring-2 ring-sidebar"
                              )}
                            />
                          )}
                        </div>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/20 p-0.5">
              <SidebarMenuButton
                size="lg"
                asChild
                tooltip="Einstellungen"
              >
                <Link href="/settings">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg text-xs font-display font-bold bg-sidebar-primary/15 text-sidebar-primary border border-sidebar-primary/30">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold tracking-wide">
                      {userName}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {userEmail}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
