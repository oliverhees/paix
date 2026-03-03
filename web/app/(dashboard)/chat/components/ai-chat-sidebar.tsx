"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { Compass, Library, History, Search, Menu, Plus, Sparkles, Ellipsis } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AIUpgradePricingModal } from "./ai-upgrade-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import { useChatStore, type ChatSession } from "@/lib/stores/chat-store";

interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive?: boolean;
}

const sidebarItems: SidebarItem[] = [
  { icon: Compass, label: "Explore" },
  { icon: Library, label: "Library" },
  { icon: History, label: "History" }
];

/**
 * Group sessions by time category for sidebar display.
 * Uses updatedAt to determine grouping.
 */
function groupSessionsByCategory(sessions: ChatSession[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);

  const groups: Record<string, { title: string; sessions: ChatSession[] }> = {
    today: { title: "Today", sessions: [] },
    yesterday: { title: "Yesterday", sessions: [] },
    "7days": { title: "7 Days Ago", sessions: [] },
    older: { title: "Older", sessions: [] }
  };

  sessions.forEach((session) => {
    // If the session has a mock category, use it directly
    if (session.category) {
      if (groups[session.category]) {
        groups[session.category].sessions.push(session);
        return;
      }
    }

    // Otherwise, compute category from updatedAt
    const updatedAt = session.updatedAt;
    if (updatedAt >= todayStart) {
      groups.today.sessions.push(session);
    } else if (updatedAt >= yesterdayStart) {
      groups.yesterday.sessions.push(session);
    } else if (updatedAt >= sevenDaysAgo) {
      groups["7days"].sessions.push(session);
    } else {
      groups.older.sessions.push(session);
    }
  });

  return Object.entries(groups)
    .filter(([_, group]) => group.sessions.length > 0)
    .map(([key, group]) => ({ key, ...group }));
}

const SidebarContent = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const params = useParams<{ id: string }>();
  const router = useRouter();

  // ─── Zustand Store ───
  const sessions = useChatStore((s) => s.sessions);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const startNewSession = useChatStore((s) => s.startNewSession);

  // Load sessions from backend on mount
  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(query));
  }, [sessions, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleDelete = (sessionId: string) => {
    deleteSession(sessionId);
    // If the deleted session is the currently active one, navigate to /chat
    if (params.id === sessionId) {
      router.push("/chat");
    }
  };

  const handleNewChat = () => {
    startNewSession();
  };

  const sessionGroups = groupSessionsByCategory(filteredSessions);

  return (
    <div className="flex h-full flex-col border-e lg:w-72">
      <div className="border-b px-4 py-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search chats..."
            className="bg-background border-transparent pl-6 text-sm shadow-none focus:border-transparent! focus:shadow-none focus:ring-0!"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="grow space-y-4 overflow-y-auto p-4 lg:space-y-8">
        {sessionGroups.map((group) => (
          <div key={group.key}>
            <h3 className="text-muted-foreground mb-4 text-xs">{group.title}</h3>
            <div className="space-y-0.5">
              {group.sessions.map((session) => (
                <div className="group flex items-center" key={session.id}>
                  <Link
                    href={`/chat/${session.id}`}
                    className={cn(
                      "hover:bg-muted block w-full min-w-0 justify-start truncate rounded-lg p-2 px-3 text-start text-sm",
                      params.id === session.id && "bg-muted"
                    )}>
                    {session.title}
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="group-hover:opacity-100 md:opacity-0">
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>Rename</DropdownMenuItem>
                      <DropdownMenuItem>Share</DropdownMenuItem>
                      <DropdownMenuItem>Pin the chat</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-500!"
                        onClick={() => handleDelete(session.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filteredSessions.length === 0 && searchQuery && (
          <div className="text-muted-foreground py-4 text-center text-sm">
            No conversations found
          </div>
        )}
      </div>

      <div>
        <div className="p-4">
          {sidebarItems.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              className={cn("hover:bg-muted w-full justify-start", item.isActive && "bg-muted")}>
              <item.icon />
              {item.label}
            </Button>
          ))}

          <AIUpgradePricingModal>
            <Button variant="ghost" className="hover:bg-muted w-full justify-start">
              <Sparkles /> Upgrade
            </Button>
          </AIUpgradePricingModal>
        </div>

        <div className="border-t p-4">
          <Link href="/chat" onClick={handleNewChat}>
            <Button className="w-full">
              <Plus />
              New Chat
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default function AIChatSidebar() {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="absolute end-0 top-0 z-10 md:hidden">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
