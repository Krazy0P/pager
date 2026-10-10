"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, Search, SendHorizontal, Sparkles } from "lucide-react";
import {
  Message,
  MessageAuthor,
  MessageBody,
  MessageBubble,
  MessageContent,
} from "@/components/ui/message";
import { UserAvatar } from "@/components/chat/user-avatar";
import { AiBadge } from "@/components/chat/ai-badge";
import { FormattedText } from "@/components/chat/formatted-text";
import { cn } from "@/lib/utils";

type DemoMessage = {
  id: string;
  sender: string;
  content: string;
  mine?: boolean;
  ai?: boolean;
};

const INITIAL: DemoMessage[] = [
  {
    id: "1",
    sender: "Elena Rostova",
    content: "The new onboarding flow is on staging. Can someone review it before standup?",
  },
  {
    id: "2",
    sender: "Marcus Vance",
    content: "On it. The empty states look much better.",
  },
  { id: "3", sender: "You", content: "Thanks! I'll fix the invite modal today.", mine: true },
  {
    id: "4",
    sender: "Pager AI",
    ai: true,
    content:
      "**Catch-up**\n- Onboarding flow is ready for review on staging\n- Invite modal styling fix is in progress",
  },
];

/** Static, interactive preview of the chat UI for the landing page. */
export function HeroChatDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>(INITIAL);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    setMessages((prev) => [...prev, { id: String(Date.now()), sender: "You", content, mine: true }]);
    setInput("");
  };

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border bg-background text-left shadow-xl shadow-black/5 dark:shadow-black/40">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <UserAvatar name="Design review" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Design review</p>
          <p className="text-xs text-muted-foreground">4 members</p>
        </div>
        <span className="flex size-8 items-center justify-center text-muted-foreground">
          <Search className="size-4" />
        </span>
        <span className="hidden items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground sm:flex">
          <Sparkles className="size-4" />
          Summarize
        </span>
      </div>

      <div ref={listRef} className="flex h-[340px] flex-col overflow-y-auto px-4 py-4 sm:px-5">
        {messages.map((msg, index) => {
          const grouped = index > 0 && messages[index - 1].sender === msg.sender;
          return (
            <Message
              key={msg.id}
              from={msg.mine ? "sent" : "received"}
              className={cn(index === 0 ? "" : grouped ? "mt-0.5" : "mt-4")}
            >
              {msg.mine ? null : grouped ? (
                <span className="w-8 shrink-0" />
              ) : (
                <UserAvatar
                  name={msg.sender}
                  src={msg.ai ? "https://api.dicebear.com/7.x/bottts/svg?seed=pager-ai" : null}
                />
              )}
              <MessageContent>
                {!msg.mine && !grouped ? (
                  <MessageAuthor className="flex items-center gap-1.5">
                    <span className="text-foreground">{msg.sender}</span>
                    {msg.ai && <AiBadge />}
                  </MessageAuthor>
                ) : null}
                <MessageBody>
                  <MessageBubble variant={msg.mine ? "sent" : "received"}>
                    <FormattedText text={msg.content} />
                  </MessageBubble>
                </MessageBody>
              </MessageContent>
            </Message>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="px-4 pb-4 sm:px-5">
        <div className="flex items-center gap-1 rounded-xl border bg-background py-1.5 pl-2 pr-1.5 shadow-sm focus-within:border-ring/60">
          <span className="flex size-8 items-center justify-center text-muted-foreground">
            <Paperclip className="size-4" />
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Try sending a message"
            aria-label="Demo message"
            className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="hidden size-8 items-center justify-center text-muted-foreground sm:flex">
            <Mic className="size-4" />
          </span>
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim()}
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
