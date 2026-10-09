"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ConversationPreview, Profile } from "@/lib/chat-types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/components/chat/user-avatar";
import { Separator } from "@/components/ui/separator";
import { centerCropSquare } from "@/lib/image";

export function GroupInfoSheet({
  open,
  onOpenChange,
  conversation,
  myId,
  onLeft,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationPreview;
  myId: string;
  onLeft: () => void;
  onUpdated: (conversation: ConversationPreview) => void;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Group avatar must be under 5 MB");
      return;
    }

    setUploading(true);
    try {
      const croppedFile = await centerCropSquare(file);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${conversation.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("group-avatars")
        .upload(path, croppedFile, {
          upsert: true,
          contentType: croppedFile.type,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("group-avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error } = await supabase
        .from("conversations")
        .update({ avatar_url: avatarUrl })
        .eq("id", conversation.id);
      if (error) throw error;

      onUpdated({ ...conversation, avatar_url: avatarUrl });
      toast.success("Group photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload group photo");
    } finally {
      setUploading(false);
    }
  };

  const leaveGroup = async () => {
    if (!confirm("Leave this group?")) return;
    setLeaving(true);
    try {
      const { error } = await supabase.rpc("leave_group", {
        conv: conversation.id,
      });
      if (error) throw error;
      toast.success("You left the group");
      onOpenChange(false);
      onLeft();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not leave");
    } finally {
      setLeaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full border-l border-border/80 bg-card/95 p-0 sm:max-w-md">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/80 bg-muted/20 px-6 py-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <button
                type="button"
                className="group relative flex size-36 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted p-1 shadow-lg ring-1 ring-border/70"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                title="Change group photo"
              >
                {/* Overlay is anchored to this wrapper, so it always matches the avatar exactly */}
                <span className="relative flex size-32 rounded-full">
                  <UserAvatar
                    name={conversation.name ?? "Group"}
                    src={conversation.avatar_url}
                    size="xl"
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <Camera className="size-5" />
                    )}
                  </span>
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadAvatar(file);
                }}
              />
              <SheetTitle className="text-base">{conversation.name ?? "Group"}</SheetTitle>
              <SheetDescription className="text-xs">
                {conversation.members.length} member
                {conversation.members.length !== 1 ? "s" : ""}
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Members
            </p>
            <div className="space-y-1 rounded-lg border border-border/70 bg-background/40 p-1.5">
              {conversation.members.map((member: Profile) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-muted/50"
                >
                  <UserAvatar
                    name={member.display_name}
                    src={member.avatar_url}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.display_name}
                      {member.id === myId && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{member.username}
                    </p>
                  </div>
                  {conversation.created_by === member.id && (
                    <span className="text-xs font-medium text-primary">
                      Admin
                    </span>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            <Button
              variant="destructive"
              className="h-9 w-full"
              disabled={leaving}
              onClick={() => void leaveGroup()}
            >
              {leaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 size-4" />
              )}
              {leaving ? "Leaving…" : "Leave group"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}