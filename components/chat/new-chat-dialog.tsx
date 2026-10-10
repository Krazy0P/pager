"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PAGER_AI_BOT_ID } from "@/lib/ai-bot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Profile } from "@/lib/chat-types";
import { UserAvatar } from "@/components/chat/user-avatar";
import { AiBadge } from "@/components/chat/ai-badge";
import { cn } from "@/lib/utils";

export function NewChatDialog({
  open,
  onOpenChange,
  people,
  onlineIds,
  onStartDm,
  onCreateGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: Profile[];
  onlineIds?: Set<string>;
  onStartDm: (userId: string) => Promise<void>;
  onCreateGroup: (name: string, memberIds: string[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Pager AI can't be added to groups; it's reached there with @ai instead
    const candidates =
      tab === "group" ? people.filter((person) => person.id !== PAGER_AI_BOT_ID) : people;
    if (!q) return candidates;
    return candidates.filter(
      (person) =>
        person.display_name.toLowerCase().includes(q) ||
        person.username.toLowerCase().includes(q),
    );
  }, [people, query, tab]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const reset = () => {
    setQuery("");
    setGroupName("");
    setSelected([]);
    setTab("direct");
  };

  const handleStartDirect = async (personId: string) => {
    setBusy(true);
    try {
      await onStartDm(personId);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start conversation",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selected.length === 0) return;
    setBusy(true);
    try {
      await onCreateGroup(groupName.trim(), selected);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create group",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <div className="space-y-4 p-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-semibold">New conversation</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {tab === "direct"
                  ? "Choose someone to message."
                  : "Name your group and add members."}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                className="-mr-2 -mt-1 size-8 text-muted-foreground hover:text-foreground"
              >
                <X />
              </Button>
            </DialogClose>
          </div>

          <div role="tablist" className="grid grid-cols-2 rounded-lg bg-muted p-0.5">
            {(["direct", "group"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                className={cn(
                  "h-7 rounded-md text-[13px] font-medium transition-colors",
                  tab === item
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item === "direct" ? "Direct message" : "Group"}
              </button>
            ))}
          </div>

          {tab === "group" && (
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="e.g. Design sync"
                autoFocus
              />
              {selected.length > 0 && (
                <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pt-1.5">
                  {selected.map((id) => {
                    const person = people.find((item) => item.id === id);
                    if (!person) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex h-6 items-center gap-1 rounded-full bg-secondary pl-2.5 pr-1 text-xs font-medium"
                      >
                        <span className="max-w-[120px] truncate">{person.display_name}</span>
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label={`Remove ${person.display_name}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or username"
              aria-label="Search people"
              className="pl-8 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="h-80 overflow-y-auto border-t px-2 py-2">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-medium">
                {query ? "No one matches that search" : "No one else is here yet"}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {query
                  ? "Try a different name or username."
                  : "Invite teammates to sign up and they'll show up here."}
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((person) => {
                const isSelected = selected.includes(person.id);
                const isAi = person.id === PAGER_AI_BOT_ID;
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={tab === "group" ? isSelected : undefined}
                      onClick={() =>
                        tab === "group" ? toggle(person.id) : void handleStartDirect(person.id)
                      }
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/60 disabled:opacity-60",
                        isSelected && "bg-accent",
                      )}
                    >
                      <UserAvatar
                        name={person.display_name}
                        src={person.avatar_url}
                        online={onlineIds?.has(person.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{person.display_name}</span>
                          {isAi && <AiBadge />}
                        </span>
                        <span className="block truncate text-[13px] text-muted-foreground">
                          {isAi ? "Ask questions, summarize threads" : `@${person.username}`}
                        </span>
                      </span>
                      {tab === "group" ? (
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {isSelected && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {tab === "group" ? (
          <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
            <span className="text-[13px] text-muted-foreground">
              {selected.length === 0
                ? "No members selected"
                : `${selected.length} member${selected.length > 1 ? "s" : ""} selected`}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || selected.length === 0 || !groupName.trim()}
                onClick={() => void handleCreateGroup()}
              >
                Create group
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
