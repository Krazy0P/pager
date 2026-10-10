"use client";

import { useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  CheckSquare,
  Clock,
  Copy,
  CornerUpLeft,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Message,
  MessageActions,
  MessageAuthor,
  MessageBody,
  MessageBubble,
  MessageContent,
  MessageMeta,
  MessageReaction,
  MessageReactions,
  MessageSide,
} from "@/components/ui/message";
import type { Message as ChatMessage, Profile, Reaction } from "@/lib/chat-types";
import { formatBytes, formatClock } from "@/lib/format";
import { UserAvatar } from "@/components/chat/user-avatar";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { VoiceMessagePlayer } from "@/components/chat/voice-message-player";
import { cn } from "@/lib/utils";
import { PAGER_AI_BOT_ID } from "@/lib/ai-bot";
import { FormattedText } from "@/components/chat/formatted-text";
import { AiBadge } from "@/components/chat/ai-badge";

/** Delivery state of one of my messages, as seen by the other members */
export type MessageReceipt = {
  status: "sending" | "sent" | "partial" | "read";
  /** Display names of the members who have read it */
  readBy: string[];
};

export function receiptLabel(receipt: MessageReceipt, isGroup: boolean) {
  if (receipt.status === "sending") return "Sending…";
  if (receipt.status === "sent") return "Sent";
  if (!isGroup) return "Seen";
  if (receipt.status === "read") return "Seen by everyone";
  const [first, second, ...rest] = receipt.readBy;
  if (!second) return `Seen by ${first}`;
  if (rest.length === 0) return `Seen by ${first} and ${second}`;
  return `Seen by ${first}, ${second} and ${rest.length} other${rest.length > 1 ? "s" : ""}`;
}

export function ReceiptIcon({ receipt }: { receipt: MessageReceipt }) {
  if (receipt.status === "sending") return <Clock className="size-3" aria-hidden />;
  if (receipt.status === "sent") return <Check className="size-3" aria-hidden />;
  return (
    <CheckCheck
      className={cn("size-3.5", receipt.status === "read" && "text-primary")}
      aria-hidden
    />
  );
}

