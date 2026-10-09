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
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    } catch {
      toast.error("Microphone permission is required for voice notes.");
    }
  };

  const stopRecording = () => {
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
    <div className="border-t bg-background">
      {/* Reply banner */}
      {replyTo ? (
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
          <div className="min-w-0 flex-1 truncate text-muted-foreground">
            <span className="font-medium text-foreground">Replying to</span>{" "}
            {previewText(replyTo)}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={onClearReply}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <form
        className="flex items-end gap-2 p-3"
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
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip />
        </Button>
        <Button
          type="button"
          variant={recording ? "destructive" : "ghost"}
          size="icon"
          disabled={disabled}
          onClick={() => (recording ? stopRecording() : void startRecording())}
        >
          {recording ? <Square /> : <Mic />}
        </Button>
        <Textarea
          value={text}
          disabled={disabled || sending}
          placeholder={recording ? "Recording voice note…" : "Write a message"}
          className="min-h-11 resize-none"
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
        <Button type="submit" size="icon" disabled={disabled || sending || !text.trim()}>
          <Send />
        </Button>
      </form>
    </div>
  );
}
