import { stageName } from "./stages";
import {
  loadStageBoxCatalogFile,
  loadStageBoxTrackerRoutes,
  RARE_BOSS_CHEST_BOX_TYPE,
  routeForStageKey,
  type StageBoxCatalogFile,
  type StageBoxTrackerMeta,
  type StageBoxTrackerRoute,
} from "./stageBoxTracker";

export type SlotChestKind = "common" | "stageBoss";

export const SLOT_CHEST_DEFAULT_COOLDOWN_SECONDS: Record<SlotChestKind, number> = {
  common: 300,
  stageBoss: 420,
};

/** @deprecated Use SLOT_CHEST_DEFAULT_COOLDOWN_SECONDS */
export const SLOT_CHEST_COOLDOWN_SECONDS = SLOT_CHEST_DEFAULT_COOLDOWN_SECONDS;

export const SLOT_CHEST_SHORT_LABELS: Record<SlotChestKind, string> = {
  common: "Common",
  stageBoss: "Blue",
};

export const COMMON_CHEST_BOX_TYPE = 0;

export const SLOT_CHEST_KINDS: SlotChestKind[] = ["common", "stageBoss"];

export function slotTimerStorageKey(slot: SlotChestKind, level: number): string {
  return `${slot}:${level}`;
}

export function parseSlotTimerStorageKey(
  key: string,
): { slot: SlotChestKind; level: number } | null {
  const sep = key.indexOf(":");
  if (sep <= 0) return null;
  const slot = key.slice(0, sep) as SlotChestKind;
  if (!SLOT_CHEST_KINDS.includes(slot)) return null;
  const level = Number.parseInt(key.slice(sep + 1), 10);
  if (!Number.isFinite(level) || level <= 0) return null;
  return { slot, level };
}

export function commonChestQuantity(chests: readonly { type: number; quantity: number }[]): number {
  return chests
    .filter((c) => c.type === COMMON_CHEST_BOX_TYPE)
    .reduce((sum, c) => sum + c.quantity, 0);
}

export function isCommonStageBoxKey(
  itemKey: number,
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): boolean {
  const item = catalog.items.find((entry) => entry.id === itemKey);
  return item?.grade === "COMMON" && item.type === "STAGEBOX" && item.obtainable !== false;
}

export function isRareStageBoxKey(
  itemKey: number,
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): boolean {
  const item = catalog.items.find((entry) => entry.id === itemKey);
  return item?.grade === "RARE" && item.type === "STAGEBOX" && item.obtainable !== false;
}

export function stageBoxLevelFromItemKey(
  itemKey: number,
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): number | null {
  const item = catalog.items.find((entry) => entry.id === itemKey);
  if (!item || item.type !== "STAGEBOX" || item.level == null) return null;
  if (!isCommonStageBoxKey(itemKey, catalog) && !isRareStageBoxKey(itemKey, catalog)) return null;
  return item.level;
}

export function slotChestKindFromItemKey(
  itemKey: number,
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): SlotChestKind | null {
  if (isCommonStageBoxKey(itemKey, catalog)) return "common";
  if (isRareStageBoxKey(itemKey, catalog)) return "stageBoss";
  return null;
}

export function totalHeldCommonStageBoxes(
  items: readonly { itemKey: number }[],
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): number {
  let count = 0;
  for (const item of items) {
    if (isCommonStageBoxKey(item.itemKey, catalog)) count++;
  }
  return count;
}

/** Drop stages for a chest level — shared by common + rare box at that level (wiki). */
export function trackerMetaForChestLevel(
  level: number,
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): StageBoxTrackerMeta | null {
  const rare = catalog.items.find(
    (entry) =>
      entry.grade === "RARE" &&
      entry.obtainable !== false &&
      entry.level === level &&
      entry.tracker?.canonical === true,
  );
  return rare?.tracker ?? null;
}

export function commonBoxIdForLevel(
  level: number,
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): number | null {
  return (
    catalog.items.find(
      (entry) =>
        entry.grade === "COMMON" &&
        entry.obtainable !== false &&
        entry.level === level &&
        entry.type === "STAGEBOX",
    )?.id ?? null
  );
}

export function rareBoxIdForLevel(
  level: number,
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): number | null {
  const rare = catalog.items.find(
    (entry) =>
      entry.grade === "RARE" &&
      entry.obtainable !== false &&
      entry.level === level &&
      entry.tracker?.canonical === true,
  );
  return rare?.id ?? null;
}

/** Chest levels to track — levels of enabled boss routes. */
export function slotLevelsForEnabledRoutes(
  enabledBoxIds: ReadonlySet<number>,
  routes: readonly StageBoxTrackerRoute[],
): number[] {
  const levels = new Set<number>();
  for (const route of routes) {
    if (!enabledBoxIds.has(route.boxId)) continue;
    if (route.level > 0) levels.add(route.level);
  }
  return [...levels].sort((a, b) => a - b);
}

export function bossLevelForStageKey(
  stageKey: number,
  routes: readonly StageBoxTrackerRoute[],
): number | null {
  return routeForStageKey(stageKey, routes)?.level ?? null;
}

export function loadSlotTrackerRoutes(): StageBoxTrackerRoute[] {
  return loadStageBoxTrackerRoutes();
}

export { RARE_BOSS_CHEST_BOX_TYPE, stageName };
