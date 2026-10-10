"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Code,
  CornerUpLeft,
  Heading3,
  Italic,
  List,
  Mic,
  Paperclip,
  Quote,
  SendHorizontal,
  Strikethrough,
  Type,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Message } from "@/lib/chat-types";
import { previewText } from "@/lib/format";
import { IconButton } from "@/components/chat/icon-button";
import { cn } from "@/lib/utils";

export function Composer({
  disabled,
  focusKey,
  placeholder = "Write a message",
  replyTo,
  replyToName,
  onClearReply,
  onSend,
  onTyping,
  onUpload,
}: {
  disabled?: boolean;
  /** Changes when the active chat changes so the composer can focus. */
  focusKey?: string | null;
  placeholder?: string;
  replyTo?: Message | null;
  /** Display name of the replied-to message's sender */
  replyToName?: string;
  onClearReply?: () => void;
  onSend: (text: string, replyToId?: string) => Promise<void>;
  onTyping: () => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const discardRecordingRef = useRef(false);

  const applyFormatting = (
    type: "bold" | "italic" | "strike" | "heading" | "code" | "quote" | "list",
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);

    let prefix = "";
    let suffix = "";
    let placeholder = "";

    switch (type) {
      case "bold":
        prefix = "**";
        suffix = "**";
        placeholder = "bold text";
        break;
      case "italic":
        prefix = "_";
        suffix = "_";
        placeholder = "italic text";
        break;
      case "strike":
        prefix = "~";
        suffix = "~";
        placeholder = "strikethrough text";
        break;
      case "heading":
        prefix = "### ";
        suffix = "";
        placeholder = "Heading";
        break;
      case "code":
        if (selected.includes("\n")) {
          prefix = "```\n";
          suffix = "\n```";
        } else {
          prefix = "`";
          suffix = "`";
        }
        placeholder = "code";
        break;
      case "quote":
        prefix = "> ";
        suffix = "";
        placeholder = "quote";
        break;
      case "list":
        prefix = "- ";
        suffix = "";
        placeholder = "list item";
        break;
    }

    const replacement = selected
      ? `${prefix}${selected}${suffix}`
      : `${prefix}${placeholder}${suffix}`;

    const nextText = text.slice(0, start) + replacement + text.slice(end);
    setText(nextText);

    requestAnimationFrame(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      } else {
        textarea.setSelectionRange(
          start + prefix.length,
          start + prefix.length + placeholder.length,
        );
      }
    });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusKey]);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSend(value, replyTo?.id);
      setText("");
      onClearReply?.();
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (discardRecordingRef.current) return;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        try {
          await onUpload(file);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Voice note failed");
        }
      };
      recorderRef.current = recorder;
      discardRecordingRef.current = false;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s: number) => s + 1);
      }, 1000);
    } catch {
      toast.error("Microphone permission is required for voice notes.");
    }
  };

  const stopRecording = ({ discard = false }: { discard?: boolean } = {}) => {
    discardRecordingRef.current = discard;
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const ext = file.type.split("/")[1] ?? "png";
    const namedFile = new File([file], `paste-${Date.now()}.${ext}`, {
      type: file.type,
    });
    try {
      await onUpload(namedFile);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Paste upload failed");
    }
  };

  const formatButtons = [
    { type: "bold", label: "Bold", hint: "Ctrl+B", icon: Bold },
    { type: "italic", label: "Italic", hint: "Ctrl+I", icon: Italic },
    { type: "strike", label: "Strikethrough", hint: "Ctrl+Shift+X", icon: Strikethrough },
    { type: "code", label: "Code", hint: "Ctrl+E", icon: Code },
    { type: "quote", label: "Quote", icon: Quote },
    { type: "list", label: "Bulleted list", icon: List },
    { type: "heading", label: "Heading", icon: Heading3 },
  ] as const;

  const canSend = !disabled && !sending && !!text.trim();

  return (
    <div className="shrink-0 px-3 pb-3 pt-1 sm:px-5 sm:pb-4">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,audio/*"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            await onUpload(file);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Upload failed");
          }
        }}
      />

      <form
        className="overflow-hidden rounded-xl border bg-background shadow-sm transition-colors focus-within:border-ring/60"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {replyTo ? (
          <div className="flex items-center gap-3 border-b bg-muted/50 py-2 pl-3 pr-2">
            <CornerUpLeft className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 border-l-2 border-primary/70 pl-2.5">
              <p className="text-xs font-medium">
                Replying to {replyToName ?? "message"}
              </p>
              <p className="truncate text-[13px] text-muted-foreground">{previewText(replyTo)}</p>
            </div>
            <IconButton label="Cancel reply" side="top" className="size-7" onClick={onClearReply}>
              <X />
            </IconButton>
          </div>
        ) : null}

        {showFormatting && !recording ? (
          <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
            {formatButtons.map((item, index) => (
              <span key={item.type} className="flex items-center">
                {index === 3 || index === 6 ? <span className="mx-1 h-4 w-px bg-border" /> : null}
                <IconButton
                  label={"hint" in item ? `${item.label} (${item.hint})` : item.label}
                  side="top"
                  className="size-7"
                  onClick={() => applyFormatting(item.type)}
                >
                  <item.icon />
                </IconButton>
              </span>
            ))}
          </div>
        ) : null}

        {recording ? (
          <div className="flex h-[52px] items-center gap-3 px-3">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
            </span>
            <span className="text-sm font-medium tabular-nums">
              {Math.floor(recordSeconds / 60)}:{(recordSeconds % 60).toString().padStart(2, "0")}
            </span>
            <span className="truncate text-sm text-muted-foreground">Recording voice note</span>
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={text}
            disabled={disabled || sending}
            placeholder={placeholder}
            aria-label="Message"
            className="max-h-48 min-h-[52px] resize-none rounded-none border-0 bg-transparent px-3 pb-1 pt-3 text-sm shadow-none [field-sizing:content] focus-visible:ring-0 dark:bg-transparent"
            rows={1}
            onChange={(event) => {
              setText(event.target.value);
              onTyping();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
                return;
              }
              const isMod = event.ctrlKey || event.metaKey;
              if (isMod && event.key.toLowerCase() === "b") {
                event.preventDefault();
                applyFormatting("bold");
                return;
              }
              if (isMod && event.key.toLowerCase() === "i") {
                event.preventDefault();
                applyFormatting("italic");
                return;
              }
              if (
                isMod &&
                ((event.key.toLowerCase() === "x" && event.shiftKey) ||
                  (event.key.toLowerCase() === "s" && event.shiftKey))
              ) {
                event.preventDefault();
                applyFormatting("strike");
                return;
              }
              if (isMod && event.key.toLowerCase() === "e") {
                event.preventDefault();
                applyFormatting("code");
                return;
              }
            }}
            onPaste={handlePaste}
          />
        )}

        <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
          {recording ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-8 text-muted-foreground"
                onClick={() => stopRecording({ discard: true })}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => stopRecording()}>
                <SendHorizontal className="size-4" />
                Send
              </Button>
            </>
          ) : (
            <>
              <IconButton
                label="Attach a file"
                side="top"
                disabled={disabled}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip />
              </IconButton>
              <IconButton
                label={showFormatting ? "Hide formatting" : "Show formatting"}
                side="top"
                aria-pressed={showFormatting}
                className={cn(showFormatting && "bg-accent text-foreground")}
                disabled={disabled}
                onClick={() => setShowFormatting((v: boolean) => !v)}
              >
                <Type />
              </IconButton>
              <IconButton
                label="Record a voice note"
                side="top"
                disabled={disabled}
                onClick={() => void startRecording()}
              >
                <Mic />
              </IconButton>
              <span className="ml-auto mr-2 hidden select-none text-xs text-muted-foreground lg:inline">
                <kbd className="font-sans font-medium">Enter</kbd> to send ·{" "}
                <kbd className="font-sans font-medium">Shift + Enter</kbd> for a new line
              </span>
              <Button
                type="submit"
                size="icon"
                className={cn(
                  "size-8 rounded-lg transition-colors max-lg:ml-auto",
                  !canSend && "bg-muted text-muted-foreground disabled:opacity-100",
                )}
                disabled={!canSend}
                aria-label="Send message"
              >
                <SendHorizontal className="size-4" />
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
