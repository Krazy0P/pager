"use client";

import { LogOut, Users } from "lucide-react";
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

export function GroupInfoSheet({
  open,
  onOpenChange,
  conversation,
  myId,
  onLeft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationPreview;
  myId: string;
  onLeft: () => void;
}) {
  const supabase = createClient();

  const leaveGroup = async () => {
    if (!confirm("Leave this group?")) return;
    try {
      const { error } = await supabase
        .from("conversation_members")
        .delete()
        .eq("conversation_id", conversation.id)
        .eq("user_id", myId);
      if (error) throw error;
      toast.success("You left the group");
      onOpenChange(false);
      onLeft();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not leave");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-muted">
              <Users className="size-4" />
            </span>
            {conversation.name ?? "Group"}
          </SheetTitle>
          <SheetDescription>
            {conversation.members.length} member
            {conversation.members.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Members
          </p>
          <div className="space-y-2">
            {conversation.members.map((member: Profile) => (
              <div key={member.id} className="flex items-center gap-3">
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
            className="w-full"
            onClick={() => void leaveGroup()}
          >
            <LogOut className="mr-2 size-4" />
            Leave group
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
