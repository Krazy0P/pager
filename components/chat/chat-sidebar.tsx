"use client";

import { useState } from "react";
import { LogOut, Moon, Search, SquarePen, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toggleThemeWithRipple } from "@/lib/theme-transition";
import type { ConversationPreview, Profile } from "@/lib/chat-types";
import { conversationTitle, formatListTime, previewText } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/chat/user-avatar";
import { IconButton } from "@/components/chat/icon-button";
import { PagerMark } from "@/components/pager-mark";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "all", label: "All" },
  { id: "direct", label: "Direct" },
  { id: "group", label: "Groups" },
] as const;

export function ChatSidebar({
  me,
  filteredConversations,
  activeId,
  unreadCounts,
  onlineIds,
  mobileList,
  search,
  onSearchChange,
  onSelect,
  onOpenProfile,
  onOpenNewChat,
  onSignOut,
}: {
  me: Profile;
  filteredConversations: ConversationPreview[];
  activeId: string | null;
  unreadCounts: Record<string, number>;
  onlineIds: Set<string>;
  mobileList: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onOpenProfile: () => void;
  onOpenNewChat: () => void;
  onSignOut: () => void;
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");

  const displayedConversations = filteredConversations.filter((c) => {
    if (tab === "direct") return c.type === "direct";
    if (tab === "group") return c.type === "group";
    return true;
  });

  return (
    <aside
      className={cn(
        "w-full shrink-0 flex-col border-r bg-sidebar md:flex md:w-80 lg:w-[22rem]",
        mobileList ? "flex" : "hidden md:flex",
      )}
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <PagerMark className="size-6" />
          <span className="text-[15px] font-semibold tracking-tight">Pager</span>
        </div>
        <IconButton label="New conversation" onClick={onOpenNewChat}>
          <SquarePen />
        </IconButton>
      </div>

      {/* Search + filter */}
      <div className="space-y-3 px-3 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 bg-background pl-8"
            placeholder="Search"
            aria-label="Search conversations"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div role="tablist" className="grid grid-cols-3 rounded-lg bg-muted p-0.5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "h-7 rounded-md text-[13px] font-medium transition-colors",
                tab === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <nav aria-label="Conversations" className="flex-1 overflow-y-auto px-2 pb-2">
        {displayedConversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {search ? "No conversations match your search." : "No conversations yet."}
            </p>
            {!search && (
              <Button variant="outline" size="sm" onClick={onOpenNewChat}>
                Start a conversation
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {displayedConversations.map((conversation) => {
              const label = conversationTitle(
                conversation.type,
                conversation.name,
                conversation.members,
                me.id,
              );
              const other = conversation.members.find((member) => member.id !== me.id);
              const last = conversation.last_message;
              const unreadCount = unreadCounts[conversation.id] ?? 0;
              const unread =
                unreadCount > 0 ||
                (!!last &&
                  last.sender_id !== me.id &&
                  new Date(last.created_at) > new Date(conversation.last_read_at));
              const isActive = activeId === conversation.id;

              let senderPrefix = "";
              if (last && !last.deleted_at) {
                if (last.sender_id === me.id) senderPrefix = "You: ";
                else if (conversation.type === "group") {
                  const sender = conversation.members.find((m) => m.id === last.sender_id);
                  if (sender) senderPrefix = `${sender.display_name.split(" ")[0]}: `;
                }
              }

              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                      isActive ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <UserAvatar
                      name={label}
                      src={conversation.type === "group" ? conversation.avatar_url : other?.avatar_url}
                      online={
                        conversation.type === "direct" && other ? onlineIds.has(other.id) : false
                      }
                      size="lg"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm",
                            unread ? "font-semibold" : "font-medium",
                          )}
                        >
                          {label}
                        </span>
                        {last ? (
                          <span
                            className={cn(
                              "shrink-0 text-xs tabular-nums",
                              unread ? "font-medium text-primary" : "text-muted-foreground",
                            )}
                          >
                            {formatListTime(last.created_at)}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-[13px]",
                            unread ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {senderPrefix}
                          {previewText(last)}
                        </span>
                        {unreadCount > 0 ? (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Account */}
      <div className="flex shrink-0 items-center gap-1 border-t p-2">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-accent"
        >
          <UserAvatar name={me.display_name} src={me.avatar_url} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium leading-tight">
              {me.display_name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">@{me.username}</span>
          </span>
        </button>
        <IconButton
          label="Toggle theme"
          side="top"
          onClick={(e) => toggleThemeWithRipple(e, resolvedTheme || theme, setTheme)}
        >
          {/* CSS-driven so server and client render the same markup */}
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </IconButton>
        <IconButton label="Sign out" side="top" onClick={onSignOut}>
          <LogOut />
        </IconButton>
      </div>
    </aside>
  );
}
