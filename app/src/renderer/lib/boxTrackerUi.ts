import type {
  BoxTimerCatalogEntry,
  BoxTimerRow,
  BoxTrackerSortOrder,
  SlotChestKind,
  SlotLevelTimerGroup,
} from "../../../shared/types";
import { normalizeBoxTrackerSortOrder } from "../../core/boxTrackerSort";

export { normalizeBoxTrackerSortOrder };

export const TRACKER_LEVEL_CHIP_WIDTH_CLASS = "w-[4.5rem]";
export const TRACKER_LEVEL_CHIP_GRID_CLASS = "grid-cols-[repeat(auto-fill,4.5rem)]";

export const TRACKER_PRESETS: { label: string; title: string; levels: number[] }[] = [
  { label: "Starter", title: "Lv 1–7 (Act 1 bosses)", levels: [1, 2, 3, 4, 5, 6, 7] },
  { label: "Mid", title: "Lv 15–30", levels: [15, 20, 30] },
  { label: "Late", title: "Lv 40–80", levels: [40, 50, 65, 80] },
];

export function enabledBoxIds(catalog: BoxTimerCatalogEntry[]): number[] {
  return catalog.filter((entry) => entry.enabled).map((entry) => entry.boxId);
}

export function toggleTrackedLevel(
  entry: BoxTimerCatalogEntry,
  catalog: BoxTimerCatalogEntry[],
): void {
  const current = enabledBoxIds(catalog);
  if (entry.enabled) {
    void window.tbh.setBoxTrackerBoxes(current.filter((id) => id !== entry.boxId));
  } else {
    void window.tbh.setBoxTrackerBoxes([...current, entry.boxId]);
  }
}

export function applyTrackerPreset(levels: number[], catalog: BoxTimerCatalogEntry[]): void {
  const ids = catalog
    .filter((entry) => entry.level != null && levels.includes(entry.level))
    .map((entry) => entry.boxId);
  void window.tbh.setBoxTrackerBoxes(ids);
}

export function trackedLevelsSummary(catalog: BoxTimerCatalogEntry[]): string {
  const levels = catalog.filter((entry) => entry.enabled).map((entry) => entry.level);
  if (levels.length === 0) return "None";
  if (levels.length <= 5) return levels.map((level) => `Lv${level}`).join(", ");
  return `${levels.length} levels`;
}

export function formatCooldownMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function slotChestIconUrl(slot: SlotChestKind): string {
  return slot === "common" ? "/chest-icons/common.png" : "/chest-icons/stage-boss.png";
}

/** @deprecated Wiki uses generic box art per grade, not per item id. */
export function stageBoxWikiIconUrl(boxId: number): string {
  const grade = boxId >= 920_000 && boxId < 930_000 ? "stageBoss" : "common";
  return slotChestIconUrl(grade);
}

export function formatEffectiveCooldown(baseSeconds: number, clearTimeSeconds: number): string {
  const effective = Math.max(0, baseSeconds - clearTimeSeconds);
  if (clearTimeSeconds <= 0) return formatCooldownMinutes(baseSeconds);
  return `${formatCooldownMinutes(effective)} (−${clearTimeSeconds}s clear)`;
}

export function parseCooldownMinutesInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const minutes = Number(trimmed);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) return null;
  return Math.round(minutes * 60);
}

export function parseClearTimeSecondsInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) return null;
  return Math.round(seconds);
}

export function enabledCatalogEntries(catalog: BoxTimerCatalogEntry[]): BoxTimerCatalogEntry[] {
  return catalog
    .filter((entry) => entry.enabled)
    .toSorted((a, b) => (a.level ?? 0) - (b.level ?? 0));
}

export function boxTrackerSectionOrder(
  sortOrder: BoxTrackerSortOrder,
): Array<"cooldown" | "ready"> {
  return sortOrder === "ready-first" ? ["ready", "cooldown"] : ["cooldown", "ready"];
}

export function boxTrackerRowsBySection(
  rows: BoxTimerRow[],
  section: "cooldown" | "ready",
): BoxTimerRow[] {
  return rows.filter((row) => row.status === section);
}

export function compareRowsByLevel(a: BoxTimerRow, b: BoxTimerRow): number {
  return (a.level ?? 0) - (b.level ?? 0) || a.boxId - b.boxId;
}

export function sortRowsByLevel(rows: BoxTimerRow[]): BoxTimerRow[] {
  return rows.toSorted(compareRowsByLevel);
}

export function sortSlotGroupsByLevel(groups: SlotLevelTimerGroup[]): SlotLevelTimerGroup[] {
  return groups.toSorted((a, b) => a.level - b.level);
}

/** Ascending level order for overlay (slot groups + boss rows interleaved). */
export function overlayLevelsSorted(
  slotGroups: SlotLevelTimerGroup[],
  rows: BoxTimerRow[],
): number[] {
  const levels = new Set<number>();
  for (const group of slotGroups) levels.add(group.level);
  for (const row of rows) {
    if (row.level != null) levels.add(row.level);
  }
  return [...levels].sort((a, b) => a - b);
}
