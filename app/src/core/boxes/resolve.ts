import type { ChestHolding, CommonBoxStatus, ResolvedChestRow, ChestState } from "../../../shared/types";
import type { BoxTypeCatalog, RuneBoxCapCatalog } from "./catalog";
import { boxTypeIndex } from "./catalog";
import type { RunePurchase } from "./runes";
import { commonBoxCapacity, commonBoxState } from "./capacity";

export { commonBoxCapacity, commonBoxState } from "./capacity";

function aggregateHoldings(chests: ChestHolding[]): Map<number, number> {
  const byType = new Map<number, number>();
  for (const { type, quantity } of chests) {
    byType.set(type, (byType.get(type) ?? 0) + quantity);
  }
  return byType;
}

export function resolveChestHoldings(
  chests: ChestHolding[],
  catalog: BoxTypeCatalog,
): ResolvedChestRow[] {
  const index = boxTypeIndex(catalog);
  const byType = aggregateHoldings(chests.filter((c) => c.quantity > 0));
  const rows: ResolvedChestRow[] = [];

  for (const [boxType, quantity] of byType) {
    const meta = index.get(boxType);
    rows.push({
      boxType,
      label: meta?.label ?? `Type ${boxType}`,
      category: meta?.category ?? "unknown",
      quantity,
    });
  }

  rows.sort((a, b) => {
    const order = (c: string) => (c === "common" ? 0 : c === "rare" ? 1 : c === "act" ? 2 : 3);
    const d = order(a.category) - order(b.category);
    return d !== 0 ? d : a.boxType - b.boxType;
  });
  return rows;
}

export function buildChestState(
  chests: ChestHolding[],
  purchases: RunePurchase[],
  saveMtime: number,
  boxTypeCatalog: BoxTypeCatalog,
  runeCapCatalog: RuneBoxCapCatalog,
  settingsOverride = 0,
): ChestState {
  const rows = resolveChestHoldings(chests, boxTypeCatalog);
  const commonQty = rows.filter((r) => r.category === "common").reduce((s, r) => s + r.quantity, 0);
  const capacity = commonBoxCapacity(purchases, runeCapCatalog, settingsOverride);
  const common = commonBoxState(commonQty, capacity);
  const totalHeld = rows.reduce((s, r) => s + r.quantity, 0);

  return {
    rows,
    common,
    totalHeld,
    saveMtime,
    runeBonusSlots: capacity - runeCapCatalog.baseCapacity - settingsOverride,
  };
}

export function commonQuantityFromRows(rows: ResolvedChestRow[]): number {
  return rows.filter((r) => r.category === "common").reduce((s, r) => s + r.quantity, 0);
}

export type { CommonBoxStatus };
