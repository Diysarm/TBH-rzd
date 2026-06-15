import type { BoxTimerCatalogEntry, BoxTimerRow } from "../../../shared/types";
import { fmtTimer } from "../lib/useBoxTimers";
import { formatEffectiveCooldown } from "../lib/boxTrackerUi";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { cn } from "../lib/cn";

function CompactNumberInput({
  value,
  min,
  max,
  className,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  className?: string;
  onCommit: (next: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      defaultValue={value}
      className={cn(
        "h-7 w-full min-w-0 rounded border border-border bg-card px-1 text-center text-xs tabular-nums",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ideal/50",
        className,
      )}
      onBlur={(event) => {
        const next = Number(event.target.value);
        if (!Number.isFinite(next)) {
          event.target.value = String(value);
          return;
        }
        const clamped = Math.max(min, Math.min(max, Math.round(next)));
        if (clamped !== value) onCommit(clamped);
        event.target.value = String(clamped);
      }}
    />
  );
}

export function ChestTrackerTable({
  entries,
  rows,
  defaultCooldownSeconds,
}: {
  entries: BoxTimerCatalogEntry[];
  rows: BoxTimerRow[];
  defaultCooldownSeconds: number;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[36rem] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-panel/60 text-left text-[10px] uppercase tracking-wide text-muted">
            <th className="px-2 py-1.5 font-semibold">Lv</th>
            <th className="px-2 py-1.5 font-semibold">Status</th>
            <th className="px-2 py-1.5 font-semibold">CD (min)</th>
            <th className="px-2 py-1.5 font-semibold">Clear (s)</th>
            <th className="px-2 py-1.5 font-semibold">Effective</th>
            <th className="px-2 py-1.5 font-semibold">Farm</th>
            <th className="px-2 py-1.5 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const row = rows.find((r) => r.boxId === entry.boxId);
            const onCooldown = row?.status === "cooldown";
            const cdMinutes = Math.round(entry.cooldownSeconds / 60);

            return (
              <tr
                key={entry.boxId}
                className={cn(
                  "border-b border-border/70 last:border-b-0",
                  onCooldown ? "bg-status-info/5" : "bg-card/40",
                )}
              >
                <td className="px-2 py-1.5 font-semibold tabular-nums">Lv{entry.level ?? "?"}</td>
                <td className="px-2 py-1.5">
                  {row ? (
                    <Badge variant={onCooldown ? "statusCooldown" : "statusReady"}>
                      {onCooldown ? fmtTimer(row.remainingSeconds) : "Ready"}
                    </Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <CompactNumberInput
                    key={`cd-${entry.boxId}-${cdMinutes}-${entry.cooldownIsCustom}`}
                    value={cdMinutes}
                    min={1}
                    max={1440}
                    className="w-14"
                    onCommit={(minutes) => {
                      const seconds = minutes * 60;
                      if (seconds === defaultCooldownSeconds && entry.cooldownIsCustom) {
                        void window.tbh.clearBoxTrackerCooldown(entry.boxId);
                      } else if (seconds !== entry.cooldownSeconds) {
                        void window.tbh.setBoxTrackerCooldown(entry.boxId, seconds);
                      }
                    }}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <CompactNumberInput
                    key={`clear-${entry.boxId}-${entry.clearTimeSeconds}`}
                    value={entry.clearTimeSeconds}
                    min={0}
                    max={3600}
                    className="w-14"
                    onCommit={(seconds) => {
                      if (seconds === 0 && entry.clearTimeSeconds > 0) {
                        void window.tbh.clearBoxTrackerClearTime(entry.boxId);
                      } else if (seconds !== entry.clearTimeSeconds) {
                        void window.tbh.setBoxTrackerClearTime(entry.boxId, seconds);
                      }
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted">
                  {formatEffectiveCooldown(entry.cooldownSeconds, entry.clearTimeSeconds)}
                </td>
                <td className="max-w-[9rem] px-2 py-1.5">
                  <Select
                    className="h-7 w-full min-w-0 text-[11px]"
                    value={entry.idealStageKey}
                    onChange={(e) => {
                      const key = Number(e.target.value);
                      if (!Number.isFinite(key) || key <= 0) return;
                      if (key === entry.defaultIdealStageKey) {
                        void window.tbh.clearBoxTrackerFarmStage(entry.boxId);
                      } else {
                        void window.tbh.setBoxTrackerFarmStage(entry.boxId, key);
                      }
                    }}
                  >
                    {entry.farmStageOptions.map((option) => (
                      <option key={option.stageKey} value={option.stageKey}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5 text-right">
                  {onCooldown ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void window.tbh.clearBoxTimer(entry.boxId)}
                    >
                      Reset
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => void window.tbh.markBoxDropped(entry.boxId)}
                    >
                      Dropped
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
