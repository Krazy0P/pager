import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function UserAvatar({
  name,
  src,
  online,
  size = "default",
}: {
  name: string;
  src?: string | null;
  online?: boolean;
  size?: "default" | "sm" | "lg" | "xl";
}) {
  return (
    <span className="relative inline-flex rounded-full">
      <Avatar size={size} className="rounded-full">
        {src ? <AvatarImage src={src} alt={name} /> : null}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      {online ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background",
            size === "lg" && "size-3",
            size === "sm" && "size-2",
          )}
        />
      ) : null}
    </span>
  );
}
