"use client";

import { useState } from "react";
import { LogOut, Moon, Plus, Search, Sun, Users } from "lucide-react";
import { useTheme } from "next-themes";
import type { ConversationPreview, Profile } from "@/lib/chat-types";
import { conversationTitle, formatListTime, previewText } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/chat/user-avatar";
import { cn } from "@/lib/utils";

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
  const { theme, setTheme } = useTheme();

  const [tab, setTab] = useState<"all" | "direct" | "group">("all");

  const displayedConversations = filteredConversations.filter((c) => {
    if (tab === "direct") return c.type === "direct";
    if (tab === "group") return c.type === "group";
    return true;
  });

  return (
    <aside
      className={cn(
        "w-full shrink-0 border-r border-border/80 bg-card/30 md:flex md:w-80 md:flex-col lg:w-96",
        mobileList ? "flex flex-col" : "hidden md:flex",
      )}
    >
      {/* Top User Profile bar */}
      <div className="flex items-center gap-2.5 border-b border-border/60 p-3.5">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded p-1 -m-1 transition-colors hover:bg-accent text-left"
          title="Edit profile"
        >
          <UserAvatar name={me.display_name} src={me.avatar_url} size="sm" online />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight">{me.display_name}</p>
            <p className="truncate text-[11px] font-mono text-muted-foreground">@{me.username}</p>
          </div>
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={onSignOut}
          title="Sign out"
        >
          <LogOut className="size-3.5" />
        </Button>
      </div>

      {/* Search and Action */}
      <div className="p-3 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs bg-background/50 border-border/70 placeholder:text-muted-foreground/70"
              placeholder="Search conversations…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          <Button
            size="sm"
            className="h-8 px-2.5 gap-1 text-xs shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={onOpenNewChat}
            title="Start new chat"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1 border-b border-border/40 pb-2">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={cn(
              "px-2 py-0.5 text-[11px] font-medium rounded transition-colors",
              tab === "all"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All ({filteredConversations.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("direct")}
            className={cn(
              "px-2 py-0.5 text-[11px] font-medium rounded transition-colors",
              tab === "direct"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Direct
          </button>
          <button
            type="button"
            onClick={() => setTab("group")}
            className={cn(
              "px-2 py-0.5 text-[11px] font-medium rounded transition-colors",
              tab === "group"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {displayedConversations.length === 0 ? (
          <div className="px-3 py-12 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              {search ? "No matching conversations found." : "No conversations yet."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={onOpenNewChat}
            >
              Start a chat
            </Button>
          </div>
        ) : (
          displayedConversations.map((conversation) => {
            const label = conversationTitle(
              conversation.type,
              conversation.name,
              conversation.members,
              me.id,
            );
            const other = conversation.members.find((member) => member.id !== me.id);
            const unread =
              conversation.last_message &&
              conversation.last_message.sender_id !== me.id &&
              new Date(conversation.last_message.created_at) >
                new Date(conversation.last_read_at);
            const unreadCount = unreadCounts[conversation.id] ?? 0;
            const isActive = activeId === conversation.id;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  "group relative mb-0.5 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "bg-accent text-foreground font-medium border-l-2 border-l-primary"
                    : "hover:bg-accent/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {conversation.type === "group" ? (
                  <span className="relative flex size-8 shrink-0 items-center justify-center rounded bg-muted/80 border border-border/60">
                    <Users className="size-4 text-foreground/80" />
                    <UnreadBadge count={unreadCount} />
                  </span>
                ) : (
                  <span className="relative shrink-0">
                    <UserAvatar
                      name={label}
                      src={other?.avatar_url}
                      online={other ? onlineIds.has(other.id) : false}
                      size="default"
                    />
                    <UnreadBadge count={unreadCount} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "truncate text-xs tracking-tight",
                        (unread || isActive) ? "font-semibold text-foreground" : "font-medium",
                      )}
                    >
                      {label}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {conversation.last_message
                        ? formatListTime(conversation.last_message.created_at)
                        : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "block truncate text-[11px] leading-tight mt-0.5",
                      unread ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {previewText(conversation.last_message)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex min-w-[15px] items-center justify-center rounded bg-primary px-1 text-[9px] font-mono font-bold text-primary-foreground border border-background">
      {count > 99 ? "99+" : count}
    </span>
  );
}
