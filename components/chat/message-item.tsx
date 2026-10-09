"use client";

import { useRef, useState } from "react";
import {
  Check,
  CornerUpLeft,
  FileText,
  MoreHorizontal,
  Pencil,
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

  return (
    <div
      className={cn(
        "group/message relative flex gap-2",
        mine ? "flex-row-reverse" : "flex-row",
        isGrouped && "mt-0",
      )}
    >
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
            role={onScrollToReply ? "button" : undefined}
            tabIndex={onScrollToReply ? 0 : undefined}
            onClick={onScrollToReply}
            onKeyDown={(e) => e.key === "Enter" && onScrollToReply?.()}
            className={cn(
              "mb-1 flex items-center justify-between gap-2 rounded-lg border-l-2 border-primary bg-muted/50 px-2 py-1 text-xs text-muted-foreground",
              mine && "text-left",
              onScrollToReply && "cursor-pointer hover:bg-muted",
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
              "w-fit max-w-full rounded-2xl px-3 py-2 text-sm shadow-sm",
              mine
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
              message.deleted_at && "italic opacity-70",
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
              className="max-h-72 rounded-lg"
            />
          ) : message.type === "audio" && mediaUrl ? (
            <audio controls src={mediaUrl} className="w-56" />
          ) : message.type === "file" ? (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
            >
              <FileText className="size-4" />
              <span>
                {message.file_name}
                {message.file_size ? ` · ${formatBytes(message.file_size)}` : ""}
              </span>
            </a>
          ) : (
            <p className="whitespace-pre-wrap break-words text-left">{message.content}</p>
          )}
        </div>
          {!message.deleted_at ? (
            <div className="flex shrink-0 items-center gap-1 bg-transparent p-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100">
              <span>{formatClock(message.created_at)}</span>
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
                  {mine ? (
                    <>
                      {message.type === "text" ? (
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
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

        <div
          className={cn(
            "flex items-center gap-1 px-1 text-[11px] text-muted-foreground",
            mine && "justify-end",
          )}
        >
          {message.edited_at && !message.deleted_at ? <span>· edited</span> : null}
        </div>

        {grouped.size > 0 && !message.deleted_at ? (
          <div
            className={cn(
              "flex w-full flex-wrap gap-1",
              mine ? "justify-end" : "justify-start",
            )}
          >
            {[...grouped.entries()].map(([emoji, users]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className={cn(
                  "rounded-full border bg-background px-2 py-0.5 text-xs",
                  users.includes(myId) && "border-primary",
                )}
              >
                {emoji} {users.length}
              </button>
            ))}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
