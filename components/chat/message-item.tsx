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
import type { Message, Profile, Reaction } from "@/lib/chat-types";
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
  message: Message;
  mine: boolean;
  grouped?: boolean;
  sender?: Profile;
  reactions: Reaction[];
  mediaUrl?: string;
  myId: string;
  replyTo?: Message;
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

  const grouped = new Map<string, string[]>();
  for (const reaction of reactions) {
    const current = grouped.get(reaction.emoji) ?? [];
    current.push(reaction.user_id);
    grouped.set(reaction.emoji, current);
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

  // In select mode, clicking the bubble toggles selection
  const handleBubbleClick = () => {
    if (isSelectMode) onSelect?.();
  };

  return (
    <div
      className={cn(
        "group/message relative flex gap-2",
        mine ? "flex-row-reverse" : "flex-row",
        isGrouped && "mt-0",
        isSelectMode && "cursor-pointer",
      )}
      onClick={isSelectMode ? handleBubbleClick : undefined}
    >
      {/* Checkbox shown in select mode */}
      {isSelectMode && (
        <div
          className={cn(
            "flex shrink-0 items-center",
            mine ? "order-last ml-1" : "order-first mr-1",
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
      <div
        className={cn(
          "relative flex max-w-[75%] flex-col space-y-1",
          mine && "items-end text-right",
        )}
      >
        {!mine && !isGrouped ? (
          <p className="px-1 text-xs text-muted-foreground">
            {sender?.display_name ?? "Someone"}
          </p>
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
                  : replyToSender?.display_name ?? "Someone"}
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

        <div
          className={cn(
            "flex w-fit max-w-full items-center gap-1",
            mine && "flex-row-reverse",
          )}
        >
          <div
            className={cn(
              "w-fit max-w-full rounded-md px-3.5 py-2 text-sm transition-colors",
              mine
                ? "bg-primary text-primary-foreground border border-primary/20 rounded-br-xs"
                : "bg-card text-foreground border border-border/80 rounded-bl-xs",
              message.deleted_at && "italic opacity-60 bg-muted/40 text-muted-foreground border-dashed",
              isSelectMode && isSelected && "ring-1 ring-primary bg-primary/10 border-primary",
            )}
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
              className="max-h-72 rounded border border-border/40 object-cover"
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
                "flex items-center gap-2.5 p-2 rounded border transition-colors",
                mine
                  ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/15 text-primary-foreground"
                  : "bg-muted/50 border-border/60 hover:bg-muted text-foreground",
              )}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded bg-background/20">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{message.file_name}</p>
                <p className="text-[10px] font-mono opacity-70">
                  {message.file_size ? formatBytes(message.file_size) : "Attachment"}
                </p>
              </div>
              <Download className="size-3.5 shrink-0 opacity-70" />
            </a>
          ) : (
            <p className="whitespace-pre-wrap break-words text-left leading-relaxed">{message.content}</p>
          )}

          {/* Timestamp and delivery status inside bubble */}
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] font-mono mt-1 select-none",
              mine ? "justify-end text-primary-foreground/70" : "justify-end text-muted-foreground",
            )}
          >
            <span>{formatClock(message.created_at)}</span>
            {message.edited_at && !message.deleted_at ? <span>· edited</span> : null}
            {mine && !message.deleted_at ? <CheckCheck className="size-3 text-primary-foreground/80" /> : null}
          </div>
        </div>
          {/* Hover action buttons – hidden in select mode */}
          {!message.deleted_at && !isSelectMode ? (
            <div className="flex shrink-0 items-center gap-1 bg-transparent p-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100">
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
                  <DropdownMenuItem onClick={() => { onSelect?.(); }}>
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
            </div>
          ) : null}

        {grouped.size > 0 && !message.deleted_at ? (
          <div
            className={cn(
              "flex w-full flex-wrap gap-1 mt-1",
              mine ? "justify-end" : "justify-start",
            )}
          >
            {[...grouped.entries()].map(([emoji, users]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => !isSelectMode && onReact(emoji)}
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-mono transition-colors",
                  users.includes(myId)
                    ? "border-primary/50 bg-primary/10 text-primary font-medium"
                    : "border-border/60 bg-card hover:bg-accent text-foreground",
                  isSelectMode && "pointer-events-none",
                )}
              >
                <span>{emoji}</span>
                <span className="text-[10px]">{users.length}</span>
              </button>
            ))}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