export function MessageItem({
  message,
  mine,
  grouped: isGrouped = false,
  sender,
  reactions,
  mediaUrl,
  myId,
  replyTo,
  replyToSender,
  replyToMediaUrl,
  receipt,
  isGroup = false,
  // Selection
  isSelectMode,
  isSelected,
  onSelect,
  // Actions
  onReact,
  onEdit,
  onDelete,
  onReply,
  onScrollToReply,
}: {
  message: ChatMessage;
  mine: boolean;
  grouped?: boolean;
  sender?: Profile;
  reactions: Reaction[];
  mediaUrl?: string;
  myId: string;
  replyTo?: ChatMessage;
  replyToSender?: Profile;
  replyToMediaUrl?: string;
  /** Read state, for my own messages */
  receipt?: MessageReceipt;
  isGroup?: boolean;
  /** Whether the thread is currently in multi-select mode */
  isSelectMode?: boolean;
  /** Whether this specific message is checked */
  isSelected?: boolean;
  /** Called when the user taps the bubble or the checkbox in select mode */
  onSelect?: () => void;
  onReact: (emoji: string) => void;
  onEdit: (newContent: string) => Promise<void>;
  onDelete: () => void;
  onReply?: () => void;
  onScrollToReply?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // emoji -> user ids (renamed: it previously shadowed the `grouped` prop alias)
  const reactionGroups = new Map<string, string[]>();
  for (const reaction of reactions) {
    const users = reactionGroups.get(reaction.emoji) ?? [];
    users.push(reaction.user_id);
    reactionGroups.set(reaction.emoji, users);
  }

  const startEdit = () => {
    setEditText(message.content ?? "");
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  const commitEdit = async () => {
    const value = editText.trim();
    if (!value || value === message.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onEdit(value);
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not edit");
    } finally {
      setSaving(false);
    }
  };

  const replyPreview = () => {
    if (!replyTo) return null;
    if (replyTo.deleted_at) return "Deleted message";
    if (replyTo.type === "image") return "Photo";
    if (replyTo.type === "audio") return "Voice note";
    if (replyTo.type === "file") return replyTo.file_name ?? "File";
    return replyTo.content ?? "";
  };

  const isStreaming = message.id.startsWith("ai-stream-");
  const isPending = message.id.startsWith("optimistic-");
  const showReactions = reactionGroups.size > 0 && !message.deleted_at && !isStreaming;

  return (
    <Message
      from={mine ? "sent" : "received"}
      className={cn(isSelectMode && "cursor-pointer")}
      onClick={isSelectMode ? onSelect : undefined}
    >
      {isSelectMode && (
        <div
          className={cn(
            "flex shrink-0 items-center self-center",
            // Sent rows are flex-row-reverse, so order-last puts it on the left;
            // mr-auto then pushes it to the far left edge, level with received rows.
            mine ? "order-last mr-auto" : "order-first mr-1",
          )}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background",
            )}
          >
            {isSelected && <Check className="size-3" strokeWidth={3} />}
          </span>
        </div>
      )}

      {mine ? null : isGrouped ? (
        <span className="w-8 shrink-0" />
      ) : (
        <UserAvatar name={sender?.display_name ?? "User"} src={sender?.avatar_url} />
      )}

      <MessageContent>
        {!mine && !isGrouped ? (
          <MessageAuthor className="flex items-center gap-1.5">
            <span className="text-foreground">{sender?.display_name ?? "Someone"}</span>
            {sender?.id === PAGER_AI_BOT_ID && <AiBadge />}
          </MessageAuthor>
        ) : null}

        {replyTo && !message.deleted_at ? (
          <div
            role={onScrollToReply && !isSelectMode ? "button" : undefined}
            tabIndex={onScrollToReply && !isSelectMode ? 0 : undefined}
            onClick={!isSelectMode ? onScrollToReply : undefined}
            onKeyDown={(e) =>
              !isSelectMode && e.key === "Enter" && onScrollToReply?.()
            }
            className={cn(
              "flex max-w-full items-center gap-2 rounded-lg border-l-2 border-primary/70 bg-muted px-2.5 py-1.5 text-left text-[13px]",
              onScrollToReply && !isSelectMode && "cursor-pointer hover:bg-accent",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">
                {replyTo.sender_id === myId
                  ? "You"
                  : (replyToSender?.display_name ?? "Someone")}
              </p>
              <p className="truncate text-muted-foreground">{replyPreview()}</p>
            </div>
            {replyTo.type === "image" && replyToMediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={replyToMediaUrl}
                alt=""
                className="size-8 rounded object-cover"
              />
            ) : null}
          </div>
        ) : null}

        <MessageBody>
          <MessageBubble
            variant={mine ? "sent" : "received"}
            deleted={!!message.deleted_at}
            selected={!!isSelectMode && !!isSelected}
            className={cn(
              message.type === "image" && !message.deleted_at && "overflow-hidden bg-transparent p-0",
              message.type === "audio" && !message.deleted_at && "px-2 py-1.5",
            )}
          >
            {message.deleted_at ? (
              "This message was deleted"
            ) : editing ? (
              <div className="w-72 max-w-full space-y-2 py-1" onClick={(e) => e.stopPropagation()}>
                <Textarea
                  ref={textareaRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[60px] resize-none bg-background text-sm text-foreground"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void commitEdit();
                    }
                    if (e.key === "Escape") setEditing(false);
                  }}
                />
                <div className="flex items-center justify-end gap-1.5">
                  <span className="mr-auto text-xs opacity-70">Esc to cancel</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2.5"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2.5"
                    disabled={saving}
                    onClick={() => void commitEdit()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : message.type === "image" && mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt={message.file_name ?? "Image"}
                className="max-h-80 rounded-2xl object-cover"
              />
            ) : message.type === "audio" && mediaUrl ? (
              <VoiceMessagePlayer src={mediaUrl} mine={mine} />
            ) : message.type === "file" ? (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                download={message.file_name ?? true}
                onClick={(e) => isSelectMode && e.preventDefault()}
                className="-mx-1 flex min-w-56 items-center gap-3 rounded-lg px-1 py-1"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    mine ? "bg-primary-foreground/15" : "bg-background",
                  )}
                >
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{message.file_name}</span>
                  <span className="block text-xs opacity-70">
                    {[fileExtension(message.file_name), formatBytes(message.file_size)]
                      .filter(Boolean)
                      .join(" · ") || "Attachment"}
                  </span>
                </span>
                <Download className="size-4 shrink-0 opacity-70" />
              </a>
            ) : isStreaming && (!message.content || message.content.length === 0) ? (
              <span className="flex h-6 items-center gap-1" aria-label="Pager AI is thinking">
                <span className="size-1.5 animate-bounce rounded-full bg-current opacity-50 [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current opacity-50 [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current opacity-50" />
              </span>
            ) : (
              <FormattedText
                text={message.content ?? ""}
                isStreaming={isStreaming}
              />
            )}
          </MessageBubble>

          <MessageSide>
            {!isStreaming && (
              <MessageMeta>
                <time dateTime={message.created_at}>{formatClock(message.created_at)}</time>
                {message.edited_at && !message.deleted_at ? <span>· Edited</span> : null}
                {mine && !message.deleted_at ? (
                  receipt ? (
                    <span
                      className="flex items-center"
                      title={receiptLabel(receipt, isGroup)}
                      aria-label={receiptLabel(receipt, isGroup)}
                    >
                      <ReceiptIcon receipt={receipt} />
                    </span>
                  ) : isPending ? (
                    <Clock className="size-3" aria-label="Sending" />
                  ) : (
                    <Check className="size-3" aria-label="Sent" />
                  )
                ) : null}
              </MessageMeta>
            )}

            {!message.deleted_at && !isSelectMode && !isStreaming ? (
              <MessageActions>
                {onReply ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={onReply}
                    aria-label="Reply"
                  >
                    <CornerUpLeft className="size-4" />
                  </Button>
                ) : null}
                <EmojiPicker onSelect={onReact} className="size-7" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={mine ? "end" : "start"} className="min-w-40">
                    {onReply ? (
                      <DropdownMenuItem onClick={onReply}>
                        <CornerUpLeft className="size-4" /> Reply
                      </DropdownMenuItem>
                    ) : null}
                    {mine && message.type === "text" ? (
                      <DropdownMenuItem onClick={startEdit}>
                        <Pencil className="size-4" /> Edit
                      </DropdownMenuItem>
                    ) : null}
                    {message.type === "text" && message.content ? (
                      <DropdownMenuItem
                        onClick={() => {
                          void navigator.clipboard.writeText(message.content ?? "");
                          toast.success("Copied to clipboard");
                        }}
                      >
                        <Copy className="size-4" /> Copy text
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => onSelect?.()}>
                      <CheckSquare className="size-4" /> Select
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </MessageActions>
            ) : null}
          </MessageSide>
        </MessageBody>

        {showReactions ? (
          <MessageReactions>
            {[...reactionGroups.entries()].map(([emoji, users]) => (
              <MessageReaction
                key={emoji}
                emoji={emoji}
                count={users.length}
                active={users.includes(myId)}
                onClick={() => !isSelectMode && onReact(emoji)}
                className={cn(isSelectMode && "pointer-events-none")}
              />
            ))}
          </MessageReactions>
        ) : null}
      </MessageContent>
    </Message>
  );
}

function fileExtension(name: string | null) {
  const ext = name?.split(".").pop();
  return ext && ext !== name ? ext.toUpperCase() : "";
}
