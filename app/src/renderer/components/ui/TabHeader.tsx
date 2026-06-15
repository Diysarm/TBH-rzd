import type { ReactNode } from "react";

export function TabHeader({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-1 flex flex-col gap-1.5 border-b border-border/80 pb-3">
      <h1 className="rzd-display m-0 text-xl font-semibold tracking-wide text-fg">{title}</h1>
      {intro ? <p className="m-0 max-w-prose text-[13px] leading-relaxed text-muted">{intro}</p> : null}
      {children}
    </header>
  );
}
