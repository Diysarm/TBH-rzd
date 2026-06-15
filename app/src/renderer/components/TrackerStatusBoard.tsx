import type { BoxTimerRow, BoxTrackerSortOrder } from "../../../shared/types";
import { fmtTimer } from "../lib/useBoxTimers";
import { boxTrackerRowsBySection, boxTrackerSectionOrder } from "../lib/boxTrackerUi";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { CapacityBar } from "./ui/CapacityBar";
import { cn } from "../lib/cn";

function TrackerStatusCard({ row }: { row: BoxTimerRow }) {
  const onCooldown = row.status === "cooldown";

  return (
    <article
      className={cn(
        "flex min-w-[9.5rem] flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5",
        "border-l-[3px]",
        onCooldown ? "border-l-status-info" : "border-l-status-success",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">Lv{row.level ?? "?"}</span>
        <Badge variant={onCooldown ? "statusCooldown" : "statusReady"}>
          {onCooldown ? fmtTimer(row.remainingSeconds) : "Ready"}
        </Badge>
      </div>
      <p className="m-0 truncate text-[10px] text-muted" title={row.idealStageLabel}>
        {row.idealStageLabel}
      </p>
      {onCooldown ? (
        <>
          <CapacityBar percent={row.progress * 100} variant="blue" compact />
          <Button
            size="sm"
            variant="ghost"
            className="w-full"
            onClick={() => void window.tbh.clearBoxTimer(row.boxId)}
          >
            Reset
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="success"
          className="w-full"
          onClick={() => void window.tbh.markBoxDropped(row.boxId)}
        >
          Dropped
        </Button>
      )}
    </article>
  );
}

export function TrackerStatusBoard({
  rows,
  sortOrder,
}: {
  rows: BoxTimerRow[];
  sortOrder: BoxTrackerSortOrder;
}) {
  if (rows.length === 0) return null;

  const sections = boxTrackerSectionOrder(sortOrder);

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => {
        const sectionRows = boxTrackerRowsBySection(rows, section);
        if (sectionRows.length === 0) return null;
        return (
          <div key={section} className="flex flex-col gap-1.5">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {section === "cooldown" ? "On cooldown" : "Ready to mark"}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {sectionRows.map((row) => (
                <TrackerStatusCard key={row.boxId} row={row} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
