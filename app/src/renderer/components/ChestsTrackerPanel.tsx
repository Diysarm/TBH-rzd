import { useBoxTimers } from "../lib/useBoxTimers";
import {
  applyTrackerPreset,
  enabledCatalogEntries,
  toggleTrackedLevel,
  TRACKER_LEVEL_CHIP_GRID_CLASS,
  TRACKER_LEVEL_CHIP_WIDTH_CLASS,
  TRACKER_PRESETS,
} from "../lib/boxTrackerUi";
import { ChestTrackerTable } from "./ChestTrackerTable";
import { Button } from "./ui/Button";
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
        <h2 id="stage-chest-tracker-heading" className="m-0 text-sm font-semibold">
          Chest cooldowns
        </h2>
        <Button variant="primary" size="sm" onClick={() => window.tbh.openBoxTracker()}>
          Overlay
        </Button>
      </div>

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
          const slotGroup =
            entry.level != null
              ? state.slotLevelGroups.find((group) => group.level === entry.level)
              : undefined;
          const onCooldown =
            slotGroup?.common.status === "cooldown" || slotGroup?.stageBoss.status === "cooldown";
          return (
            <button
              key={entry.boxId}
              type="button"
              className={cn(
                "box-border cursor-pointer rounded-full border px-1.5 py-1 text-center text-xs font-semibold leading-tight",
                TRACKER_LEVEL_CHIP_WIDTH_CLASS,
                entry.enabled
                  ? onCooldown
                    ? "border-status-danger bg-status-danger/15 text-status-danger"
                    : "border-status-info bg-status-info/15 text-status-info"
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

      <p className="m-0 text-xs text-muted">Tap chest icons when a slot drops.</p>

      {enabledEntries.length === 0 ? (
        <p className="m-0 text-center text-xs text-muted">Pick levels above to track cooldowns.</p>
      ) : (
        <ChestTrackerTable
          entries={enabledEntries}
          slotLevelGroups={state.slotLevelGroups}
          slotCooldown={state.slotCooldown}
        />
      )}
    </section>
  );
}
