import type { GameItem } from "../gamedata";
import { marketHashCandidates } from "../marketName";
import { pickMarketUnit } from "../steamPrice";
import type {
  InventorySnapshot,
  InventoryItemInstance,
  ItemLocation,
  ResolvedInventory,
  ResolvedInventoryRow,
  InventoryComposition,
  InventoryPriceInfo,
} from "../../../shared/types";

export interface PriceLookup {
  (marketHashName: string): InventoryPriceInfo | undefined;
}

export interface ResolveInventoryOptions {
  /** Omit rows from the inventory table and composition (e.g. stage boxes). */
  excludeItemKey?: (itemKey: number) => boolean;
}

const EMPTY_UNIT = { unit: null, raw: null, source: null } as const;

type MarketUnit = ReturnType<typeof pickMarketUnit>;

interface MarketResolution {
  hash: string | null;
  unit: MarketUnit;
  priceChecked: boolean;
}

const NO_MARKET: MarketResolution = { hash: null, unit: EMPTY_UNIT, priceChecked: false };

function emptyComposition(): InventoryComposition {
  return {
    total: 0,
    byGrade: {},
    byType: {},
    tradableCount: 0,
    unknownCount: 0,
    chaoticCount: 0,
    inUseCount: 0,
    priceableCount: 0,
    valuedTotal: 0,
    currency: null,
  };
}

function resolveMarketHashAndPrice(item: GameItem, priceLookup?: PriceLookup): MarketResolution {
  const candidates = marketHashCandidates(item);
  if (candidates.length === 0) return NO_MARKET;

  const probes = candidates
    .map((hash) => ({ hash, price: priceLookup?.(hash) }))
    .filter(
      (entry): entry is { hash: string; price: InventoryPriceInfo } => entry.price !== undefined,
    );

  const priced = probes.find((entry) => pickMarketUnit(entry.price).unit != null);
  if (priced) {
    return {
      hash: priced.hash,
      unit: pickMarketUnit(priced.price),
      priceChecked: true,
    };
  }

  const firstHash = candidates[0];
  const firstProbe = probes.find((entry) => entry.hash === firstHash);
  return {
    hash: firstHash,
    unit: firstProbe ? pickMarketUnit(firstProbe.price) : EMPTY_UNIT,
    priceChecked: probes.length > 0,
  };
}

function createResolvedRow(
  itemKey: number,
  g: GameItem | undefined,
  market: MarketResolution,
): ResolvedInventoryRow {
  return {
    itemKey,
    name: g?.name ?? `Unknown #${itemKey}`,
    grade: g?.grade ?? "UNKNOWN",
    type: g?.type ?? "UNKNOWN",
    level: g?.level ?? null,
    marketTradable: g?.marketTradable ?? false,
    marketHashName: market.hash,
    count: 0,
    inUseCount: 0,
    inventoryCount: 0,
    stashCount: 0,
    tradingCount: 0,
    chaoticCount: 0,
    known: Boolean(g),
    priceRaw: market.unit.raw,
    unitPrice: market.unit.unit,
    priceSource: market.unit.source,
    priceChecked: market.priceChecked,
    value: null,
  };
}

function locationCountKey(
  location: ItemLocation,
): "inventoryCount" | "stashCount" | "tradingCount" | null {
  if (location === "inventory") return "inventoryCount";
  if (location === "stash") return "stashCount";
  if (location === "trading") return "tradingCount";
  return null;
}

function applyInstance(row: ResolvedInventoryRow, inst: InventoryItemInstance): void {
  row.count++;
  if (inst.inUse) row.inUseCount++;
  if (inst.isChaotic) row.chaoticCount++;
  const countKey = locationCountKey(inst.location);
  if (countKey) row[countKey]++;
}

function clearRowPricing(row: ResolvedInventoryRow): void {
  row.priceRaw = null;
  row.unitPrice = null;
  row.priceSource = null;
  row.priceChecked = false;
  row.value = null;
}

