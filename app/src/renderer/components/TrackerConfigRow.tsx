import type { BoxTimerCatalogEntry, BoxTimerRow } from "../../../shared/types";
import { fmtTimer } from "../lib/useBoxTimers";
import {
  formatCooldownMinutes,
  formatEffectiveCooldown,
  parseClearTimeSecondsInput,
  parseCooldownMinutesInput,
} from "../lib/boxTrackerUi";
import { TrackerFarmStageSelect } from "./TrackerFarmStageSelect";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { CapacityBar } from "./ui/CapacityBar";
import { LinkButton } from "./ui/LinkButton";
import { NumberField } from "./ui/NumberInput";
import { cn } from "../lib/cn";

export function TrackerConfigRow({
  entry,
  row,
  defaultCooldownSeconds,
}: {
  entry: BoxTimerCatalogEntry;
  row?: BoxTimerRow;
  defaultCooldownSeconds: number;
}) {
  const minutes = Math.round(entry.cooldownSeconds / 60);
  const onCooldown = row?.status === "cooldown";

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5",
        "shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--color-fg)_6%,transparent)]",
        "border-l-[3px]",
        onCooldown ? "border-l-status-info" : row ? "border-l-status-success" : "border-l-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            Stage boss chest
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="m-0 text-2xl font-semibold tabular-nums leading-none tracking-tight">
              Lv{entry.level ?? "?"}
            </p>
            {row ? (
              <Badge variant={onCooldown ? "statusCooldown" : "statusReady"}>
                {onCooldown ? fmtTimer(row.remainingSeconds) : "Ready"}
              </Badge>
            ) : null}
          </div>
          <p className="m-0 mt-1 text-[10px] text-muted">{entry.dropStageRangeLabel}</p>
        </div>
        {row && onCooldown ? (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => void window.tbh.clearBoxTimer(entry.boxId)}
          >
            Reset
          </Button>
        ) : row && !onCooldown ? (
          <Button
            size="sm"
            variant="success"
            className="shrink-0"
            onClick={() => void window.tbh.markBoxDropped(entry.boxId)}
          >
            Dropped
          </Button>
        ) : null}
      </div>

      {onCooldown && row ? (
        <CapacityBar percent={row.progress * 100} variant="blue" compact />
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Cooldown (min)"
          density="compact"
          align="center"
          inputClassName="w-full"
          min={1}
          max={1440}
          step={1}
          defaultValue={minutes}
          key={`${entry.boxId}-${minutes}-${entry.cooldownIsCustom}`}
          onBlur={(event) => {
            const seconds = parseCooldownMinutesInput(event.target.value);
            if (seconds == null) {
              event.target.value = String(minutes);
              return;
            }
            if (seconds === defaultCooldownSeconds && entry.cooldownIsCustom) {
              void window.tbh.clearBoxTrackerCooldown(entry.boxId);
              return;
            }
            if (seconds !== entry.cooldownSeconds) {
              void window.tbh.setBoxTrackerCooldown(entry.boxId, seconds);
            }
          }}
          footer={
            <LinkButton
              className={cn(
                "text-[10px]",
                !entry.cooldownIsCustom && "pointer-events-none invisible",
              )}
              onClick={() => void window.tbh.clearBoxTrackerCooldown(entry.boxId)}
            >
              Reset to {formatCooldownMinutes(defaultCooldownSeconds)}
            </LinkButton>
          }
        />
        <NumberField
          label="Clear time (s)"
          density="compact"
          align="center"
          inputClassName="w-full"
          min={0}
          max={3600}
          step={1}
          defaultValue={entry.clearTimeSeconds}
          key={`${entry.boxId}-clear-${entry.clearTimeSeconds}`}
          onBlur={(event) => {
            const seconds = parseClearTimeSecondsInput(event.target.value);
            if (seconds == null) {
              event.target.value = String(entry.clearTimeSeconds);
              return;
            }
            if (seconds === 0 && entry.clearTimeSeconds > 0) {
              void window.tbh.clearBoxTrackerClearTime(entry.boxId);
              return;
            }
            if (seconds !== entry.clearTimeSeconds) {
              void window.tbh.setBoxTrackerClearTime(entry.boxId, seconds);
            }
          }}
          footer={
            entry.clearTimeSeconds > 0 ? (
              <LinkButton
                className="text-[10px]"
                onClick={() => void window.tbh.clearBoxTrackerClearTime(entry.boxId)}
              >
                Clear
              </LinkButton>
            ) : undefined
          }
        />
      </div>

      <p className="m-0 rounded-md bg-panel/80 px-2 py-1.5 text-[11px] text-muted">
        Effective cooldown:{" "}
        <span className="font-semibold text-fg">
          {formatEffectiveCooldown(entry.cooldownSeconds, entry.clearTimeSeconds)}
        </span>
      </p>

      <TrackerFarmStageSelect entry={entry} />
    </article>
  );
}
