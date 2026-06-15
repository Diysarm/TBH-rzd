import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("electron", () => ({
  app: {
    getPath: () => userDataDir,
    isPackaged: false,
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}));

vi.mock("../../src/main/log", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../src/main/services/broadcast", () => ({
  broadcast: vi.fn(),
}));

let userDataDir = "";

describe("BoxTimerService", () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), "tbh-box-timers-"));
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  async function loadService() {
    const { BoxTimerService } = await import("../../src/main/services/BoxTimerService");
    return new BoxTimerService();
  }

  it("defaults to four mid-game route boxes on first run", async () => {
    const svc = await loadService();
    const state = svc.getState();
    expect(state.enabledCount).toBe(4);
    expect(state.rows).toHaveLength(4);
    expect(state.catalog).toHaveLength(14);
    expect(state.defaultCooldownSeconds).toBe(780);
  });

  it("toggles enabled boxes and persists selection", async () => {
    const svc = await loadService();
    const enabled = svc.getState().rows.map((r) => r.boxId);
    svc.setEnabledBoxIds(enabled.filter((id) => id !== 920151));
    expect(svc.getState().enabledCount).toBe(3);

    const svc2 = await loadService();
    expect(svc2.getState().enabledCount).toBe(3);

    const raw = JSON.parse(readFileSync(join(userDataDir, "box_timers.json"), "utf-8")) as {
      enabledBoxIds: number[];
    };
    expect(raw.enabledBoxIds).not.toContain(920151);
  });

  it("replaces selection with setEnabledBoxIds", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920001, 920002]);
    expect(svc.getState().enabledCount).toBe(2);
    expect(svc.getState().rows.map((r) => r.boxId)).toEqual([920001, 920002]);
  });

  it("marks dropped boxes as cooldown then ready after clear", async () => {
    const svc = await loadService();
    svc.markDropped(920151);
    expect(svc.getState().rows.find((r) => r.boxId === 920151)?.status).toBe("cooldown");

    svc.clearTimer(920151);
    expect(svc.getState().rows.find((r) => r.boxId === 920151)?.status).toBe("ready");
  });

  it("stores per-box cooldown overrides", async () => {
    const svc = await loadService();
    svc.setCooldownSeconds(920151, 600);
    expect(svc.getState().rows.find((r) => r.boxId === 920151)?.cooldownSeconds).toBe(600);
    expect(svc.getState().rows.find((r) => r.boxId === 920151)?.cooldownIsCustom).toBe(true);

    svc.clearCooldownOverride(920151);
    expect(svc.getState().rows.find((r) => r.boxId === 920151)?.cooldownSeconds).toBe(780);
    expect(svc.getState().rows.find((r) => r.boxId === 920151)?.cooldownIsCustom).toBe(false);

    const raw = JSON.parse(readFileSync(join(userDataDir, "box_timers.json"), "utf-8")) as {
      cooldownSecondsByBoxId?: Record<string, number>;
    };
    expect(raw.cooldownSecondsByBoxId?.["920151"]).toBeUndefined();
  });

  it("reduces active cooldown by clear time seconds", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    svc.setCooldownSeconds(920151, 780);
    svc.setClearTimeSeconds(920151, 120);
    svc.markDropped(920151);
    const row = svc.getState().rows.find((r) => r.boxId === 920151);
    expect(row?.effectiveCooldownSeconds).toBe(660);
    expect(row?.remainingSeconds).toBe(660);
    expect(row?.status).toBe("cooldown");
  });

  it("persists clear time overrides", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    svc.setClearTimeSeconds(920151, 200);
    expect(svc.getState().catalog.find((e) => e.boxId === 920151)?.clearTimeSeconds).toBe(200);

    const svc2 = await loadService();
    expect(svc2.getState().catalog.find((e) => e.boxId === 920151)?.clearTimeSeconds).toBe(200);

    svc2.clearClearTimeOverride(920151);
    expect(svc2.getState().catalog.find((e) => e.boxId === 920151)?.clearTimeSeconds).toBe(0);
  });

  it("clamps clear time when base cooldown is lowered", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    svc.setClearTimeSeconds(920151, 300);
    svc.setCooldownSeconds(920151, 240);
    expect(svc.getState().catalog.find((e) => e.boxId === 920151)?.clearTimeSeconds).toBe(240);
  });

  it("includes drop stage range on catalog", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920501]);
    const entry = svc.getState().catalog.find((e) => e.boxId === 920501);
    expect(entry?.dropStageRangeLabel).toContain("Nightmare 3-5");
    expect(entry?.farmStageOptions.length).toBeGreaterThan(0);
  });

  it("stores per-box farm stage overrides", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920501]);
    const route = svc.getState().catalog.find((e) => e.boxId === 920501);
    const altStage = route?.farmStageOptions.find(
      (opt) => opt.stageKey !== route.defaultIdealStageKey,
    )?.stageKey;
    expect(altStage).toBeDefined();

    svc.setFarmStageKey(920501, altStage!);
    const row = svc.getState().rows.find((r) => r.boxId === 920501);
    expect(row?.idealStageKey).toBe(altStage);
    expect(svc.getState().catalog.find((e) => e.boxId === 920501)?.idealStageIsCustom).toBe(true);

    svc.clearFarmStageOverride(920501);
    expect(svc.getState().rows.find((r) => r.boxId === 920501)?.idealStageKey).toBe(
      route?.defaultIdealStageKey,
    );
  });

  it("resets cooldown when Player.log ItemKey repeats (upstream behavior)", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    expect(svc.tryMarkDroppedFromLog(920151)).toBe(true);
    expect(svc.getState().rows.find((r) => r.boxId === 920151)?.status).toBe("cooldown");
    expect(svc.tryMarkDroppedFromLog(920151)).toBe(true);
    expect(svc.getState().rows.find((r) => r.boxId === 920151)?.status).toBe("cooldown");
  });

  it("marks dropped from Player.log ItemKey for tracked boxes", async () => {
    const svc = await loadService();
    expect(svc.tryMarkDroppedFromLog(920151)).toBe(true);
    expect(svc.getState().rows.find((r) => r.boxId === 920151)?.status).toBe("cooldown");
  });

  it("ignores Player.log ItemKey when box level is not tracked", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    expect(svc.tryMarkDroppedFromLog(920501)).toBe(false);
    expect(svc.getState().rows.find((r) => r.boxId === 920501)).toBeUndefined();
  });

  it("marks dropped from duplicate Player.log ItemKey via canonical id", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920003]);
    expect(svc.tryMarkDroppedFromLog(920004)).toBe(true);
    expect(svc.getState().rows.find((r) => r.boxId === 920003)?.status).toBe("cooldown");
  });

  it("marks dropped when rare boss chest slot count rises on a tracked stage", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920501]);
    svc.setCurrentStageKey(2305);
    expect(svc.tryMarkDroppedFromSave([{ type: 1, quantity: 1 }])).toBe(false);
    expect(svc.tryMarkDroppedFromSave([{ type: 1, quantity: 2 }])).toBe(true);
    expect(svc.getState().rows.find((r) => r.boxId === 920501)?.status).toBe("cooldown");
  });

  it("marks dropped when rare stage-box count rises in itemSaveDatas", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920301]);
    expect(svc.tryMarkDroppedFromInventory([{ itemKey: 920301 }])).toBe(false);
    expect(svc.tryMarkDroppedFromInventory([{ itemKey: 920301 }, { itemKey: 920301 }])).toBe(true);
    expect(svc.getState().rows.find((r) => r.boxId === 920301)?.status).toBe("cooldown");
  });

  it("ignores rare chest increase when stage has no tracked route", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920501]);
    svc.setCurrentStageKey(9999);
    expect(svc.tryMarkDroppedFromSave([{ type: 1, quantity: 1 }])).toBe(false);
    expect(svc.tryMarkDroppedFromSave([{ type: 1, quantity: 2 }])).toBe(false);
  });

  it("defaults notifyWhenReady to true and persists opt-out", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    expect(svc.getState().catalog.find((e) => e.boxId === 920151)?.notifyWhenReady).toBe(true);

    svc.setBoxTrackerNotify(920151, false);
    expect(svc.getState().catalog.find((e) => e.boxId === 920151)?.notifyWhenReady).toBe(false);

    const svc2 = await loadService();
    expect(svc2.getState().catalog.find((e) => e.boxId === 920151)?.notifyWhenReady).toBe(false);
  });

  it("fires chest-ready callback once on cooldown transition", async () => {
    const onReady = vi.fn();
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    svc.setOnChestReady(onReady);
    svc.setCooldownSeconds(920151, 60);
    svc.markDropped(920151);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    svc.getState();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(
      expect.objectContaining({ boxId: 920151, level: expect.any(Number) }),
    );

    svc.getState();
    expect(onReady).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("fires chest-dropped callback when markDropped succeeds", async () => {
    const onDropped = vi.fn();
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    svc.setOnChestDropped(onDropped);
    svc.markDropped(920151);
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(onDropped).toHaveBeenCalledWith(
      expect.objectContaining({ boxId: 920151, name: expect.any(String) }),
    );
  });

  it("does not fire chest-dropped for disabled routes", async () => {
    const onDropped = vi.fn();
    const svc = await loadService();
    svc.setEnabledBoxIds([]);
    svc.setOnChestDropped(onDropped);
    svc.markDropped(920151);
    expect(onDropped).not.toHaveBeenCalled();
  });

  it("does not fire chest-ready on cold load of expired timer", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    svc.setCooldownSeconds(920151, 60);
    svc.markDropped(920151);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 120_000);
    svc.getState();

    const onReady = vi.fn();
    const svc2 = await loadService();
    svc2.setEnabledBoxIds([920151]);
    svc2.setOnChestReady(onReady);
    svc2.getState();
    expect(onReady).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("defaults sortOrder to cooldown-first and persists ready-first", async () => {
    const svc = await loadService();
    expect(svc.getState().sortOrder).toBe("cooldown-first");

    svc.setEnabledBoxIds([920151, 920201]);
    svc.markDropped(920151);
    const before = svc.getState().rows.map((r) => r.status);
    expect(before[0]).toBe("cooldown");

    svc.setSortOrder("ready-first");
    expect(svc.getState().sortOrder).toBe("ready-first");
    const after = svc.getState().rows.map((r) => r.status);
    expect(after[0]).toBe("ready");

    const raw = JSON.parse(readFileSync(join(userDataDir, "box_timers.json"), "utf-8")) as {
      sortOrder: string;
    };
    expect(raw.sortOrder).toBe("ready-first");

    const svc2 = await loadService();
    expect(svc2.getState().sortOrder).toBe("ready-first");
    expect(svc2.getState().rows[0]?.status).toBe("ready");
  });
});
