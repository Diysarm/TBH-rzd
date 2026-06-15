import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border/80 bg-card/40 p-3.5",
        className,
      )}
    >
      <h2 className="rzd-display m-0 text-sm font-semibold tracking-wide text-accent">{title}</h2>
      {children}
    </section>
  );
}
