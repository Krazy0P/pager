"use client";

import { useMemo, useState } from "react";
import {
  MessageCircleDashed,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { ConversationPreview, Message, Profile, Reaction } from "@/lib/chat-types";
import { formatDay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/chat/user-avatar";
import { MessageItem } from "@/components/chat/message-item";
import { Composer } from "@/components/chat/composer";
import { cn } from "@/lib/utils";

export function ChatThread({
  active,
  me,
  title,
  peer,
  onlineIds,
  typingNames,
  mobileList,
  visibleMessages,
  messagesById,
  profilesById,
  reactions,
  mediaUrls,
  messageQuery,
  replyTo,
  bottomRef,
  messageRefs,
  // Selection
  isSelectMode,
  selectedIds,
  onToggleSelect,
  onCancelSelect,
  onDeleteSelected,
  // Handlers
  onBack,
  onMessageQueryChange,
  onOpenGroupInfo,
  onOpenUserInfo,
  onOpenNewChat,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
  onReply,
  onScrollToMessage,
  onSend,
  onTyping,
  onUpload,
  onClearReply,
  people = [],
  onStartDm,
}: {
  active: ConversationPreview | null;
  me: Profile;
  title: string;
  peer: Profile | undefined;
  onlineIds: Set<string>;
  typingNames: string[];
  mobileList: boolean;
  visibleMessages: Message[];
  messagesById: Map<string, Message>;
  profilesById: Map<string, Profile>;
  reactions: Reaction[];
  mediaUrls: Record<string, string>;
  messageQuery: string;
  replyTo: Message | null;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  messageRefs: React.MutableRefObject<Record<string, HTMLDivElement>>;
  isSelectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (messageId: string) => void;
  onCancelSelect: () => void;
  onDeleteSelected: () => void;
  onBack: () => void;
  onMessageQueryChange: (value: string) => void;
  onOpenGroupInfo: () => void;
  onOpenUserInfo: () => void;
  onOpenNewChat: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => void;
  onReply: (message: Message) => void;
  onScrollToMessage: (id: string) => void;
  onSend: (content: string, replyToId?: string) => Promise<void>;
  onTyping: () => void;
  onUpload: (file: File) => Promise<void>;
  onClearReply: () => void;
  people?: Profile[];
  onStartDm?: (userId: string) => Promise<void>;
}) {
  const [directorySearch, setDirectorySearch] = useState("");
  const [startingDmId, setStartingDmId] = useState<string | null>(null);

  const filteredDirectoryPeople = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.display_name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q),
    );
  }, [people, directorySearch]);

  const onlineCount = useMemo(() => {
    return people.filter((p) => onlineIds.has(p.id)).length;
  }, [people, onlineIds]);

  const handleStartDm = async (userId: string) => {
    if (!onStartDm) return;
    setStartingDmId(userId);
    try {
      await onStartDm(userId);
    } finally {
      setStartingDmId(null);
    }
  };

  return (
    <section
      className={cn(
        "min-w-0 flex-1 flex-col",
        mobileList ? "hidden md:flex" : "flex",
      )}
    >
      {active ? (
        <>
          {/* ── Thread header ── */}
          <header className="flex items-center gap-3 border-b border-border/80 bg-card/40 backdrop-blur-xs px-4 py-2.5 z-20">
            {isSelectMode ? (
              /* Selection mode header */
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={onCancelSelect}
                  title="Cancel selection"
                >
                  <X className="size-4" />
                </Button>
                <p className="flex-1 text-xs font-mono font-medium">
                  {selectedIds.size === 0
                    ? "Select messages"
                    : `${selectedIds.size} message${selectedIds.size !== 1 ? "s" : ""} selected`}
                </p>
              </>
            ) : (
              /* Normal header */
              <>
                <Button className="md:hidden size-8 p-0" variant="ghost" size="sm" onClick={onBack}>
                  Chats
                </Button>
                {active.type === "group" ? (
                  <button
                    type="button"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full outline-none ring-offset-background transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={onOpenGroupInfo}
                    aria-label="Open group info"
                    title="Open group info"
                  >
                    <UserAvatar
                      name={title}
                      src={active.avatar_url}
                      size="lg"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full outline-none ring-offset-background transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={onOpenUserInfo}
                    aria-label="Open user info"
                    title="Open user info"
                  >
                    <UserAvatar
                      name={title}
                      src={peer?.avatar_url}
                      size="default"
                    />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold leading-tight">{title}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                    {typingNames.length ? (
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                        {typingNames.join(", ")} typing…
                      </span>
                    ) : active.type === "group" ? (
                      <span>{active.members.length} members</span>
                    ) : peer && onlineIds.has(peer.id) ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-medium">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Online
                      </span>
                    ) : (
                      <span>Offline</span>
                    )}
                  </div>
                </div>
                <div className="hidden w-40 sm:block">
                  <Input
                    className="h-7 text-xs bg-background/50 border-border/70"
                    value={messageQuery}
                    onChange={(event) => onMessageQueryChange(event.target.value)}
                    placeholder="Search thread…"
                  />
                </div>
              </>
            )}
          </header>

          {/* ── Message list with WhatsApp doodle wallpaper ── */}
          <div className="relative flex-1 overflow-y-auto">
            {/* WhatsApp doodle pattern */}
            <div className="relative z-10 flex flex-col gap-4 px-4 py-4 min-h-full">
              {visibleMessages.map((message, index) => {
                const previous = visibleMessages[index - 1];
                const showDay =
                  !previous ||
                  formatDay(previous.created_at) !== formatDay(message.created_at);
                const isGrouped =
                  !!previous && previous.sender_id === message.sender_id;
                const reply = message.reply_to_id
                  ? messagesById.get(message.reply_to_id)
                  : undefined;
                return (
                  <div
                    key={message.id}
                    ref={(el) => {
                      if (el) messageRefs.current[message.id] = el;
                      else delete messageRefs.current[message.id];
                    }}
                    className={cn(
                      "group/message transition-colors",
                      isGrouped && !showDay && "-mt-3",
                    )}
                  >
                    {showDay ? (
                      <div className="my-3 flex items-center gap-3">
                        <Separator className="flex-1" />
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {formatDay(message.created_at)}
                        </span>
                        <Separator className="flex-1" />
                      </div>
                    ) : null}
                    <MessageItem
                      message={message}
                      mine={message.sender_id === me.id}
                      grouped={isGrouped && !showDay}
                      sender={profilesById.get(message.sender_id)}
                      reactions={reactions.filter(
                        (reaction) => reaction.message_id === message.id,
                      )}
                      mediaUrl={message.file_path ? mediaUrls[message.file_path] : undefined}
                      myId={me.id}
                      replyTo={reply}
                      replyToSender={reply ? profilesById.get(reply.sender_id) : undefined}
                      replyToMediaUrl={reply?.file_path ? mediaUrls[reply.file_path] : undefined}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds.has(message.id)}
                      onSelect={() => onToggleSelect(message.id)}
                      onReact={(emoji) => onToggleReaction(message.id, emoji)}
                      onEdit={(content) => onEditMessage(message.id, content)}
                      onDelete={() => onDeleteMessage(message.id)}
                      onReply={() => onReply(message)}
                      onScrollToReply={
                        message.reply_to_id
                          ? () => onScrollToMessage(message.reply_to_id!)
                          : undefined
                      }
                    />
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* ── Bottom area: select action bar OR composer ── */}
          {isSelectMode ? (
            <div className="flex items-center justify-between border-t border-border/80 bg-card/40 backdrop-blur-xs px-4 py-2.5 z-20">
              <p className="text-xs font-mono text-muted-foreground">
                {selectedIds.size === 0
                  ? "Select messages above"
                  : `${selectedIds.size} selected for action`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onCancelSelect}
                >
                  Cancel
                </Button>
                <Button
                  id="delete-selected-btn"
                  variant="destructive"
                  size="sm"
                  disabled={selectedIds.size === 0}
                  className="h-7 text-xs gap-1.5"
                  onClick={onDeleteSelected}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <Composer
              focusKey={active.id}
              onSend={onSend}
              onTyping={onTyping}
              onUpload={onUpload}
              replyTo={replyTo}
              onClearReply={onClearReply}
            />
          )}
        </>
      ) : (
        /* ── Empty thread state: Space-filling Contacts & Workspace Directory ── */
        <div className="relative flex-1 flex flex-col overflow-y-auto">

          <div className="relative z-10 flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
            {/* Workspace Welcome & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-md border border-border/80 bg-card/70 backdrop-blur-xs shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded bg-primary/10 border border-primary/20 text-primary">
                    <Users className="size-4" />
                  </span>
                  <h2 className="text-sm font-semibold tracking-tight">
                    Team Contacts & Quick Start
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Start a conversation with a teammate or pick an active thread from the sidebar.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                  onClick={onOpenNewChat}
                >
                  <Plus className="size-3.5" />
                  <span>New Conversation</span>
                </Button>
              </div>
            </div>

            {/* Teammates Directory */}
            <div className="space-y-3 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                    Directory ({filteredDirectoryPeople.length})
                  </span>
                  {onlineCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-500 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {onlineCount} online
                    </span>
                  )}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    placeholder="Search contacts…"
                    className="h-8 pl-8 pr-7 text-xs bg-card/60 border-border/70"
                  />
                  {directorySearch && (
                    <button
                      type="button"
                      onClick={() => setDirectorySearch("")}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {filteredDirectoryPeople.length === 0 ? (
                <div className="p-8 text-center rounded-md border border-border/60 bg-card/40 space-y-2">
                  <MessageCircleDashed className="size-6 text-muted-foreground mx-auto" />
                  <p className="text-xs font-medium">
                    {directorySearch
                      ? `No contacts found matching "${directorySearch}".`
                      : "No other teammates have signed up yet."}
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    {directorySearch
                      ? "Check your spelling or search by another username or display name."
                      : "Invite your teammates to create an account to start chatting!"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredDirectoryPeople.map((person) => {
                    const isOnline = onlineIds.has(person.id);
                    const isStarting = startingDmId === person.id;

                    return (
                      <div
                        key={person.id}
                        className="group flex items-center justify-between gap-3 p-3 rounded-md border border-border/70 bg-card/50 hover:bg-card hover:border-border transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <UserAvatar
                            name={person.display_name}
                            src={person.avatar_url}
                            online={isOnline}
                            size="default"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold leading-tight group-hover:text-primary transition-colors">
                              {person.display_name}
                            </p>
                            <p className="truncate text-[11px] font-mono text-muted-foreground">
                              @{person.username}
                            </p>
                          </div>
                        </div>

                        {onStartDm && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isStarting}
                            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 shrink-0 gap-1"
                            onClick={() => void handleStartDm(person.id)}
                            title={`Chat with ${person.display_name}`}
                          >
                            <MessageSquare className="size-3" />
                            <span className="text-[11px] font-medium">Chat</span>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
