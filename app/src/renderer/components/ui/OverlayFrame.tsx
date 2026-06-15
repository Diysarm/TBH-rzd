import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Frameless overlay shell. */
export function OverlayFrame({
  children,
  className,
  density = "default",
}: {
  children: ReactNode;
  className?: string;
  density?: "default" | "compact";
}) {
  return (
    <div
      className={cn(
        "overlay box-border flex h-full min-h-0 w-full flex-col overflow-hidden border border-border bg-bg",
        density === "compact" ? "gap-0.5 px-1.5 py-1" : "gap-1 px-2.5 py-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
