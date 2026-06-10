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
    <header className="tab-header">
      <h1>{title}</h1>
      {intro ? <p className="muted">{intro}</p> : null}
      {children}
    </header>
  );
}
