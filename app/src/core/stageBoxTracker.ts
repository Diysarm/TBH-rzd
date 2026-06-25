import { readBundledJson } from "./bundledData";
import { stageName } from "./stages";
import type { GameItem } from "./gamedata";

export interface StageBoxTrackerMeta {
  canonical: true;
  idealStageKey: number;
  dropStageKeys: number[];
  dropStageRangeLabel: string;
}

export interface StageBoxCatalogItem extends GameItem {
  obtainable: boolean;
  tracker?: StageBoxTrackerMeta;
}

export interface StageBoxCatalogFile {
  source: string;
  fetchedUtc?: string;
  defaultCooldownSeconds: number;
  count: number;
  items: StageBoxCatalogItem[];
}

export interface StageBoxTrackerRoute {
  boxId: number;
  level: number;
  idealStageKey: number;
  idealStageLabel: string;
  dropStageKeys: number[];
  dropStageRangeLabel: string;
}

export function loadStageBoxCatalogFile(): StageBoxCatalogFile {
  return readBundledJson<StageBoxCatalogFile>("stage_boxes.json");
}

export function loadStageBoxTrackerRoutes(
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): StageBoxTrackerRoute[] {
  return catalog.items
    .filter(
      (item): item is StageBoxCatalogItem & { tracker: StageBoxTrackerMeta } =>
        item.grade === "RARE" && item.obtainable && item.tracker?.canonical === true,
    )
    .map((item) => ({
      boxId: item.id,
      level: item.level ?? 0,
      idealStageKey: item.tracker.idealStageKey,
      idealStageLabel: stageName(item.tracker.idealStageKey),
      dropStageKeys: item.tracker.dropStageKeys,
      dropStageRangeLabel: item.tracker.dropStageRangeLabel,
    }))
    .sort((a, b) => a.level - b.level || a.boxId - b.boxId);
}

export function trackerRoutesById(
  routes: StageBoxTrackerRoute[],
): Map<number, StageBoxTrackerRoute> {
  return new Map(routes.map((route) => [route.boxId, route]));
}

/** Map any obtainable rare stage-box ItemKey to its canonical tracker box id. */
export function canonicalTrackerBoxId(
  itemKey: number,
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): number | null {
  const item = catalog.items.find((entry) => entry.id === itemKey);
  if (!item || item.grade !== "RARE" || !item.obtainable) return null;
  if (item.tracker?.canonical) return item.id;
  if (item.level == null) return null;
  const canonical = catalog.items.find(
    (entry) =>
      entry.tracker?.canonical === true &&
      entry.grade === "RARE" &&
      entry.obtainable &&
      entry.level === item.level,
  );
  return canonical?.id ?? null;
}

/** Effective cooldown after subtracting clear-time (seconds). */
export function effectiveBoxCooldownSeconds(
  baseCooldownSeconds: number,
  clearTimeSeconds: number,
): number {
  const base = Math.max(0, Math.floor(baseCooldownSeconds));
  const clear = Math.max(0, Math.floor(clearTimeSeconds));
  return Math.max(0, base - clear);
}

/** Resolve a Player.log ItemKey to a box id when that level is tracked and enabled. */
export function resolveTrackedDropBoxId(
  itemKey: number,
  enabledBoxIds: ReadonlySet<number>,
  isTrackedRoute: (boxId: number) => boolean,
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): number | null {
  const boxId = canonicalTrackerBoxId(itemKey, catalog);
  if (boxId == null || !isTrackedRoute(boxId) || !enabledBoxIds.has(boxId)) return null;
  return boxId;
}

/** BoxData slot type for stage-boss (rare / blue) held chests. */
export const RARE_BOSS_CHEST_BOX_TYPE = 1;

export function rareBossChestQuantity(
  chests: readonly { type: number; quantity: number }[],
): number {
  return chests
    .filter((c) => c.type === RARE_BOSS_CHEST_BOX_TYPE)
    .reduce((sum, c) => sum + c.quantity, 0);
}

/** Canonical tracker route whose drop stages include this stage key. */
export function routeForStageKey(
  stageKey: number,
  routes: Iterable<StageBoxTrackerRoute>,
): StageBoxTrackerRoute | null {
  if (stageKey <= 0) return null;
  for (const route of routes) {
    if (route.dropStageKeys.includes(stageKey)) return route;
  }
  return null;
}

/** Count held rare stage-box instances in save itemSaveDatas (by canonical tracker id). */
export function countHeldRareStageBoxes(
  items: readonly { itemKey: number }[],
  catalog: StageBoxCatalogFile = loadStageBoxCatalogFile(),
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const item of items) {
    const boxId = canonicalTrackerBoxId(item.itemKey, catalog);
    if (boxId == null) continue;
    counts.set(boxId, (counts.get(boxId) ?? 0) + 1);
  }
  return counts;
}
