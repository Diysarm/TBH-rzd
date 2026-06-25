import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "default" | "primary" | "danger" | "ghost" | "success";
type Size = "default" | "lg" | "sm";

const variantClasses: Record<Variant, string> = {
  default: "bg-card/80 border-border text-fg hover:border-accent/50 hover:bg-card",
  primary:
    "bg-accent border-accent/80 text-accent-fg font-semibold shadow-[0_2px_12px_rgb(240_180_41/0.25)] hover:brightness-110",
  danger: "bg-card border-danger/60 text-danger-fg hover:border-danger",
  ghost:
    "border-border/60 bg-transparent text-muted hover:border-accent/30 hover:bg-card/50 hover:text-fg",
  success:
    "border-status-success-border bg-status-success/10 font-semibold text-status-success hover:bg-status-success/20",
};

const sizeClasses: Record<Size, string> = {
  default: "px-3.5 py-1.5 text-[13px]",
  lg: "px-4 py-2.5 text-[13px]",
  sm: "px-2.5 py-0.5 text-xs",
};

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
