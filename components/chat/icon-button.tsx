"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Ghost icon button with a tooltip; `label` doubles as the accessible name. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { label: string; side?: "top" | "bottom" | "left" | "right" }
>(function IconButton({ label, side = "bottom", className, variant = "ghost", ...props }, ref) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          type="button"
          variant={variant}
          size="icon"
          aria-label={label}
          className={cn(
            "size-8 shrink-0 text-muted-foreground hover:text-foreground [&_svg]:size-4",
            className,
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
});
