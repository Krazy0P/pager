"use client";

import { useRef, useState } from "react";
import { Mic, Paperclip, Send, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Message } from "@/lib/chat-types";
import { previewText } from "@/lib/format";

export function Composer({
  disabled,
  replyTo,
  onClearReply,
  onSend,
  onTyping,
  onUpload,
}: {
  disabled?: boolean;
  replyTo?: Message | null;
  onClearReply?: () => void;
  onSend: (text: string, replyToId?: string) => Promise<void>;
  onTyping: () => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSend(value, replyTo?.id);
      setText("");
      onClearReply?.();
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
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast.error("Microphone permission is required for voice notes.");
    }
  };

  const stopRecording = () => {
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

  return (
    <div className="border-t border-border/80 bg-card/40 backdrop-blur-xs">
      {/* Reply banner */}
      {replyTo ? (
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-1.5 text-xs">
          <div className="size-1 rounded-full bg-primary" />
          <div className="min-w-0 flex-1 truncate text-muted-foreground">
            <span className="font-medium text-foreground">Replying to:</span>{" "}
            {previewText(replyTo)}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5 shrink-0"
            onClick={onClearReply}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}

      <form
        className="flex items-center gap-2 p-2.5 sm:px-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
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

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground shrink-0"
          disabled={disabled || recording}
          onClick={() => fileRef.current?.click()}
          title="Attach file or image"
        >
          <Paperclip className="size-4" />
        </Button>

        {recording ? (
          <div className="flex flex-1 items-center gap-3 px-2 py-1 text-sm">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
            </span>
            <span className="text-xs font-mono font-medium text-destructive">
              REC {Math.floor(recordSeconds / 60)}:{(recordSeconds % 60).toString().padStart(2, "0")}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              Recording audio note…
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="ml-auto h-7 px-2.5 text-xs gap-1"
              onClick={stopRecording}
            >
              <Square className="size-3" /> Stop & Send
            </Button>
          </div>
        ) : (
          <>
            <Textarea
              value={text}
              disabled={disabled || sending}
              placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
              className="min-h-9 max-h-32 resize-none border-0 bg-transparent p-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 leading-normal"
              rows={1}
              onChange={(event) => {
                setText(event.target.value);
                onTyping();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              onPaste={handlePaste}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground shrink-0"
              disabled={disabled}
              onClick={() => void startRecording()}
              title="Record voice note"
            >
              <Mic className="size-4" />
            </Button>

            <Button
              type="submit"
              size="icon"
              className="size-8 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-40"
              disabled={disabled || sending || !text.trim()}
              title="Send message"
            >
              <Send className="size-3.5" />
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
