"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ConversationPreview, Profile } from "@/lib/chat-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PAGER_AI_BOT_ID } from "@/lib/ai-bot";

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
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = conversation.created_by === myId;
  const othersRemaining = conversation.members.some(
    (member) => member.id !== myId && member.id !== PAGER_AI_BOT_ID,
  );
  // Mirrors leave_group: the admin's role passes on, and the last one out deletes the group
  const leaveConsequence = !othersRemaining
    ? "You're the last member, so the group and its messages will be deleted."
    : isAdmin
      ? "You're the admin, so another member will become admin. You'll stop getting messages from this group."
      : "You'll stop getting messages from this group and it will leave your chat list.";

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
    setLeaving(true);
    try {
      const { error } = await supabase.rpc("leave_group", {
        conv: conversation.id,
      });
      if (error) throw error;
      toast.success("You left the group");
      setConfirmLeaveOpen(false);
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
      <SheetContent className="w-full p-0 sm:max-w-md">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b px-6 py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <button
                type="button"
                className="group relative flex shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Change group photo"
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
              <SheetDescription>
                {conversation.members.length} member
                {conversation.members.length !== 1 ? "s" : ""}
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <h3 className="text-sm font-medium">Members</h3>
            <div className="-mx-2 space-y-0.5">
              {conversation.members.map((member: Profile) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2"
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
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Admin
                    </span>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={leaving}
              onClick={() => setConfirmLeaveOpen(true)}
            >
              <LogOut className="size-4" />
              Leave group
            </Button>
          </div>
        </div>
      </SheetContent>

      <Dialog
        open={confirmLeaveOpen}
        onOpenChange={(next) => {
          if (!leaving) setConfirmLeaveOpen(next);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="size-5 text-destructive" />
              Leave {conversation.name ?? "this group"}?
            </DialogTitle>
            <DialogDescription>{leaveConsequence}</DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              disabled={leaving}
              className="w-full gap-2"
              onClick={() => void leaveGroup()}
            >
              {leaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              {leaving ? "Leaving…" : !othersRemaining ? "Leave and delete group" : "Leave group"}
            </Button>
            <Button
              variant="ghost"
              disabled={leaving}
              className="w-full"
              onClick={() => setConfirmLeaveOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}