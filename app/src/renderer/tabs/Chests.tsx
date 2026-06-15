import { useChests } from "../lib/useChests";
import type { BoxSlotStatus } from "../../../shared/types";
import { Badge } from "../components/ui/Badge";
import { CapacityBar } from "../components/ui/CapacityBar";
import { TabHeader } from "../components/ui/TabHeader";
import { TabPage } from "../components/ui/TabPage";
import { ChestsTrackerPanel } from "../components/ChestsTrackerPanel";
import { cn } from "../lib/cn";

function SlotStrip({
  label,
  slot,
  variant,
}: {
  label: string;
  slot: BoxSlotStatus;
  variant: "gray" | "blue" | "red";
}) {
  const pct = slot.capacity > 0 ? Math.min(100, (slot.quantity / slot.capacity) * 100) : 0;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-border bg-card/50 px-2.5 py-2",
        slot.isFull && "border-status-danger/40 bg-status-danger/5",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</span>
        {slot.isFull ? <Badge>Full</Badge> : null}
      </div>
      <p className="m-0 text-sm font-semibold tabular-nums">
        {slot.quantity}/{slot.capacity}
      </p>
      <CapacityBar percent={pct} variant={variant} compact />
    </div>
  );
}

export function Chests() {
  const chests = useChests();

  if (!chests) {
    return (
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-lg font-semibold">Chests</h1>
        <p className="m-0 text-muted">Waiting for save data…</p>
      </div>
    );
  }

  const { common, stageBoss, actBoss, totalHeld } = chests;

  return (
    <TabPage>
      <TabHeader
        title="Chests"
        intro={`${totalHeld.toLocaleString()} unopened · slots update every few seconds from save.`}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <SlotStrip label="Common" slot={common} variant="gray" />
        <SlotStrip label="Stage boss" slot={stageBoss} variant="blue" />
        <SlotStrip label="Act boss" slot={actBoss} variant="red" />
      </div>

      <ChestsTrackerPanel />
    </TabPage>
  );
}
