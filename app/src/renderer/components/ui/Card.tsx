import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Padding = "default" | "compact" | "none";

const paddingClasses: Record<Padding, string> = {
  default: "p-3",
  compact: "p-2.5",
  none: "",
};

export function Card({
  className,
  padding = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: Padding }) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card", paddingClasses[padding], className)}
      {...props}
    />
  );
}
