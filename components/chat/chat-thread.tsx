"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { ConversationPreview, Message, Profile, Reaction } from "@/lib/chat-types";
import { PAGER_AI_BOT_ID } from "@/lib/ai-bot";
import { formatDay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconButton } from "@/components/chat/icon-button";
import { AiBadge } from "@/components/chat/ai-badge";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  MessageItem,
  ReceiptIcon,
  receiptLabel,
  type MessageReceipt,
} from "@/components/chat/message-item";
import {
  Message as MessageRow,
  MessageAuthor,
  MessageBubble,
  MessageContent,
} from "@/components/ui/message";
import { Composer } from "@/components/chat/composer";
import { cn } from "@/lib/utils";

// Consecutive messages from one sender within this window share an avatar/name
const GROUP_WINDOW_MS = 5 * 60_000;

export function ChatThread({
  active,
  me,
  title,
  peer,
  onlineIds,
  typingNames,
  typingPeople,
  readAt,
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
  onSummarize,
  isAiBusy = false,
}: {
  active: ConversationPreview | null;
  me: Profile;
  title: string;
  peer: Profile | undefined;
  onlineIds: Set<string>;
  typingNames: string[];
  /** Members (not Pager AI) currently typing in this chat */
  typingPeople: Profile[];
  /** member id -> when they last read this chat (epoch ms) */
  readAt: Record<string, number>;
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
  onSummarize?: () => void;
  isAiBusy?: boolean;
}) {
  const [directorySearch, setDirectorySearch] = useState("");
  const [startingDmId, setStartingDmId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const isAiPeer = active?.type === "direct" && peer?.id === PAGER_AI_BOT_ID;
  const isGroup = active?.type === "group";

  // Members whose reads count toward receipts; Pager AI never "reads"
  const recipients = (active?.members ?? []).filter(
    (member) => member.id !== me.id && member.id !== PAGER_AI_BOT_ID,
  );

  const receiptFor = (message: Message): MessageReceipt | undefined => {
    if (message.sender_id !== me.id || message.deleted_at || recipients.length === 0) {
      return undefined;
    }
    if (message.id.startsWith("optimistic-")) return { status: "sending", readBy: [] };
    const sentAt = Date.parse(message.created_at);
    const readBy = recipients
      .filter((member) => (readAt[member.id] ?? 0) >= sentAt)
      .map((member) => member.display_name);
    const status =
      readBy.length === 0 ? "sent" : readBy.length === recipients.length ? "read" : "partial";
    return { status, readBy };
  };

  const lastMessage = visibleMessages[visibleMessages.length - 1];
  const lastReceipt = lastMessage && !messageQuery ? receiptFor(lastMessage) : undefined;

  const typingLabel =
    typingPeople.length === 1
      ? `${typingPeople[0].display_name} is typing`
      : typingPeople.length === 2
        ? `${typingPeople[0].display_name} and ${typingPeople[1].display_name} are typing`
        : `${typingPeople.length} people are typing`;

  const closeSearch = () => {
    setSearchOpen(false);
    onMessageQueryChange("");
  };

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
        "min-w-0 flex-1 flex-col bg-background",
        mobileList ? "hidden md:flex" : "flex",
      )}
    >
      {active ? (
        <>
          {/* Thread header */}
          <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
            {isSelectMode ? (
              <>
                <IconButton label="Cancel selection" onClick={onCancelSelect}>
                  <X />
                </IconButton>
                <p className="flex-1 text-sm font-medium">
                  {selectedIds.size === 0
                    ? "Select messages"
                    : `${selectedIds.size} selected`}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedIds.size === 0}
                  className="gap-1.5"
                  onClick={onDeleteSelected}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </>
            ) : (
              <>
                <IconButton label="Back to conversations" className="md:hidden" onClick={onBack}>
                  <ChevronLeft />
                </IconButton>
                <button
                  type="button"
                  className="-ml-1 flex min-w-0 items-center gap-3 rounded-lg px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-3 sm:hover:bg-accent/60"
                  onClick={active.type === "group" ? onOpenGroupInfo : onOpenUserInfo}
                  aria-label={active.type === "group" ? "Open group info" : "Open profile"}
                >
                  <UserAvatar
                    name={title}
                    src={active.type === "group" ? active.avatar_url : peer?.avatar_url}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{title}</span>
                      {isAiPeer && <AiBadge />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {typingNames.length ? (
                        <span className="text-primary">
                          {typingNames.join(", ")} {typingNames.length > 1 ? "are" : "is"} typing…
                        </span>
                      ) : isAiPeer ? (
                        "Answers every message in this chat"
                      ) : active.type === "group" ? (
                        `${active.members.length} members`
                      ) : peer && onlineIds.has(peer.id) ? (
                        "Online"
                      ) : (
                        "Offline"
                      )}
                    </span>
                  </span>
                </button>

                <div className="ml-auto flex shrink-0 items-center gap-1">
                  {searchOpen ? (
                    <div className="relative w-40 sm:w-56">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        autoFocus
                        className="h-8 pl-8 pr-8"
                        value={messageQuery}
                        onChange={(event) => onMessageQueryChange(event.target.value)}
                        onKeyDown={(event) => event.key === "Escape" && closeSearch()}
                        placeholder="Search messages"
                        aria-label="Search messages"
                      />
                      <button
                        type="button"
                        onClick={closeSearch}
                        aria-label="Close search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <IconButton label="Search messages" onClick={() => setSearchOpen(true)}>
                      <Search />
                    </IconButton>
                  )}
                  {onSummarize && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 px-2 text-muted-foreground hover:text-foreground sm:px-3"
                          onClick={onSummarize}
                          disabled={isAiBusy}
                          aria-label="Summarize conversation"
                        >
                          {isAiBusy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Sparkles className="size-4" />
                          )}
                          <span className="hidden sm:inline">Summarize</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Summarize with Pager AI</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </>
            )}
          </header>

          {/* Message list */}
          <div className="relative flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col px-3 py-4 sm:px-5">
              {visibleMessages.length === 0 ? (
                <div className="m-auto max-w-xs py-16 text-center">
                  <p className="text-sm font-medium">
                    {messageQuery ? "No matching messages" : "No messages yet"}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {messageQuery
                      ? "Try a different search."
                      : isAiPeer
                        ? "Ask Pager AI anything to get started."
                        : "Send a message to start the conversation."}
                  </p>
                </div>
              ) : null}
              {visibleMessages.map((message, index) => {
                const previous = visibleMessages[index - 1];
                const showDay =
                  !previous ||
                  formatDay(previous.created_at) !== formatDay(message.created_at);
                const isGrouped =
                  !showDay &&
                  !!previous &&
                  previous.sender_id === message.sender_id &&
                  new Date(message.created_at).getTime() -
                    new Date(previous.created_at).getTime() <
                    GROUP_WINDOW_MS;
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
                      "group/message rounded-xl transition-colors duration-500",
                      showDay ? "" : isGrouped ? "mt-0.5" : "mt-4",
                    )}
                  >
                    {showDay ? (
                      <div className="my-4 flex items-center gap-3" role="separator">
                        <span className="h-px flex-1 bg-border" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatDay(message.created_at)}
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    ) : null}
                    <MessageItem
                      message={message}
                      mine={message.sender_id === me.id}
                      grouped={isGrouped}
                      sender={profilesById.get(message.sender_id)}
                      reactions={reactions.filter(
                        (reaction) => reaction.message_id === message.id,
                      )}
                      mediaUrl={message.file_path ? mediaUrls[message.file_path] : undefined}
                      myId={me.id}
                      replyTo={reply}
                      replyToSender={reply ? profilesById.get(reply.sender_id) : undefined}
                      replyToMediaUrl={reply?.file_path ? mediaUrls[reply.file_path] : undefined}
                      receipt={receiptFor(message)}
                      isGroup={isGroup}
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
              {lastReceipt ? (
                <p
                  className="mt-1 flex items-center justify-end gap-1 px-1 text-[11px] text-muted-foreground"
                  aria-live="polite"
                >
                  <ReceiptIcon receipt={lastReceipt} />
                  {receiptLabel(lastReceipt, isGroup)}
                </p>
              ) : null}
              {typingPeople.length > 0 ? (
                <MessageRow from="received" className="mt-4" aria-live="polite">
                  <UserAvatar
                    name={typingPeople[0].display_name}
                    src={typingPeople[0].avatar_url}
                  />
                  <MessageContent>
                    {isGroup ? <MessageAuthor>{typingLabel}</MessageAuthor> : null}
                    <MessageBubble variant="received" aria-label={typingLabel}>
                      <span className="flex h-6 items-center gap-1">
                        <span className="size-1.5 animate-bounce rounded-full bg-current opacity-50 [animation-delay:-0.3s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-current opacity-50 [animation-delay:-0.15s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-current opacity-50" />
                      </span>
                    </MessageBubble>
                  </MessageContent>
                </MessageRow>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </div>

          {!isSelectMode && (
            <Composer
              focusKey={active.id}
              placeholder={`Message ${title}`}
              onSend={onSend}
              onTyping={onTyping}
              onUpload={onUpload}
              replyTo={replyTo}
              replyToName={
                replyTo
                  ? replyTo.sender_id === me.id
                    ? "yourself"
                    : profilesById.get(replyTo.sender_id)?.display_name
                  : undefined
              }
              onClearReply={onClearReply}
            />
          )}
        </>
      ) : (
        /* No conversation selected: people directory */
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a conversation from the sidebar, or message someone below.
                </p>
              </div>
              <Button className="gap-1.5" onClick={onOpenNewChat}>
                <Plus className="size-4" />
                New conversation
              </Button>
            </div>

            <section className="space-y-3" aria-labelledby="people-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-baseline gap-2">
                  <h2 id="people-heading" className="text-sm font-semibold">
                    People
                  </h2>
                  <span className="text-[13px] text-muted-foreground">
                    {people.length}
                    {onlineCount > 0 ? ` · ${onlineCount} online` : ""}
                  </span>
                </div>
                <div className="relative w-full sm:w-60">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    placeholder="Search people"
                    aria-label="Search people"
                    className="h-9 pl-8"
                  />
                </div>
              </div>

              {filteredDirectoryPeople.length === 0 ? (
                <div className="rounded-xl border border-dashed px-6 py-12 text-center">
                  <p className="text-sm font-medium">
                    {directorySearch ? "No one matches that search" : "No one else is here yet"}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {directorySearch
                      ? "Try a name or username."
                      : "Invite teammates to sign up and they'll show up here."}
                  </p>
                </div>
              ) : (
                <ul className="divide-y overflow-hidden rounded-xl border">
                  {filteredDirectoryPeople.map((person) => {
                    const isStarting = startingDmId === person.id;
                    const isAi = person.id === PAGER_AI_BOT_ID;
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          disabled={!onStartDm || isStarting}
                          onClick={() => void handleStartDm(person.id)}
                          className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 disabled:opacity-60"
                        >
                          <UserAvatar
                            name={person.display_name}
                            src={person.avatar_url}
                            online={onlineIds.has(person.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium">
                                {person.display_name}
                              </span>
                              {isAi && <AiBadge />}
                            </span>
                            <span className="block truncate text-[13px] text-muted-foreground">
                              {isAi ? "Ask questions, summarize threads" : `@${person.username}`}
                            </span>
                          </span>
                          <span className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                            {isStarting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <>
                                Message
                                <ChevronRight className="size-4" />
                              </>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

