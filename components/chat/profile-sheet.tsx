"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AccountSettings } from "@/components/chat/account-settings";
import type { Profile } from "@/lib/chat-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { centerCropSquare } from "@/lib/image";

export function ProfileSheet({
  open,
  onOpenChange,
  profile,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  onUpdated: (profile: Profile) => void;
}) {
  const supabase = createClient();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [section, setSection] = useState<"profile" | "account">("profile");
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync state when profile prop changes
  useEffect(() => {
    if (open) {
      setSection("profile");
      setDisplayName(profile.display_name);
      setUsername(profile.username);
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [open, profile]);

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP, GIF)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Avatar image must be under 5 MB");
      return;
    }

    setUploading(true);
    try {
      const croppedFile = await centerCropSquare(file);
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, croppedFile, {
          upsert: true,
          contentType: croppedFile.type,
        });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    // Sanitize username: lowercase, alphanumeric and underscores only
    const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(clean);
  };

  const save = async () => {
    const trimmedDisplay = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!trimmedDisplay) {
      toast.error("Display name cannot be empty");
      return;
    }
    if (!cleanUsername) {
      toast.error("Username cannot be empty");
      return;
    }
    if (cleanUsername.length < 3) {
      toast.error("Username must be at least 3 characters long");
      return;
    }

    setSaving(true);
    try {
      // If username has changed, check for uniqueness first
      if (cleanUsername !== profile.username) {
        const { data: existing, error: checkError } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", cleanUsername)
          .neq("id", profile.id)
          .maybeSingle();

        if (checkError) throw checkError;
        if (existing) {
          toast.error(`Username @${cleanUsername} is already taken. Please choose another.`);
          setSaving(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          display_name: trimmedDisplay,
          username: cleanUsername,
          bio: bio.trim() || null,
          avatar_url: avatarUrl || null,
        })
        .eq("id", profile.id)
        .select("*")
        .single();

      if (error) {
        if (error.message.includes("unique") || error.code === "23505") {
          toast.error(`Username @${cleanUsername} is already taken`);
          return;
        }
        throw error;
      }

      onUpdated(data as Profile);
      toast.success("Profile updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="space-y-4 border-b px-6 py-5 text-left">
          <div className="space-y-1.5">
            <SheetTitle className="text-base">Settings</SheetTitle>
            <SheetDescription>
              {section === "profile"
                ? "This is how other people see you in Pager."
                : "Manage how you sign in to Pager."}
            </SheetDescription>
          </div>
          <div role="tablist" className="grid grid-cols-2 rounded-lg bg-muted p-0.5">
            {(["profile", "account"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={section === item}
                onClick={() => setSection(item)}
                className={cn(
                  "h-7 rounded-md text-[13px] font-medium capitalize transition-colors",
                  section === item
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </SheetHeader>

        {section === "account" ? (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <AccountSettings />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {/* Photo */}
              <div
                className={cn(
                  "-m-3 flex items-center gap-4 rounded-xl border border-dashed p-3 transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-transparent",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void uploadAvatar(file);
                }}
              >
                <Avatar className="size-20">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="text-2xl font-medium">
                    {initials(displayName || username)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    {uploading ? "Uploading…" : "Change photo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WebP or GIF. You can also drop an image here.
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    await uploadAvatar(file);
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="display-name">Display name</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {displayName.length}/50
                  </span>
                </div>
                <Input
                  id="display-name"
                  value={displayName}
                  maxLength={50}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="username">Username</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {username.length}/24
                  </span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    value={username}
                    maxLength={24}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="username"
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers and underscores.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio">Bio</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{bio.length}/160</span>
                </div>
                <Textarea
                  id="bio"
                  value={bio}
                  maxLength={160}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Your role, team, or what you're working on"
                  rows={3}
                  className="min-h-20 resize-none text-sm"
                />
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving || uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void save()}
                disabled={saving || uploading || !displayName.trim() || !username.trim()}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
