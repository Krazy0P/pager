import { cn } from "@/lib/utils";

// Lucide "message-circle-dashed" (ISC), drawn on the brand tile. Keep in sync with app/icon.svg.
const ICON_PATHS = [
  "M13.5 3.1c-.5 0-1-.1-1.5-.1s-1 .1-1.5.1",
  "M19.3 6.8a10.45 10.45 0 0 0-2.1-2.1",
  "M20.9 13.5c.1-.5.1-1 .1-1.5s-.1-1-.1-1.5",
  "M17.2 19.3a10.45 10.45 0 0 0 2.1-2.1",
  "M10.5 20.9c.5.1 1 .1 1.5.1s1-.1 1.5-.1",
  "M3.5 17.5 2 22l4.5-1.5",
  "M3.1 10.5c0 .5-.1 1-.1 1.5s.1 1 .1 1.5",
  "M6.8 4.7a10.45 10.45 0 0 0-2.1 2.1",
];

/** Pager logo mark: a dashed message bubble on the brand color. */
export function PagerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
    >
      <rect width="24" height="24" rx="6.5" className="fill-primary" />
      <g
        transform="translate(4.8 4.8) scale(0.6)"
        fill="none"
        stroke="white"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICON_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
