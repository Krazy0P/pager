import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

// Tinted fallbacks so people without a photo are still easy to tell apart
const FALLBACK_TONES = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
];

function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_TONES[Math.abs(hash) % FALLBACK_TONES.length];
}

export function UserAvatar({
  name,
  src,
  online,
  size = "default",
  className,
}: {
  name: string;
  src?: string | null;
  online?: boolean;
  size?: "default" | "sm" | "lg" | "xl";
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0 rounded-full", className)}>
      <Avatar size={size} className="rounded-full">
        {src ? <AvatarImage src={src} alt={name} /> : null}
        <AvatarFallback className={cn("font-medium", toneFor(name))}>
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {online ? (
        <span
          aria-label="Online"
          className={cn(
            "absolute bottom-0 right-0 size-2.5 rounded-full bg-online ring-2 ring-background",
            size === "lg" && "size-3",
            size === "sm" && "size-2",
          )}
        />
      ) : null}
    </span>
  );
}