function accumulateCompositionRow(
  composition: InventoryComposition,
  row: ResolvedInventoryRow,
): void {
  composition.inUseCount += row.inUseCount;
  composition.total += row.count;
  composition.byGrade[row.grade] = (composition.byGrade[row.grade] ?? 0) + row.count;
  composition.byType[row.type] = (composition.byType[row.type] ?? 0) + row.count;
  if (row.marketTradable) composition.tradableCount += row.count;
  if (!row.known) composition.unknownCount += row.count;
  composition.chaoticCount += row.chaoticCount;

  if (!row.marketHashName) {
    clearRowPricing(row);
    return;
  }

  composition.priceableCount += row.count;
  if (row.unitPrice === null) return;

  row.value = row.unitPrice * row.count;
  composition.valuedTotal += row.value;
}

function finalizeRows(rows: ResolvedInventoryRow[]): InventoryComposition {
  const composition = emptyComposition();
  rows.forEach((row) => accumulateCompositionRow(composition, row));
  return composition;
}

function ensureRow(
  byKey: Map<number, ResolvedInventoryRow>,
  itemKey: number,
  g: GameItem | undefined,
  priceLookup?: PriceLookup,
): ResolvedInventoryRow {
  const existing = byKey.get(itemKey);
  if (existing) return existing;

  const market = g ? resolveMarketHashAndPrice(g, priceLookup) : NO_MARKET;
  const row = createResolvedRow(itemKey, g, market);
  byKey.set(itemKey, row);
  return row;
}

function accumulateInstances(
  byKey: Map<number, ResolvedInventoryRow>,
  items: InventoryItemInstance[],
  lookup: (itemKey: number) => GameItem | undefined,
  priceLookup: PriceLookup | undefined,
  exclude?: (itemKey: number) => boolean,
): void {
  items.forEach((inst) => {
    if (exclude?.(inst.itemKey)) return;
    const row = ensureRow(byKey, inst.itemKey, lookup(inst.itemKey), priceLookup);
    applyInstance(row, inst);
  });
}

function mergeMaterialStacks(
  byKey: Map<number, ResolvedInventoryRow>,
  stacks: Map<number, number>,
  lookup: (itemKey: number) => GameItem | undefined,
  priceLookup: PriceLookup | undefined,
  exclude?: (itemKey: number) => boolean,
): void {
  stacks.forEach((stackQty, itemKey) => {
    if (exclude?.(itemKey)) return;

    const g = lookup(itemKey);
    if (!g) return;

    const row = byKey.has(itemKey)
      ? byKey.get(itemKey)!
      : ensureRow(byKey, itemKey, g, priceLookup);
    if (row.type !== "MATERIAL" || stackQty <= row.count) return;

    row.count = stackQty;
    row.inventoryCount = stackQty;
  });
}

export function resolveInventory(
  snapshot: InventorySnapshot,
  lookup: (itemKey: number) => GameItem | undefined,
  gameDataLoaded: boolean,
  priceLookup?: PriceLookup,
  options?: ResolveInventoryOptions,
): ResolvedInventory {
  const exclude = options?.excludeItemKey;
  const byKey = new Map<number, ResolvedInventoryRow>();

  accumulateInstances(byKey, snapshot.items, lookup, priceLookup, exclude);

  if (snapshot.materialStacks) {
    mergeMaterialStacks(byKey, snapshot.materialStacks, lookup, priceLookup, exclude);
  }

  const rows = [...byKey.values()];
  const composition = finalizeRows(rows);

  return {
    rows,
    composition,
    chests: snapshot.chests,
    saveMtime: snapshot.saveMtime,
    gameDataLoaded,
    currency: null,
  };
}

export function ownedMarketNames(
  snapshot: InventorySnapshot,
  lookup: (itemKey: number) => GameItem | undefined,
  excludeItemKey?: (itemKey: number) => boolean,
): string[] {
  const names = new Set<string>();
  const seenKeys = new Set<number>();

  snapshot.items.forEach((inst) => {
    if (excludeItemKey?.(inst.itemKey)) return;
    if (seenKeys.has(inst.itemKey)) return;
    seenKeys.add(inst.itemKey);

    const g = lookup(inst.itemKey);
    if (!g) return;

    marketHashCandidates(g).forEach((hash) => names.add(hash));
  });

  return [...names];
}
