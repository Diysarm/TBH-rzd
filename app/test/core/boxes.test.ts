import { describe, it, expect } from "vitest";
import {
  resolveChestHoldings,
  buildChestState,
  commonBoxCapacity,
  commonBoxState,
  loadBoxTypeCatalog,
  loadRuneBoxCapCatalog,
  type RunePurchase,
} from "../../src/core/boxes";
import type { ChestHolding } from "../../shared/types";

const boxTypes = loadBoxTypeCatalog();
const runeCap = loadRuneBoxCapCatalog();

describe("resolveChestHoldings", () => {
  it("aggregates duplicate BoxTypes and labels from catalog", () => {
    const chests: ChestHolding[] = [
      { type: 0, quantity: 4 },
      { type: 5, quantity: 0 },
      { type: 9, quantity: 3 },
    ];
    const rows = resolveChestHoldings(chests, boxTypes);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ boxType: 0, category: "common", quantity: 4 });
    expect(rows[1]).toMatchObject({ boxType: 9, category: "act", quantity: 3 });
  });

  it("falls back to Type N for unknown ids", () => {
    const rows = resolveChestHoldings([{ type: 42, quantity: 2 }], boxTypes);
    expect(rows[0].label).toBe("Type 42");
    expect(rows[0].category).toBe("unknown");
  });
});

describe("commonBoxCapacity", () => {
  it("starts at base 5 with no runes", () => {
    expect(commonBoxCapacity([], runeCap)).toBe(5);
  });

  it("adds +1 per level for catalog rune keys", () => {
    const purchases: RunePurchase[] = [
      { runeKey: 11, level: 3 },
      { runeKey: 12, level: 2 },
      { runeKey: 999, level: 5 },
    ];
    expect(commonBoxCapacity(purchases, runeCap)).toBe(5 + 3 + 2);
  });

  it("includes settings override", () => {
    expect(commonBoxCapacity([], runeCap, 2)).toBe(7);
  });
});

describe("commonBoxState", () => {
  it("marks full at capacity", () => {
    expect(commonBoxState(5, 5)).toMatchObject({ isFull: true, slotsRemaining: 0 });
    expect(commonBoxState(4, 5)).toMatchObject({ isFull: false, slotsRemaining: 1 });
  });
});

describe("buildChestState", () => {
  it("builds full chest state from fixture holdings", () => {
    const chests: ChestHolding[] = [
      { type: 0, quantity: 4 },
      { type: 9, quantity: 3 },
    ];
    const state = buildChestState(chests, [{ runeKey: 11, level: 1 }], 100, boxTypes, runeCap);
    expect(state.totalHeld).toBe(7);
    expect(state.common.quantity).toBe(4);
    expect(state.common.capacity).toBe(6);
    expect(state.common.isFull).toBe(false);
    expect(state.saveMtime).toBe(100);
  });
});
