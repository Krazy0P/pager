"use client";

import { useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  CornerUpLeft,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Square,
  Trash2,
  X,
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
    if (replyTo.type === "image") return "📷 Photo";
    if (replyTo.type === "audio") return "🎵 Voice note";
    if (replyTo.type === "file") return `📎 ${replyTo.file_name ?? "File"}`;
    return replyTo.content ?? "";
  };

  const showReactions = reactionGroups.size > 0 && !message.deleted_at;

  return (
    <Message
      from={mine ? "sent" : "received"}
      className={cn(isSelectMode && "cursor-pointer")}
      onClick={isSelectMode ? onSelect : undefined}
    >
      {/* Checkbox shown in select mode */}
      {isSelectMode && (
        <div
          className={cn(
            "flex shrink-0 items-center",
            // Sent rows are flex-row-reverse, so order-last puts it on the left;
            // mr-auto then pushes it to the far left edge, level with received rows.
            mine ? "order-last mr-auto" : "order-first mr-1",
          )}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border-2 transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground bg-background",
            )}
          >
            {isSelected && <Check className="size-3" />}
          </span>
        </div>
      )}

      {!mine && !isGrouped ? (
        <UserAvatar
          name={sender?.display_name ?? "User"}
          src={sender?.avatar_url}
          size="sm"
        />
      ) : (
        <span className="size-6" />
      )}

      <MessageContent>
        {!mine && !isGrouped ? (
          <MessageAuthor>{sender?.display_name ?? "Someone"}</MessageAuthor>
        ) : null}

        {/* Reply context */}
        {replyTo && !message.deleted_at ? (
          <div
            role={onScrollToReply && !isSelectMode ? "button" : undefined}
            tabIndex={onScrollToReply && !isSelectMode ? 0 : undefined}
            onClick={!isSelectMode ? onScrollToReply : undefined}
            onKeyDown={(e) =>
              !isSelectMode && e.key === "Enter" && onScrollToReply?.()
            }
            className={cn(
              "mb-1 flex items-center justify-between gap-2 rounded-lg border-l-2 border-primary bg-muted/50 px-2 py-1 text-xs text-muted-foreground",
              mine && "text-left",
              onScrollToReply && !isSelectMode && "cursor-pointer hover:bg-muted",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground/80">
                {replyTo.sender_id === myId
                  ? "You"
                  : (replyToSender?.display_name ?? "Someone")}
              </p>
              <p className="truncate">{replyPreview()}</p>
            </div>
            {replyTo.type === "image" && replyToMediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={replyToMediaUrl}
                alt="attachment preview"
                className="size-8 rounded object-cover"
              />
            ) : null}
          </div>
        ) : null}

        {/* Bubble + side (time & hover actions) */}
        <MessageBody>
          <MessageBubble
            variant={mine ? "sent" : "received"}
            deleted={!!message.deleted_at}
            selected={!!isSelectMode && !!isSelected}
          >
            {message.deleted_at ? (
              "This message was deleted"
            ) : editing ? (
              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                <Textarea
                  ref={textareaRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[60px] resize-none bg-background text-foreground"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void commitEdit();
                    }
                    if (e.key === "Escape") setEditing(false);
                  }}
                />
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    onClick={() => setEditing(false)}
                  >
                    <X className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    className="size-6"
                    disabled={saving}
                    onClick={() => void commitEdit()}
                  >
                    <Check className="size-3" />
                  </Button>
                </div>
              </div>
            ) : message.type === "image" && mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt={message.file_name ?? "image"}
                className="max-h-72 rounded-xl border border-border/40 object-cover"
              />
            ) : message.type === "audio" && mediaUrl ? (
              <VoiceMessagePlayer src={mediaUrl} mine={mine} />
            ) : message.type === "file" ? (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                download={message.file_name ?? true}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-2 transition-colors",
                  mine
                    ? "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15"
                    : "border-border/60 bg-muted/50 text-foreground hover:bg-muted",
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded bg-background/20">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {message.file_name}
                  </p>
                  <p className="font-mono text-[10px] opacity-70">
                    {message.file_size
                      ? formatBytes(message.file_size)
                      : "Attachment"}
                  </p>
                </div>
                <Download className="size-3.5 shrink-0 opacity-70" />
              </a>
            ) : (
              <p className="whitespace-pre-wrap break-words text-left leading-relaxed">
                {message.content}
              </p>
            )}
          </MessageBubble>

          <MessageSide>
            <MessageMeta>
              <span>{formatClock(message.created_at)}</span>
              {message.edited_at && !message.deleted_at ? (
                <span>· edited</span>
              ) : null}
              {mine && !message.deleted_at ? (
                <CheckCheck className="size-3 text-primary" />
              ) : null}
            </MessageMeta>

            {!message.deleted_at && !isSelectMode ? (
              <MessageActions>
                <EmojiPicker onSelect={onReact} className="size-6" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-6">
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={mine ? "end" : "start"}>
                    {onReply ? (
                      <DropdownMenuItem onClick={onReply}>
                        <CornerUpLeft className="size-3.5" /> Reply
                      </DropdownMenuItem>
                    ) : null}
                    {/* "Select" always available so any message can enter select mode */}
                    <DropdownMenuItem onClick={() => onSelect?.()}>
                      <Square className="size-3.5" /> Select
                    </DropdownMenuItem>
                    {mine && message.type === "text" ? (
                      <DropdownMenuItem onClick={startEdit}>
                        <Pencil className="size-3.5" /> Edit
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </MessageActions>
            ) : null}
          </MessageSide>
        </MessageBody>

        {/* Reactions: sibling BELOW the bubble row */}
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