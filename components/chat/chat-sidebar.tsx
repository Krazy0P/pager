"use client";

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

  return (
    <aside
      className={cn(
        "w-full shrink-0 border-r md:flex md:w-80 md:flex-col lg:w-96",
        mobileList ? "flex flex-col" : "hidden md:flex",
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 -m-1 transition-colors hover:bg-accent"
        >
          <UserAvatar name={me.display_name} src={me.avatar_url} size="sm" />
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate font-semibold leading-tight">{me.display_name}</p>
            <p className="truncate text-xs text-muted-foreground">@{me.username}</p>
          </div>
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onSignOut}>
          <LogOut />
        </Button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search chats"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Button size="icon" onClick={onOpenNewChat}>
          <Plus />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-2 pb-4">
          {filteredConversations.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              No conversations yet. Start one with the plus button.
            </p>
          ) : (
            filteredConversations.map((conversation) => {
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
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent",
                    activeId === conversation.id && "bg-accent",
                  )}
                >
                  {conversation.type === "group" ? (
                    <span className="relative flex size-8 items-center justify-center rounded-full bg-muted">
                      <Users className="size-4" />
                      <UnreadBadge count={unreadCount} />
                    </span>
                  ) : (
                    <span className="relative">
                      <UserAvatar
                        name={label}
                        src={other?.avatar_url}
                        online={other ? onlineIds.has(other.id) : false}
                      />
                      <UnreadBadge count={unreadCount} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm font-medium", unread && "font-semibold")}>{label}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {conversation.last_message
                          ? formatListTime(conversation.last_message.created_at)
                          : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "block truncate text-xs text-muted-foreground",
                        unread && "font-medium text-foreground",
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
      </div>
    </aside>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}
