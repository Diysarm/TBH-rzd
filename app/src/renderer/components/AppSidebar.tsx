import type { TabId } from "./AppTabBar";
import { AppToolbar } from "./AppToolbar";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../../../shared/product";
import capsuleArt from "../assets/brand/capsule.jpg";
import { cn } from "../lib/cn";

const NAV: { id: TabId; label: string; icon: string }[] = [
  { id: "live", label: "Live", icon: "⚡" },
  { id: "inventory", label: "Inventory", icon: "🎒" },
  { id: "chests", label: "Chests", icon: "📦" },
  { id: "pets", label: "Pets", icon: "🐾" },
  { id: "market", label: "Market", icon: "💰" },
  { id: "settings", label: "Settings", icon: "⚙" },
  { id: "about", label: "About", icon: "✦" },
];

export function AppSidebar({
  tab,
  onTabChange,
}: {
  tab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <aside className="rzd-panel-glow flex w-[11.5rem] shrink-0 flex-col border-r border-border bg-panel">
      <div className="border-b border-border p-3">
        <div className="overflow-hidden rounded-md border border-border/80 shadow-lg">
          <img
            src={capsuleArt}
            alt="Task Bar Hero"
            className="block h-auto w-full object-cover"
            draggable={false}
          />
        </div>
        <p className="rzd-display m-0 mt-2.5 text-base font-semibold text-accent">{PRODUCT_NAME}</p>
        <p className="m-0 mt-0.5 text-[10px] leading-snug text-muted">{PRODUCT_TAGLINE}</p>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Main">
        {NAV.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors",
                active
                  ? "border-accent/40 bg-accent/10 font-semibold text-accent"
                  : "border-transparent bg-transparent text-muted hover:border-border hover:bg-card/60 hover:text-fg",
              )}
            >
              <span className="text-base leading-none" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <AppToolbar />
      </div>
    </aside>
  );
}
