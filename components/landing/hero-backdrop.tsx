import { cn } from "@/lib/utils";

/** Rounded-rect path with per-corner radii; the small corner reads as a bubble tail. */
function bubblePath(w: number, h: number, tail: "left" | "right") {
  const r = Math.min(16, h / 2);
  const bl = tail === "left" ? 4 : r;
  const br = tail === "right" ? 4 : r;
  return [
    `M${r},0`,
    `H${w - r}`,
    `A${r},${r} 0 0 1 ${w},${r}`,
    `V${h - br}`,
    `A${br},${br} 0 0 1 ${w - br},${h}`,
    `H${bl}`,
    `A${bl},${bl} 0 0 1 0,${h - bl}`,
    `V${r}`,
    `A${r},${r} 0 0 1 ${r},0`,
    "Z",
  ].join(" ");
}

function Bubble({
  width,
  lines,
  tail,
  filled,
  className,
}: {
  width: number;
  lines: number[];
  tail: "left" | "right";
  filled?: boolean;
  className?: string;
}) {
  const height = 20 + lines.length * 14;
  return (
    <svg
      width={width + 2}
      height={height + 2}
      viewBox={`-1 -1 ${width + 2} ${height + 2}`}
      className={className}
    >
      <path
        d={bubblePath(width, height, tail)}
        className={cn(
          filled ? "fill-primary/10 stroke-primary/40" : "fill-background stroke-border",
        )}
        strokeWidth="1"
        strokeDasharray={filled ? undefined : "4 4"}
      />
      {lines.map((fraction, i) => (
        <rect
          key={i}
          x="14"
          y={14 + i * 14}
          width={(width - 28) * fraction}
          height="6"
          rx="3"
          className={filled ? "fill-primary/30" : "fill-muted-foreground/20"}
        />
      ))}
    </svg>
  );
}

function Avatar({ className, tone }: { className?: string; tone: string }) {
  return <span className={cn("size-8 shrink-0 rounded-full", tone, className)} />;
}

/** Decorative vectors behind the landing hero. Purely visual. */
export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Fine grid, fading out from the top */}
      <svg className="absolute inset-x-0 top-0 h-[720px] w-full text-border [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_30%,transparent_100%)]">
        <defs>
          <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>

      {/* Glow behind the product preview */}
      <div className="absolute left-1/2 top-[520px] h-[420px] w-[min(64rem,100%)] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl dark:bg-primary/[0.07]" />

      {/* Floating conversation fragments, wide screens only */}
      <div className="absolute left-[max(2rem,calc(50%-41rem))] top-24 hidden flex-col gap-2 xl:flex motion-safe:animate-float">
        <div className="flex items-end gap-2">
          <Avatar tone="bg-emerald-500/20" />
          <Bubble width={168} lines={[1, 0.6]} tail="left" />
        </div>
        <div className="ml-10">
          <Bubble width={116} lines={[0.8]} tail="left" />
        </div>
      </div>

      <div className="absolute right-[max(2rem,calc(50%-41rem))] top-48 hidden flex-col items-end gap-2 xl:flex motion-safe:animate-float-delayed">
        <Bubble width={180} lines={[1, 0.75]} tail="right" filled />
        <div className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1.5 shadow-sm">
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          <span className="size-1.5 rounded-full bg-muted-foreground/30" />
        </div>
      </div>

      <div className="absolute left-[max(4rem,calc(50%-36rem))] top-[360px] hidden items-end gap-2 xl:flex motion-safe:animate-float-delayed">
        <Avatar tone="bg-amber-500/20" />
        <Bubble width={132} lines={[0.9]} tail="left" />
      </div>

      <div className="absolute right-[max(4rem,calc(50%-38rem))] top-[400px] hidden xl:block motion-safe:animate-float">
        <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-primary/40 bg-background">
          <span className="size-2 rounded-full bg-primary/50" />
        </span>
      </div>
    </div>
  );
}
