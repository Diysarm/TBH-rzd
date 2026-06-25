import type { ReactNode } from "react";
import { Card } from "./Card";
import { cn } from "../../lib/cn";

export function StatCard({
  label,
  value,
  valueFirst = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  valueFirst?: boolean;
  className?: string;
}) {
  return (
    <Card
      padding="compact"
      className={cn(
        "border-accent/10 bg-gradient-to-br from-panel to-card",
        className,
      )}
    >
      {valueFirst ? (
        <div className="flex flex-col gap-1">
          <div className="text-[15px] font-bold leading-snug tabular-nums text-gold sm:text-lg">{value}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</span>
          <span className="text-lg font-bold tabular-nums text-fg">{value}</span>
        </div>
      )}
    </Card>
  );
}
