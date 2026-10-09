"use client";

import { useEffect, useRef, useState } from "react";
import {
  AtSign,
  Camera,
  Check,
  Info,
  Loader2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync state when profile prop changes
  useEffect(() => {
    if (open) {
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
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
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
        className="flex flex-col sm:max-w-md p-0 overflow-hidden"
      >
        {/* Decorative Top Banner */}
        <div className="relative h-36 w-full bg-muted border-b border-border/40 overflow-hidden shrink-0" />

        {/* Large Floating Avatar & Identity Preview */}
        <div className="relative px-6 -mt-20 flex flex-col items-center shrink-0">
          <div
            className={`relative group cursor-pointer rounded-full p-1.5 bg-background shadow-2xl ring-4 transition-all duration-200 ${
              dragOver
                ? "ring-primary scale-105"
                : "ring-background/90 hover:ring-primary/60"
            }`}
            onClick={() => fileRef.current?.click()}
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
            title="Click or drag an image to change profile photo"
          >
            {/* Enlarged Avatar size (size-32 = 128px) */}
            <Avatar className="size-32 border-2 border-background shadow-inner">
              {avatarUrl ? (
                <AvatarImage
                  src={avatarUrl}
                  alt={displayName}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="text-4xl font-bold bg-gradient-to-br from-muted via-muted/90 to-muted/70 text-foreground">
                {initials(displayName || username)}
              </AvatarFallback>
            </Avatar>

            {/* Hover overlay with clean camera icon */}
            <div className="absolute inset-1.5 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity backdrop-blur-xs">
              {uploading ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <>
                  <Camera className="size-6 drop-shadow-sm" />
                  <span className="text-[11px] font-semibold mt-1 tracking-tight">
                    Change Photo
                  </span>
                </>
              )}
            </div>
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

          {/* Clean Header Identity Preview */}
          <div className="mt-3 text-center">
            <h3 className="font-bold text-xl tracking-tight text-foreground">
              {displayName || "Unnamed User"}
            </h3>
            <p className="text-xs font-mono text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
              <AtSign className="size-3" />
              {username}
            </p>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <SheetHeader className="sr-only">
            <SheetTitle>Edit Profile</SheetTitle>
            <SheetDescription>
              Update your display name, username, bio, and avatar photo.
            </SheetDescription>
          </SheetHeader>

          {/* Identity Fields Card */}
          <div className="rounded-xl border bg-card p-4 space-y-4 shadow-xs">
            {/* Display Name Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="display-name"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <User className="size-3.5 text-primary" />
                  Display Name
                </Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {displayName.length}/50
                </span>
              </div>
              <Input
                id="display-name"
                value={displayName}
                maxLength={50}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your full name or nickname"
                className="h-10 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <p className="text-[11px] text-muted-foreground">
                The public name shown above your messages and on conversation lists.
              </p>
            </div>

            {/* Username Input */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="username"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <AtSign className="size-3.5 text-primary" />
                  Username
                </Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {username.length}/24
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-mono text-muted-foreground select-none">
                  @
                </span>
                <Input
                  id="username"
                  value={username}
                  maxLength={24}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="username"
                  className="h-10 pl-7 text-sm font-mono transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your unique handle used for mentions and direct search (lowercase, numbers, underscores).
              </p>
            </div>

            {/* Bio Input */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="bio"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <Info className="size-3.5 text-primary" />
                  About / Bio
                </Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {bio.length}/160
                </span>
              </div>
              <Textarea
                id="bio"
                value={bio}
                maxLength={160}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a short bio, team role, or status…"
                rows={3}
                className="resize-none text-sm leading-relaxed transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Sticky Actions Footer */}
        <div className="border-t bg-card/80 backdrop-blur-md p-4 flex gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving || uploading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-2 shadow-sm font-semibold"
            onClick={() => void save()}
            disabled={saving || uploading || !displayName.trim() || !username.trim()}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
