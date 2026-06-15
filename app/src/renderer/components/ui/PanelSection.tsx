import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function PanelSection({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h2 className="rzd-display m-0 text-xs font-semibold uppercase tracking-[0.14em] text-accent/90">
        {title}
      </h2>
      {children}
    </section>
  );
}
