"use client";

import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Quick",
    emojis: ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏", "🙏", "💯"],
  },
  {
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋",
      "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐",
      "🥸", "😎", "🥳", "🥺", "😢", "😭", "😤", "😡", "🤬", "🤯",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞",
      "🫰", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊",
      "👊", "🤛", "🤜", "👏", "🙌", "🫶", "🤝", "🙏", "💪", "🦾",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🔥", "✨",
      "💫", "⭐", "🌟", "💥", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇",
      "💯", "💢", "💬", "💭", "💤", "👑", "💎", "🔑", "🗝️", "🔐",
    ],
  },
];

export function EmojiPicker({
  onSelect,
  className,
}: {
  onSelect: (emoji: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState(0);

  const allEmojis = EMOJI_GROUPS.flatMap((g) => g.emojis);
  const filteredEmojis = search.trim()
    ? allEmojis.filter((emoji) => emoji.includes(search))
    : null;

  const displayGroups = filteredEmojis
    ? [{ label: "Results", emojis: filteredEmojis }]
    : EMOJI_GROUPS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Add reaction"
          className={cn("size-8 shrink-0 text-muted-foreground hover:text-foreground", className)}
        >
          <Smile className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        side="top"
        align="end"
        sideOffset={4}
      >
        <div className="border-b p-2">
          <Input
            placeholder="Search emoji…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        {!filteredEmojis && (
          <div className="flex gap-1 border-b px-2 py-1">
            {EMOJI_GROUPS.map((group, index) => (
              <button
                key={group.label}
                type="button"
                onClick={() => setActiveGroup(index)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors hover:bg-accent",
                  activeGroup === index && "bg-accent",
                )}
              >
                {group.label}
              </button>
            ))}
          </div>
        )}
        <div className="max-h-48 overflow-y-auto p-2">
          {displayGroups[filteredEmojis ? 0 : activeGroup]?.emojis.map(
            (emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                  setSearch("");
                }}
                className="inline-flex size-8 items-center justify-center rounded text-lg hover:bg-accent"
              >
                {emoji}
              </button>
            ),
          )}
          {filteredEmojis?.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No emoji found
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
