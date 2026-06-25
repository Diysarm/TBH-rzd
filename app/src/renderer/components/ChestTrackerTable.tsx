import type {
  BoxTimerCatalogEntry,
  SlotChestCooldownConfig,
  SlotChestKind,
  SlotLevelTimerGroup,
} from "../../../shared/types";
import { slotChestIconUrl } from "../lib/boxTrackerUi";
import { ChestTimerIcon } from "./ChestTimerIcon";
import { Select } from "./ui/Select";
import { cn } from "../lib/cn";

function CdInput({
  value,
  isCustom,
  onCommit,
}: {
  value: number;
  isCustom: boolean;
  onCommit: (minutes: number) => void;
}) {
  return (
    <input
      type="number"
      min={1}
      max={1440}
      defaultValue={value}
      key={`${value}-${isCustom}`}
      className="h-7 w-12 rounded border border-border bg-card px-1 text-center text-xs font-semibold tabular-nums focus-visible:outline focus-visible:outline-1 focus-visible:outline-ideal/50"
      onBlur={(e) => {
        const next = Number(e.target.value);
        if (!Number.isFinite(next)) {
          e.target.value = String(value);
          return;
        }
        onCommit(Math.max(1, Math.min(1440, Math.round(next))));
      }}
    />
  );
}

function SlotCooldownStrip({ slotCooldown }: { slotCooldown: SlotChestCooldownConfig }) {
  const slots: Array<{
    slot: SlotChestKind;
    minutes: number;
    defaultMin: number;
    isCustom: boolean;
  }> = [
    {
      slot: "common",
      minutes: Math.round(slotCooldown.commonSeconds / 60),
      defaultMin: Math.round(slotCooldown.defaultCommonSeconds / 60),
      isCustom: slotCooldown.commonIsCustom,
    },
    {
      slot: "stageBoss",
      minutes: Math.round(slotCooldown.stageBossSeconds / 60),
      defaultMin: Math.round(slotCooldown.defaultStageBossSeconds / 60),
      isCustom: slotCooldown.stageBossIsCustom,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border/70 bg-panel/50 px-3 py-2 text-xs text-muted">
      {slots.map((item) => (
        <label key={item.slot} className="flex items-center gap-2">
          <img src={slotChestIconUrl(item.slot)} alt="" className="h-6 w-6 object-contain" />
          <CdInput
            value={item.minutes}
            isCustom={item.isCustom}
            onCommit={(min) => {
              const sec = min * 60;
              const def = item.defaultMin * 60;
              if (sec === def && item.isCustom) void window.tbh.clearSlotChestCooldown(item.slot);
              else if (sec !== item.minutes * 60)
                void window.tbh.setSlotChestCooldown(item.slot, sec);
            }}
          />
          <span>min</span>
        </label>
      ))}
    </div>
  );
}

export function ChestTrackerTable({
  entries,
  slotLevelGroups,
  slotCooldown,
}: {
  entries: BoxTimerCatalogEntry[];
  slotLevelGroups: SlotLevelTimerGroup[];
  slotCooldown: SlotChestCooldownConfig;
}) {
  if (entries.length === 0) return null;

  const slotByLevel = new Map(slotLevelGroups.map((g) => [g.level, g]));

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <SlotCooldownStrip slotCooldown={slotCooldown} />

      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_6.25rem] items-center gap-x-3 gap-y-0 bg-panel/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <span>Lv</span>
        <span>Farm</span>
        <span className="text-right">Chest</span>
      </div>

      {entries.map((entry, index) => {
        const slotGroup = entry.level != null ? slotByLevel.get(entry.level) : undefined;
        const level = entry.level ?? 0;
        const common = slotGroup?.common;
        const blue = slotGroup?.stageBoss;
        const slotCd = common?.status === "cooldown" || blue?.status === "cooldown";

        return (
          <div
            key={entry.boxId}
            className={cn(
              "grid grid-cols-[3.25rem_minmax(0,1fr)_6.25rem] items-center gap-x-3 border-t border-border/60 px-3 py-2",
              slotCd && "bg-status-danger/[0.04]",
              !slotCd && "bg-card/30",
              index === entries.length - 1 && "rounded-b-lg",
            )}
          >
            <div className="px-0.5" title={entry.dropStageRangeLabel}>
              <span className="text-base font-bold tabular-nums text-accent">{level}</span>
            </div>

            <Select
              className="h-8 min-w-0 text-xs"
              value={entry.idealStageKey}
              title={entry.dropStageRangeLabel}
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

            <div className="flex items-center justify-end gap-1.5">
              <ChestTimerIcon
                src={slotChestIconUrl("common")}
                onCooldown={common?.status === "cooldown"}
                remainingSeconds={common?.remainingSeconds}
                progress={common?.progress}
                title={
                  common?.status === "cooldown"
                    ? `Gray — ${common.remainingSeconds}s left`
                    : `Gray — mark dropped (${Math.round((common?.cooldownSeconds ?? 300) / 60)}m)`
                }
                onClick={() =>
                  void (common?.status === "cooldown"
                    ? window.tbh.clearSlotChestTimer("common", level)
                    : window.tbh.markSlotChestDropped("common", level))
                }
              />
              <ChestTimerIcon
                src={slotChestIconUrl("stageBoss")}
                onCooldown={blue?.status === "cooldown"}
                remainingSeconds={blue?.remainingSeconds}
                progress={blue?.progress}
                title={
                  blue?.status === "cooldown"
                    ? `Blue — ${blue.remainingSeconds}s left`
                    : `Blue — mark dropped (${Math.round((blue?.cooldownSeconds ?? 420) / 60)}m)`
                }
                onClick={() =>
                  void (blue?.status === "cooldown"
                    ? window.tbh.clearSlotChestTimer("stageBoss", level)
                    : window.tbh.markSlotChestDropped("stageBoss", level))
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
