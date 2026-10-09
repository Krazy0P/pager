"use client";

import { useState } from "react";
import { CheckCheck, MessageCircleDashed, Mic, Paperclip, Play, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoMessage {
  id: string;
  sender: string;
  content: string;
  time: string;
  mine: boolean;
  avatar: string;
  isAudio?: boolean;
}

export function HeroChatDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: "1",
      sender: "Elena Rostova",
      content: "Just deployed the realtime WebSocket gateway. Latency dropped to 14ms globally. ⚡",
      time: "10:42 AM",
      mine: false,
      avatar: "ER",
    },
    {
      id: "2",
      sender: "Marcus Vance",
      content: "Voice note recorded during the benchmark sync.",
      time: "10:43 AM",
      mine: false,
      avatar: "MV",
      isAudio: true,
    },
    {
      id: "3",
      sender: "You",
      content: "Excellent. Granular deletion and presence tracking are fully active too.",
      time: "10:44 AM",
      mine: true,
      avatar: "ME",
    },
  ]);

  const [input, setInput] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const newMsg: DemoMessage = {
      id: String(Date.now()),
      sender: "You",
      content: input.trim(),
      time: "Just now",
      mine: true,
      avatar: "ME",
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-md border border-border/80 bg-card/60 backdrop-blur-md">
      {/* Window title bar */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ml-2 text-xs font-mono font-medium text-muted-foreground">
            #dev-core · Pager Demo
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-500">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Realtime active (14ms)</span>
        </div>
      </div>

      {/* Mock chat messages */}
      <div className="flex flex-col gap-3 p-4 sm:p-5 min-h-[260px] max-h-[340px] overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.mine ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded text-[11px] font-mono font-semibold border ${
                msg.mine
                  ? "bg-primary text-primary-foreground border-primary/20"
                  : "bg-muted text-muted-foreground border-border/70"
              }`}
            >
              {msg.avatar}
            </div>

            <div className="flex flex-col max-w-[80%]">
              {!msg.mine && (
                <span className="text-[10px] font-medium text-muted-foreground mb-1 ml-0.5">
                  {msg.sender}
                </span>
              )}

              <div
                className={`rounded-md px-3.5 py-2 text-xs leading-relaxed ${
                  msg.mine
                    ? "bg-primary text-primary-foreground border border-primary/20 rounded-br-xs"
                    : "bg-card text-foreground border border-border/80 rounded-bl-xs"
                }`}
              >
                {msg.isAudio ? (
                  <div className="flex items-center gap-2.5 py-0.5">
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground"
                    >
                      <Play className="size-3 ml-0.5" />
                    </button>
                    <div className="flex items-center gap-0.5">
                      {[40, 70, 30, 85, 60, 45, 90, 35, 65, 80, 50, 30, 75, 40].map((h, i) => (
                        <span
                          key={i}
                          style={{ height: `${h * 0.2}px` }}
                          className="w-[2px] bg-primary/70 rounded-xs"
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">0:14</span>
                  </div>
                ) : (
                  msg.content
                )}

                <div
                  className={`mt-1 flex items-center justify-end gap-1 text-[9px] font-mono ${
                    msg.mine ? "text-primary-foreground/75" : "text-muted-foreground"
                  }`}
                >
                  <span>{msg.time}</span>
                  {msg.mine && <CheckCheck className="size-3 text-primary-foreground/80" />}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mock input bar */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-border/70 bg-card/40 p-2.5 sm:px-4"
      >
        <span className="flex size-7 items-center justify-center text-muted-foreground">
          <Paperclip className="size-3.5" />
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Try typing a message here and press Enter…"
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
        />
        <span className="flex size-7 items-center justify-center text-muted-foreground">
          <Mic className="size-3.5" />
        </span>
        <Button
          type="submit"
          size="icon"
          className="size-7 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
        >
          <Send className="size-3" />
        </Button>
      </form>
    </div>
  );
}
