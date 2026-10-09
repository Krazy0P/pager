"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
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
  onStartDm,
  onCreateGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: Profile[];
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
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const reset = () => {
    setQuery("");
    setGroupName("");
    setSelected([]);
    setTab("direct");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="!animate-none">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Start a private chat or create a group.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={tab === "direct" ? "default" : "outline"}
            onClick={() => setTab("direct")}
          >
            Direct
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "group" ? "default" : "outline"}
            onClick={() => setTab("group")}
          >
            Group
          </Button>
        </div>
        {tab === "group" ? (
          <div className="grid gap-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Hackathon room"
            />
          </div>
        ) : null}
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people"
        />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No matching users yet. Ask a teammate to sign up.
            </p>
          ) : (
            filtered.map((person) => {
              const active = selected.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent",
                    active && "bg-accent",
                  )}
                  onClick={async () => {
                    if (tab === "direct") {
                      setBusy(true);
                      try {
                        await onStartDm(person.id);
                        reset();
                        onOpenChange(false);
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Could not start chat",
                        );
                      } finally {
                        setBusy(false);
                      }
                    } else {
                      toggle(person.id);
                    }
                  }}
                  disabled={busy}
                >
                  <UserAvatar name={person.display_name} src={person.avatar_url} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {person.display_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{person.username}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        {tab === "group" ? (
          <DialogFooter>
            <Button
              disabled={busy || selected.length === 0 || !groupName.trim()}
              onClick={async () => {
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
              }}
            >
              Create group
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
