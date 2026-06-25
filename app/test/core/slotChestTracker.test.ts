import { describe, it, expect } from "vitest";
import {
  bossLevelForStageKey,
  commonChestQuantity,
  slotChestKindFromItemKey,
  slotLevelsForEnabledRoutes,
  SLOT_CHEST_COOLDOWN_SECONDS,
  slotTimerStorageKey,
  stageBoxLevelFromItemKey,
  totalHeldCommonStageBoxes,
  trackerMetaForChestLevel,
} from "../../src/core/slotChestTracker";
import { loadStageBoxTrackerRoutes } from "../../src/core/stageBoxTracker";

describe("slotChestTracker", () => {
  it("uses 5m common and 7m blue slot cooldowns", () => {
    expect(SLOT_CHEST_COOLDOWN_SECONDS.common).toBe(300);
    expect(SLOT_CHEST_COOLDOWN_SECONDS.stageBoss).toBe(420);
  });

  it("maps item keys to slot kinds and chest levels", () => {
    expect(slotChestKindFromItemKey(910301)).toBe("common");
    expect(slotChestKindFromItemKey(920301)).toBe("stageBoss");
    expect(stageBoxLevelFromItemKey(910501)).toBe(50);
    expect(slotChestKindFromItemKey(930301)).toBeNull();
  });

  it("builds per-level storage keys", () => {
    expect(slotTimerStorageKey("common", 50)).toBe("common:50");
  });

  it("lists chest levels for enabled boss routes", () => {
    const routes = loadStageBoxTrackerRoutes();
    const levels = slotLevelsForEnabledRoutes(new Set([920301, 920501]), routes);
    expect(levels).toEqual([30, 50]);
  });

  it("maps stage keys to boss chest levels", () => {
    const routes = loadStageBoxTrackerRoutes();
    expect(bossLevelForStageKey(2108, routes)).toBe(30);
    expect(bossLevelForStageKey(2305, routes)).toBe(50);
    expect(bossLevelForStageKey(9999, routes)).toBeNull();
  });

  it("shares drop stage labels between common and rare at a level", () => {
    const meta = trackerMetaForChestLevel(50);
    expect(meta?.dropStageRangeLabel).toContain("Nightmare 3-5");
    expect(meta?.dropStageRangeLabel).toContain("Hell 1-1");
  });

  it("sums common chest slot quantity", () => {
    expect(
      commonChestQuantity([
        { type: 0, quantity: 2 },
        { type: 1, quantity: 1 },
      ]),
    ).toBe(2);
  });

  it("counts held common stage boxes in inventory", () => {
    expect(totalHeldCommonStageBoxes([{ itemKey: 910301 }, { itemKey: 920301 }])).toBe(1);
  });
});
