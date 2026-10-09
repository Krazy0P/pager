"use client";

import { useMemo, useState } from "react";
import { Check, MessageSquare, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Profile } from "@/lib/chat-types";
import { UserAvatar } from "@/components/chat/user-avatar";
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (person) =>
        person.display_name.toLowerCase().includes(q) ||
        person.username.toLowerCase().includes(q),
    );
  }, [people, query]);

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
        className="!animate-none sm:max-w-md p-0 gap-0 overflow-hidden border-border/80"
        showCloseButton={false}
      >
        {/* ── Dialog Header with Segmented Switcher ── */}
        <div className="p-4 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between gap-3 pr-1">
            <div className="grow">
              <DialogTitle className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
                <Users className="size-4 text-primary" />
                {tab === "direct" ? "New Direct Message" : "New Group Room"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {tab === "direct"
                  ? "Select a teammate to start chatting"
                  : "Pick members and give your group a name"}
              </DialogDescription>
            </div>

            {/* Segmented Tab Control */}
            <div className="flex items-center rounded-md bg-muted/80 p-0.5 border border-border/60 shrink-0">
              <button
                type="button"
                onClick={() => setTab("direct")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-all",
                  tab === "direct"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Direct
              </button>
              <button
                type="button"
                onClick={() => setTab("group")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-all",
                  tab === "group"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Group{selected.length > 0 ? ` (${selected.length})` : ""}
              </button>
            </div>
            <DialogFooter className="sm:justify-start">
              <DialogClose asChild>
                <button>
                  <X size={16}/>
                </button>
              </DialogClose>
            </DialogFooter>
          </div>

          {/* Group details when group tab is active */}
          {tab === "group" && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              <div className="space-y-1">
                <Label
                  htmlFor="group-name"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Group Name
                </Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="e.g. Design Sync, Frontend Guild"
                  className="h-8 text-xs bg-background/90"
                  autoFocus
                />
              </div>

              {/* Selected member badges */}
              {selected.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 max-h-20 overflow-y-auto pt-1">
                  <span className="text-[11px] font-mono text-muted-foreground mr-1">
                    Selected ({selected.length}):
                  </span>
                  {selected.map((id) => {
                    const person = people.find((item) => item.id === id);
                    if (!person) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary border border-primary/20"
                      >
                        <span className="truncate max-w-[120px]">
                          {person.display_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          className="hover:text-destructive"
                          title="Remove member"
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
        </div>

        {/* ── Search Input ── */}
        <div className="px-4 py-2 border-b border-border/50 bg-background/50 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or @username…"
              className="h-8 pl-8 pr-7 text-xs bg-muted/20 border-border/60 placeholder:text-muted-foreground/70"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                title="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
            {filtered.length} {filtered.length === 1 ? "contact" : "contacts"}
          </span>
        </div>

        {/* ── Contacts List (generous height, no dead empty margins) ── */}
        <div className="max-h-[380px] min-h-[220px] overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-2">
              <div className="flex size-9 items-center justify-center rounded border border-border/60 bg-muted/40 text-muted-foreground">
                <Search className="size-4" />
              </div>
              <p className="text-xs font-semibold">No contacts found</p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                {query
                  ? `No teammate matches "${query}". Try another name or handle.`
                  : "No other teammates have signed up yet. Invite colleagues to join!"}
              </p>
            </div>
          ) : (
            filtered.map((person) => {
              const isSelected = selected.includes(person.id);
              const isOnline = onlineIds ? onlineIds.has(person.id) : false;

              return (
                <div
                  key={person.id}
                  onClick={() => {
                    if (tab === "group") toggle(person.id);
                  }}
                  className={cn(
                    "group flex items-center justify-between gap-3 p-2 rounded-md transition-colors cursor-pointer",
                    isSelected
                      ? "bg-accent/80 border border-primary/30"
                      : "hover:bg-accent/40 border border-transparent",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <UserAvatar
                      name={person.display_name}
                      src={person.avatar_url}
                      online={isOnline}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold leading-tight group-hover:text-primary transition-colors">
                          {person.display_name}
                        </span>
                        {isOnline && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Online
                          </span>
                        )}
                      </div>
                      <span className="block truncate text-[11px] font-mono text-muted-foreground">
                        @{person.username}
                      </span>
                    </div>
                  </div>

                  {/* Right Action */}
                  {tab === "direct" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs gap-1 text-primary hover:bg-primary/10 hover:text-primary border border-primary/20 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleStartDirect(person.id);
                      }}
                      disabled={busy}
                    >
                      <MessageSquare className="size-3" />
                      <span>Chat</span>
                    </Button>
                  ) : (
                    <div
                      className={cn(
                        "flex size-5 items-center justify-center rounded border transition-colors shrink-0",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border/80 group-hover:border-foreground/40",
                      )}
                    >
                      {isSelected && (
                        <Check className="size-3.5 stroke-[2.5]" />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Dialog Footer ── */}
        {tab === "group" ? (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 p-3 px-4">
            <span className="text-xs font-mono text-muted-foreground">
              {selected.length === 0
                ? "Select at least 1 member"
                : `${selected.length} member${selected.length > 1 ? "s" : ""} selected`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={busy || selected.length === 0 || !groupName.trim()}
                onClick={() => void handleCreateGroup()}
              >
                Create Group
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/10 py-2 px-4 text-[11px] text-muted-foreground">
            <span>Click any teammate to open or start a direct thread.</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
