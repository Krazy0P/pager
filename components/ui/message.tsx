import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Root row. `from` drives alignment of every child via group-data selectors. */
function Message({
  className,
  from = "received",
  ...props
}: React.ComponentProps<"div"> & { from?: "sent" | "received" }) {
  return (
    <div
      data-slot="message"
      data-from={from}
      className={cn(
        "group/message relative flex gap-2",
        from === "sent" ? "flex-row-reverse" : "flex-row",
        className,
      )}
      {...props}
    />
  );
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "relative flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[min(75%,42rem)]",
        "group-data-[from=sent]/message:items-end group-data-[from=sent]/message:text-right",
        className,
      )}
      {...props}
    />
  );
}

function MessageAuthor({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="message-author"
      className={cn("px-1 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Row holding the bubble + side (time & hover actions). */
function MessageBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-body"
      className={cn(
        "flex w-fit max-w-full items-center gap-1",
        "group-data-[from=sent]/message:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}

const messageBubbleVariants = cva(
  "w-fit max-w-full break-words rounded-2xl px-3 py-1.5 text-left text-sm leading-relaxed transition-shadow",
  {
    variants: {
      variant: {
        // the small corner is the "tail" side
        sent: "rounded-br-md bg-primary text-primary-foreground",
        received: "rounded-bl-md bg-bubble text-bubble-foreground",
      },
      deleted: {
        true: "border border-dashed bg-transparent italic text-muted-foreground",
        false: "",
      },
      selected: {
        true: "ring-2 ring-primary ring-offset-2 ring-offset-background",
        false: "",
      },
    },
    defaultVariants: { variant: "received", deleted: false, selected: false },
  },
);

function MessageBubble({
  className,
  variant,
  deleted,
  selected,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof messageBubbleVariants>) {
  return (
    <div
      data-slot="message-bubble"
      className={cn(
        messageBubbleVariants({ variant, deleted, selected }),
        className,
      )}
      {...props}
    />
  );
}

/** Holds time + hover actions beside the bubble. Mirrors for sent messages. */
function MessageSide({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-side"
      className={cn(
        "flex shrink-0 items-center gap-1",
        "group-data-[from=sent]/message:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}

/** Time / edited / delivery status. Revealed on hover, like the actions. */
function MessageMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-meta"
      className={cn(
        "flex select-none items-center gap-1 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground opacity-0 transition-opacity",
        "group-hover/message:opacity-100 group-focus-within/message:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

/** Hover-only action buttons (emoji picker, more options). */
function MessageActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-actions"
      className={cn(
        "flex shrink-0 items-center gap-0.5 text-muted-foreground opacity-0 transition-opacity",
        "group-hover/message:opacity-100 group-focus-within/message:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

/** Reaction strip rendered BELOW the bubble. */
function MessageReactions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-reactions"
      className={cn(
        "flex w-full flex-wrap gap-1",
        "justify-start group-data-[from=sent]/message:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function MessageReaction({
  className,
  emoji,
  count,
  active = false,
  ...props
}: React.ComponentProps<"button"> & {
  emoji: string;
  count: number;
  /** True when the current user has reacted with this emoji */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="message-reaction"
      data-active={active}
      aria-pressed={active}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:bg-accent",
        className,
      )}
      {...props}
    >
      <span>{emoji}</span>
      <span className={cn("tabular-nums", !active && "text-muted-foreground")}>{count}</span>
    </button>
  );
}

export {
  Message,
  MessageContent,
  MessageAuthor,
  MessageBody,
  MessageBubble,
  MessageMeta,
  MessageSide,
  MessageActions,
  MessageReactions,
  MessageReaction,
};