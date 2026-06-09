import type { GameItem } from "../gamedata";
import { marketHashMatch } from "../marketName";
import { pickMarketUnit } from "../steamPrice";
import type {
  InventorySnapshot,
  ResolvedInventory,
  ResolvedInventoryRow,
  InventoryComposition,
  InventoryPriceInfo,
} from "../../../shared/types";

export interface PriceLookup {
  (marketHashName: string): InventoryPriceInfo | undefined;
}

export function resolveInventory(
  snapshot: InventorySnapshot,
  lookup: (itemKey: number) => GameItem | undefined,
  gameDataLoaded: boolean,
  priceLookup?: PriceLookup,
): ResolvedInventory {
  const byKey = new Map<number, ResolvedInventoryRow>();

  for (const inst of snapshot.items) {
    let row = byKey.get(inst.itemKey);
    if (!row) {
      const g = lookup(inst.itemKey);
      const match = g ? marketHashMatch(g) : null;
      const hash = match?.name ?? null;
      const price = hash && priceLookup ? priceLookup(hash) : undefined;
      const unit = price ? pickMarketUnit(price) : { unit: null, raw: null, source: null };
      row = {
        itemKey: inst.itemKey,
        name: g?.name ?? `Unknown #${inst.itemKey}`,
        grade: g?.grade ?? "UNKNOWN",
        type: g?.type ?? "UNKNOWN",
        marketTradable: g?.marketTradable ?? false,
        marketHashName: hash,
        count: 0,
        inUseCount: 0,
        inventoryCount: 0,
        stashCount: 0,
        tradingCount: 0,
        chaoticCount: 0,
        known: Boolean(g),
        priceRaw: unit.raw,
        unitPrice: unit.unit,
        priceSource: unit.source,
        value: null,
      };
      byKey.set(inst.itemKey, row);
    }
    row.count++;
    if (inst.inUse) row.inUseCount++;
    if (inst.isChaotic) row.chaoticCount++;
    if (inst.location === "inventory") row.inventoryCount++;
    else if (inst.location === "stash") row.stashCount++;
    else if (inst.location === "trading") row.tradingCount++;
  }

  const rows = [...byKey.values()];
  let valuedTotal = 0;
  let priceableCount = 0;
  let inUseCount = 0;

  for (const r of rows) {
    inUseCount += r.inUseCount;
    if (r.marketHashName) {
      priceableCount += r.count;
      if (r.unitPrice !== null) {
        r.value = r.unitPrice * r.count;
        valuedTotal += r.value;
      }
    } else {
      r.priceRaw = null;
      r.unitPrice = null;
      r.priceSource = null;
      r.value = null;
    }
  }

  const composition: InventoryComposition = {
    total: 0,
    byGrade: {},
    byType: {},
    tradableCount: 0,
    unknownCount: 0,
    chaoticCount: 0,
    inUseCount,
    priceableCount,
    valuedTotal,
    currency: null,
  };
  for (const r of rows) {
    composition.total += r.count;
    composition.byGrade[r.grade] = (composition.byGrade[r.grade] ?? 0) + r.count;
    composition.byType[r.type] = (composition.byType[r.type] ?? 0) + r.count;
    if (r.marketTradable) composition.tradableCount += r.count;
    if (!r.known) composition.unknownCount += r.count;
    composition.chaoticCount += r.chaoticCount;
  }

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
): string[] {
  const names = new Set<string>();
  const seen = new Set<number>();
  for (const inst of snapshot.items) {
    if (seen.has(inst.itemKey)) continue;
    seen.add(inst.itemKey);
    const g = lookup(inst.itemKey);
    if (!g) continue;
    const hash = marketHashMatch(g)?.name;
    if (hash) names.add(hash);
  }
  return [...names];
}
