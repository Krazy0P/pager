"use client";

import { AtSign, Info } from "lucide-react";
import type { Profile } from "@/lib/chat-types";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function UserInfoSheet({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | undefined;
}) {
  if (!profile) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full border-l border-border/80 bg-card/95 p-0 sm:max-w-md">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/80 bg-muted/20 px-6 py-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-36 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted p-1 shadow-lg ring-1 ring-border/70">
                <span className="flex size-32 rounded-full">
                  <UserAvatar
                    name={profile.display_name}
                    src={profile.avatar_url}
                    size="xl"
                  />
                </span>
              </div>
              <SheetTitle className="text-base">{profile.display_name}</SheetTitle>
              <SheetDescription className="flex items-center gap-1 text-xs">
                <AtSign className="size-3" />
                {profile.username}
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              About
            </p>
            <div className="space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Bio</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {profile.bio?.trim() || "No bio added yet."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
