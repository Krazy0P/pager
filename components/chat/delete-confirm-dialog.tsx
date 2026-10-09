"use client";

import { Trash2, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  count,
  canDeleteForEveryone,
  deleting,
  onDeleteForEveryone,
  onDeleteForMe,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of selected messages being deleted */
  count: number;
  /** True only when every selected message belongs to the current user */
  canDeleteForEveryone: boolean;
  deleting: boolean;
  onDeleteForEveryone: () => void;
  onDeleteForMe: () => void;
}) {
  const isSingle = count === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            {isSingle ? "Delete message?" : `Delete ${count} messages?`}
          </DialogTitle>
          <DialogDescription>
            {canDeleteForEveryone
              ? isSingle
                ? "You can delete this message for everyone or delete it just for yourself."
                : "You can delete these messages for everyone or delete them just for yourself."
              : isSingle
                ? "This message was sent by someone else. You can only delete it for yourself."
                : "Some messages were sent by others. You can only delete them for yourself."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {canDeleteForEveryone && (
            <Button
              id="delete-for-everyone-btn"
              variant="destructive"
              disabled={deleting}
              className="w-full gap-2"
              onClick={onDeleteForEveryone}
            >
              <Users className="size-4" />
              Delete for everyone
            </Button>
          )}
          <Button
            id="delete-for-me-btn"
            variant={canDeleteForEveryone ? "outline" : "destructive"}
            disabled={deleting}
            className="w-full gap-2"
            onClick={onDeleteForMe}
          >
            <User className="size-4" />
            Delete for me
          </Button>
          <Button
            id="cancel-delete-btn"
            variant="ghost"
            disabled={deleting}
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
