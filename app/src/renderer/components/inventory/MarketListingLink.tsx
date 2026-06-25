import type { ReactNode } from "react";
import { steamMarketListingUrl } from "../../../core/steamPrice";

export function MarketListingLink({
  hash,
  children,
  title,
  className,
}: {
  hash: string;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <a
      href={steamMarketListingUrl(hash)}
      className={className ?? "text-inherit no-underline hover:text-accent hover:underline"}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? "Open on Steam Market"}
    >
      {children}
    </a>
  );
}
