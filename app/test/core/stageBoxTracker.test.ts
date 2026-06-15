import { describe, it, expect } from "vitest";
import {
  effectiveBoxCooldownSeconds,
  loadStageBoxTrackerRoutes,
  canonicalTrackerBoxId,
  countHeldRareStageBoxes,
  rareBossChestQuantity,
  resolveTrackedDropBoxId,
  routeForStageKey,
} from "../../src/core/stageBoxTracker";

describe("stageBoxTracker", () => {
  it("computes effective cooldown after clear time", () => {
    expect(effectiveBoxCooldownSeconds(780, 120)).toBe(660);
    expect(effectiveBoxCooldownSeconds(720, 0)).toBe(720);
    expect(effectiveBoxCooldownSeconds(600, 800)).toBe(0);
  });

  it("loads canonical routes from bundled stage_boxes.json", () => {
    const routes = loadStageBoxTrackerRoutes();
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => route.dropStageRangeLabel.length > 0)).toBe(true);
  });

  it("maps duplicate ItemKeys to canonical tracker ids", () => {
    expect(canonicalTrackerBoxId(920501)).toBe(920501);
    expect(canonicalTrackerBoxId(920004)).toBe(920003);
    expect(canonicalTrackerBoxId(910501)).toBeNull();
  });

  it("resolveTrackedDropBoxId requires tracked route and enabled level", () => {
    const enabled = new Set([920151, 920003]);
    const isTrackedRoute = (boxId: number) => boxId === 920151 || boxId === 920003;

    expect(resolveTrackedDropBoxId(920151, enabled, isTrackedRoute)).toBe(920151);
    expect(resolveTrackedDropBoxId(920004, enabled, isTrackedRoute)).toBe(920003);
    expect(resolveTrackedDropBoxId(920501, enabled, isTrackedRoute)).toBeNull();
    expect(resolveTrackedDropBoxId(920151, new Set(), isTrackedRoute)).toBeNull();
  });

  it("maps stage keys to tracker routes", () => {
    const routes = loadStageBoxTrackerRoutes();
    expect(routeForStageKey(2305, routes)?.boxId).toBe(920501);
    expect(routeForStageKey(1308, routes)?.boxId).toBe(920301);
    expect(routeForStageKey(0, routes)).toBeNull();
  });

  it("sums rare boss chest slot quantities", () => {
    expect(
      rareBossChestQuantity([
        { type: 0, quantity: 3 },
        { type: 1, quantity: 2 },
        { type: 1, quantity: 1 },
      ]),
    ).toBe(3);
  });

  it("counts held rare stage boxes by canonical id", () => {
    const counts = countHeldRareStageBoxes([
      { itemKey: 920301 },
      { itemKey: 920004 },
      { itemKey: 910501 },
    ]);
    expect(counts.get(920301)).toBe(1);
    expect(counts.get(920003)).toBe(1);
    expect(counts.has(910501)).toBe(false);
  });
});
