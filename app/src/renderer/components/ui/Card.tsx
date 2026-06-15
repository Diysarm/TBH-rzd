import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Padding = "default" | "compact" | "none";
type CardElement = "div" | "li";

const paddingClasses: Record<Padding, string> = {
  default: "p-3.5",
  compact: "p-2.5",
  none: "",
};

export function Card({
  as: Tag = "div",
  className,
  padding = "default",
  ...props
}: HTMLAttributes<HTMLElement> & { as?: CardElement; padding?: Padding }) {
  return (
    <Tag
      className={cn(
        "rzd-card-glow rounded-xl border border-border/90 bg-card/90 backdrop-blur-sm",
        paddingClasses[padding],
        className,
      )}
      {...props}
    />
  );
}
