import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "full" | "info" | "success" | "muted" | "statusReady" | "statusCooldown";

const variantClasses: Record<Variant, string> = {
  full: "bg-[#c94a4a] font-semibold text-white",
  info: "border border-[#3a6a8a] bg-card font-semibold text-[#5a9fd1]",
  success: "border border-[#3d6b52] bg-card font-semibold text-[#6fcf97]",
  muted: "border border-border bg-card font-medium text-muted",
  statusReady: "bg-[rgba(111,207,151,0.15)] font-bold tabular-nums text-[#6fcf97]",
  statusCooldown: "bg-[rgba(90,159,209,0.15)] font-bold tabular-nums text-[#5a9fd1]",
};

export function Badge({
  children,
  variant = "full",
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-[11px]", variantClasses[variant], className)}
    >
      {children}
    </span>
  );
}
