import { useBoxTimers } from "../lib/useBoxTimers";
import {
  applyTrackerPreset,
  enabledCatalogEntries,
  formatCooldownMinutes,
  normalizeBoxTrackerSortOrder,
  toggleTrackedLevel,
  TRACKER_LEVEL_CHIP_GRID_CLASS,
  TRACKER_LEVEL_CHIP_WIDTH_CLASS,
  TRACKER_PRESETS,
} from "../lib/boxTrackerUi";
import { ChestTrackerTable } from "./ChestTrackerTable";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { cn } from "../lib/cn";

export function ChestsTrackerPanel() {
  const state = useBoxTimers();

  if (!state) {
    return <p className="m-0 text-xs text-muted">Loading boss tracker…</p>;
  }

  const enabledEntries = enabledCatalogEntries(state.catalog);

  return (
    <section aria-labelledby="stage-chest-tracker-heading" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="stage-chest-tracker-heading" className="m-0 text-sm font-semibold">
            Boss cooldowns
          </h2>
          <Badge variant="muted">{formatCooldownMinutes(state.defaultCooldownSeconds)} default</Badge>
          <Badge variant="info">{state.cooldownCount} cooling</Badge>
          <Badge variant="success">{state.readyCount} ready</Badge>
          <Badge variant={state.playerLogAvailable ? "success" : "muted"}>
            Log {state.playerLogAvailable ? "on" : "off"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            className="h-7 text-xs"
            value={state.sortOrder}
            onChange={(e) =>
              void window.tbh.setBoxTrackerSortOrder(normalizeBoxTrackerSortOrder(e.target.value))
            }
            title="Overlay section order"
          >
            <option value="cooldown-first">Overlay: cooldown first</option>
            <option value="ready-first">Overlay: ready first</option>
          </Select>
          <Button variant="primary" size="sm" onClick={() => window.tbh.openBoxTracker()}>
            Overlay
          </Button>
        </div>
      </div>

      <p className="m-0 text-[11px] text-muted">
        Auto-detect matches{" "}
        <a
          className="text-accent underline"
          href="https://github.com/lucasfevi/tbh-companion"
          target="_blank"
          rel="noreferrer"
        >
          TBH Companion
        </a>
        : Player.log when a rare boss chest drops (chip enabled). Save fallbacks if the log is
        delayed. Common (gray) and act boss (red) are not tracked. Missed one? Tap{" "}
        <strong>Dropped</strong>.
      </p>

      <div className="flex flex-wrap gap-1">
        {TRACKER_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            size="sm"
            variant="ghost"
            title={preset.title}
            onClick={() => applyTrackerPreset(preset.levels, state.catalog)}
          >
            {preset.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => void window.tbh.setBoxTrackerBoxes([])}>
          Clear
        </Button>
      </div>

      <div className={cn("grid gap-1", TRACKER_LEVEL_CHIP_GRID_CLASS)}>
        {state.catalog.map((entry) => {
          const row = state.rows.find((r) => r.boxId === entry.boxId);
          const onCooldown = row?.status === "cooldown";
          return (
            <button
              key={entry.boxId}
              type="button"
              className={cn(
                "box-border cursor-pointer rounded-full border px-1 py-0.5 text-center text-[10px] font-semibold leading-tight",
                TRACKER_LEVEL_CHIP_WIDTH_CLASS,
                entry.enabled
                  ? onCooldown
                    ? "border-status-info bg-status-info/15 text-status-info"
                    : "border-accent bg-ideal/15 text-accent"
                  : "border-border bg-card text-muted hover:border-muted hover:text-fg",
              )}
              title={entry.dropStageRangeLabel}
              onClick={() => toggleTrackedLevel(entry, state.catalog)}
            >
              Lv{entry.level}
            </button>
          );
        })}
      </div>

      {enabledEntries.length === 0 ? (
        <p className="m-0 text-center text-xs text-muted">Pick levels above to track cooldowns.</p>
      ) : (
        <ChestTrackerTable
          entries={enabledEntries}
          rows={state.rows}
          defaultCooldownSeconds={state.defaultCooldownSeconds}
        />
      )}

    </section>
  );
}
