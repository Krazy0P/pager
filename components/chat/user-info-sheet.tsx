"use client";

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
      <SheetContent className="w-full p-0 sm:max-w-md">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b px-6 py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex shrink-0 items-center justify-center">
                <span className="flex size-32 rounded-full">
                  <UserAvatar
                    name={profile.display_name}
                    src={profile.avatar_url}
                    size="xl"
                  />
                </span>
              </div>
              <SheetTitle className="text-base">{profile.display_name}</SheetTitle>
              <SheetDescription>@{profile.username}</SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <h3 className="text-sm font-medium">About</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {profile.bio?.trim() || "No bio yet."}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
