import { useBoxTimers, fmtTimer } from "./lib/useBoxTimers";
import { stageName } from "../core/stages";
import type { BoxTimerRow } from "../../shared/types";
import { AlwaysOnTopIconPin } from "./components/AlwaysOnTopPin";
import { IconButton } from "./components/ui/IconButton";
import { OverlayFrame } from "./components/ui/OverlayFrame";
import { cn } from "./lib/cn";

function CompactTimerRow({ row }: { row: BoxTimerRow }) {
  const onCooldown = row.status === "cooldown";

  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded border border-border/70 bg-card/50 px-1 py-0.5",
        "border-l-2",
        onCooldown ? "border-l-status-info" : "border-l-status-success",
        row.atIdealStage && "ring-1 ring-ideal/20",
      )}
      title={`${row.idealStageLabel}${row.clearTimeSeconds > 0 ? ` · −${row.clearTimeSeconds}s clear` : ""}`}
    >
      <span className="w-7 shrink-0 text-[11px] font-semibold tabular-nums">Lv{row.level ?? "?"}</span>
      <span
        className={cn(
          "min-w-[3.25rem] shrink-0 text-center text-[10px] font-bold tabular-nums",
          onCooldown ? "text-status-info" : "text-status-success",
        )}
      >
        {onCooldown ? fmtTimer(row.remainingSeconds) : "OK"}
      </span>
      {onCooldown ? (
        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-border/80">
          <div
            className="h-full rounded-full bg-status-info transition-[width]"
            style={{ width: `${Math.round(row.progress * 100)}%` }}
          />
        </div>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[9px] text-muted">{row.idealStageLabel}</span>
      )}
      <button
        type="button"
        className={cn(
          "shrink-0 cursor-pointer rounded border px-1.5 py-0 text-[10px] font-semibold leading-5",
          onCooldown
            ? "border-border bg-transparent text-muted hover:text-fg"
            : "border-status-success-border bg-status-success/15 text-status-success hover:bg-status-success/25",
        )}
        onClick={() =>
          void (onCooldown
            ? window.tbh.clearBoxTimer(row.boxId)
            : window.tbh.markBoxDropped(row.boxId))
        }
      >
        {onCooldown ? "Rst" : "Drop"}
      </button>
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

  return (
    <OverlayFrame density="compact">
      <div className="drag-handle flex shrink-0 items-center justify-between gap-1">
        <span className="truncate text-[10px] font-semibold text-muted">Boss chests</span>
        <div className="no-drag flex shrink-0 items-center gap-0.5">
          <AlwaysOnTopIconPin />
          <IconButton type="button" title="Minimize" onClick={() => window.tbh.minimizeBoxTracker()}>
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
        <span className="text-status-info">{state.cooldownCount} cd</span>
        <span aria-hidden>·</span>
        <span className="text-status-success">{state.readyCount} ok</span>
        <span aria-hidden>·</span>
        <span className="truncate" title={currentLabel}>
          {currentLabel}
        </span>
      </div>

      {state.rows.length === 0 ? (
        <p className="no-drag m-0 text-center text-[10px] text-muted">No levels tracked.</p>
      ) : (
        <ul className="no-drag m-0 flex min-h-0 flex-1 list-none flex-col gap-0.5 overflow-y-auto p-0">
          {state.rows.map((row) => (
            <CompactTimerRow key={row.boxId} row={row} />
          ))}
        </ul>
      )}
    </OverlayFrame>
  );
}
