import { useBoxTimers, fmtTimer } from "./lib/useBoxTimers";
import { stageName } from "../core/stages";
import type { SlotLevelTimerGroup } from "../../shared/types";
import { AlwaysOnTopIconPin } from "./components/AlwaysOnTopPin";
import { IconButton } from "./components/ui/IconButton";
import { OverlayFrame } from "./components/ui/OverlayFrame";
import { sortSlotGroupsByLevel } from "./lib/boxTrackerUi";
import { cn } from "./lib/cn";

function CompactSlotLevelRow({ group }: { group: SlotLevelTimerGroup }) {
  const commonCd = group.common.status === "cooldown";
  const blueCd = group.stageBoss.status === "cooldown";

  return (
    <li className="flex flex-col gap-0.5 rounded border border-border/70 bg-card/50 px-1 py-0.5">
      <span className="truncate text-[9px] font-semibold text-muted">Lv{group.level} slots</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 rounded border px-1 py-0 text-[9px] font-semibold tabular-nums",
            commonCd
              ? "border-status-danger/40 text-status-danger"
              : "border-status-info/30 text-status-info",
          )}
          onClick={() =>
            void (commonCd
              ? window.tbh.clearSlotChestTimer("common", group.level)
              : window.tbh.markSlotChestDropped("common", group.level))
          }
        >
          G {commonCd ? fmtTimer(group.common.remainingSeconds) : "OK"}
        </button>
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 rounded border px-1 py-0 text-[9px] font-semibold tabular-nums",
            blueCd
              ? "border-status-danger/40 text-status-danger"
              : "border-status-info/30 text-status-info",
          )}
          onClick={() =>
            void (blueCd
              ? window.tbh.clearSlotChestTimer("stageBoss", group.level)
              : window.tbh.markSlotChestDropped("stageBoss", group.level))
          }
        >
          B {blueCd ? fmtTimer(group.stageBoss.remainingSeconds) : "OK"}
        </button>
      </div>
    </li>
  );
}

export function BoxTracker() {
  const state = useBoxTimers();

  if (!state) {
    return (
      <OverlayFrame density="compact">
        <p className="m-0 text-[11px] text-muted">Loading…</p>
      </OverlayFrame>
    );
  }

  const currentLabel = stageName(state.currentStageKey);
  const slotGroups = sortSlotGroupsByLevel(state.slotLevelGroups);

  return (
    <OverlayFrame density="compact">
      <div className="drag-handle flex shrink-0 items-center justify-between gap-1">
        <span className="truncate text-[10px] font-semibold text-muted">Chest timers</span>
        <div className="no-drag flex shrink-0 items-center gap-0.5">
          <AlwaysOnTopIconPin />
          <IconButton
            type="button"
            title="Minimize"
            onClick={() => window.tbh.minimizeBoxTracker()}
          >
            {"\u2212"}
          </IconButton>
          <IconButton type="button" title="Open main window" onClick={() => window.tbh.showMain()}>
            {"\u2922"}
          </IconButton>
          <IconButton
            type="button"
            edge="end"
            title="Close"
            onClick={() => window.tbh.closeBoxTracker()}
          >
            {"\u2715"}
          </IconButton>
        </div>
      </div>

      <div className="no-drag flex shrink-0 items-center gap-1.5 text-[9px] text-muted">
        <span className="truncate" title={currentLabel}>
          {currentLabel}
        </span>
      </div>

      {slotGroups.length > 0 ? (
        <ul className="no-drag m-0 flex min-h-0 flex-1 list-none flex-col gap-0.5 overflow-y-auto p-0">
          {slotGroups.map((group) => (
            <CompactSlotLevelRow key={group.level} group={group} />
          ))}
        </ul>
      ) : (
        <p className="no-drag m-0 text-center text-[10px] text-muted">No levels tracked.</p>
      )}
    </OverlayFrame>
  );
}
