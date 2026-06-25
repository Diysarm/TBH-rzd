import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { BoxTimerState } from "../../shared/types";

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

  function enabledBoxIds(state: BoxTimerState): number[] {
    return state.catalog.filter((entry) => entry.enabled).map((entry) => entry.boxId);
  }

  it("defaults to four mid-game route boxes on first run", async () => {
    const svc = await loadService();
    const state = svc.getState();
    expect(state.enabledCount).toBe(4);
    expect(state.rows).toHaveLength(0);
    expect(state.catalog).toHaveLength(14);
    expect(state.defaultCooldownSeconds).toBe(780);
  });

  it("toggles enabled boxes and persists selection", async () => {
    const svc = await loadService();
    const enabled = enabledBoxIds(svc.getState());
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
    expect(enabledBoxIds(svc.getState())).toEqual([920001, 920002]);
  });

  it("ignores legacy boss markDropped (13m timers removed)", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    svc.markDropped(920151);
    expect(svc.getState().rows).toHaveLength(0);
    expect(
      svc.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 15)?.status,
    ).not.toBe("cooldown");
  });

  it("stores per-box cooldown overrides", async () => {
    const svc = await loadService();
    svc.setCooldownSeconds(920151, 600);
    expect(svc.getState().catalog.find((e) => e.boxId === 920151)?.cooldownSeconds).toBe(600);
    expect(svc.getState().catalog.find((e) => e.boxId === 920151)?.cooldownIsCustom).toBe(true);

    svc.clearCooldownOverride(920151);
    expect(svc.getState().catalog.find((e) => e.boxId === 920151)?.cooldownSeconds).toBe(780);
    expect(svc.getState().catalog.find((e) => e.boxId === 920151)?.cooldownIsCustom).toBe(false);

    const raw = JSON.parse(readFileSync(join(userDataDir, "box_timers.json"), "utf-8")) as {
      cooldownSecondsByBoxId?: Record<string, number>;
    };
    expect(raw.cooldownSecondsByBoxId?.["920151"]).toBeUndefined();
  });

  it("stores per-box clear time overrides in catalog only", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    svc.setCooldownSeconds(920151, 780);
    svc.setClearTimeSeconds(920151, 120);
    expect(svc.getState().catalog.find((e) => e.boxId === 920151)?.clearTimeSeconds).toBe(120);
    expect(svc.getState().rows).toHaveLength(0);
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
    expect(svc.getState().catalog.find((e) => e.boxId === 920501)?.idealStageKey).toBe(altStage);
    expect(svc.getState().catalog.find((e) => e.boxId === 920501)?.idealStageIsCustom).toBe(true);

    svc.clearFarmStageOverride(920501);
    expect(svc.getState().catalog.find((e) => e.boxId === 920501)?.idealStageKey).toBe(
      route?.defaultIdealStageKey,
    );
  });

  it("resets slot cooldown when Player.log ItemKey repeats", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    expect(svc.tryMarkDroppedFromLog(920151)).toBe(true);
    expect(
      svc.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 15)?.status,
    ).toBe("cooldown");
    expect(svc.tryMarkDroppedFromLog(920151)).toBe(true);
    expect(
      svc.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 15)?.status,
    ).toBe("cooldown");
  });

  it("marks slot dropped from Player.log ItemKey for tracked boxes", async () => {
    const svc = await loadService();
    expect(svc.tryMarkDroppedFromLog(920151)).toBe(true);
    expect(
      svc.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 15)?.status,
    ).toBe("cooldown");
  });

  it("ignores Player.log ItemKey when box level is not tracked", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920151]);
    svc.setCurrentStageKey(1203);
    expect(svc.tryMarkDroppedFromLog(920501)).toBe(false);
    expect(svc.getState().rows.find((r) => r.boxId === 920501)).toBeUndefined();
    expect(
      svc.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 50),
    ).toBeUndefined();
  });

  it("marks common slot from Player.log ItemKey 910xxx for chest level", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920301]);
    expect(svc.tryMarkDroppedFromLog(910301)).toBe(true);
    const common = svc.getState().slotRows.find((r) => r.slot === "common" && r.level === 30);
    expect(common?.status).toBe("cooldown");
    expect(common?.cooldownSeconds).toBe(300);
  });

  it("marks slot timers from save slot counts using stage boss level", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920301]);
    svc.setCurrentStageKey(2108);
    expect(svc.tryMarkDroppedFromSave([{ type: 0, quantity: 1 }])).toBe(false);
    expect(svc.tryMarkDroppedFromSave([{ type: 0, quantity: 2 }])).toBe(true);
    expect(svc.getState().slotRows.find((r) => r.slot === "common" && r.level === 30)?.status).toBe(
      "cooldown",
    );

    const svc2 = await loadService();
    svc2.setEnabledBoxIds([920301]);
    svc2.setCurrentStageKey(2108);
    expect(svc2.tryMarkDroppedFromSave([{ type: 1, quantity: 1 }])).toBe(false);
    expect(svc2.tryMarkDroppedFromSave([{ type: 1, quantity: 2 }])).toBe(true);
    const blue = svc2.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 30);
    expect(blue?.status).toBe("cooldown");
    expect(blue?.cooldownSeconds).toBe(420);
  });

  it("persists custom slot cooldown overrides", async () => {
    const svc = await loadService();
    expect(svc.getState().slotCooldown.commonSeconds).toBe(300);
    expect(svc.getState().slotCooldown.stageBossSeconds).toBe(420);

    svc.setSlotCooldownSeconds("common", 360);
    svc.setSlotCooldownSeconds("stageBoss", 480);
    expect(svc.getState().slotCooldown.commonSeconds).toBe(360);
    expect(svc.getState().slotCooldown.stageBossIsCustom).toBe(true);

    svc.setEnabledBoxIds([920301]);
    svc.markSlotDropped("common", 30);
    const common = svc.getState().slotRows.find((r) => r.slot === "common" && r.level === 30);
    expect(common?.cooldownSeconds).toBe(360);

    svc.clearSlotCooldownOverride("common");
    expect(svc.getState().slotCooldown.commonSeconds).toBe(300);

    const svc2 = await loadService();
    expect(svc2.getState().slotCooldown.commonSeconds).toBe(300);
    expect(svc2.getState().slotCooldown.stageBossSeconds).toBe(480);
  });

  it("marks slot dropped from duplicate Player.log ItemKey via canonical id", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920003]);
    expect(svc.tryMarkDroppedFromLog(920004)).toBe(true);
    expect(
      svc.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 3)?.status,
    ).toBe("cooldown");
  });

  it("marks blue slot when rare boss chest slot count rises on a tracked stage", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920501]);
    svc.setCurrentStageKey(2305);
    expect(svc.tryMarkDroppedFromSave([{ type: 1, quantity: 1 }])).toBe(false);
    expect(svc.tryMarkDroppedFromSave([{ type: 1, quantity: 2 }])).toBe(true);
    expect(
      svc.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 50)?.status,
    ).toBe("cooldown");
  });

  it("marks blue slot when rare stage-box count rises in itemSaveDatas", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920301]);
    expect(svc.tryMarkDroppedFromInventory([{ itemKey: 920301 }])).toBe(false);
    expect(svc.tryMarkDroppedFromInventory([{ itemKey: 920301 }, { itemKey: 920301 }])).toBe(true);
    expect(
      svc.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 30)?.status,
    ).toBe("cooldown");
  });

  it("ignores save slot rise on unknown stage", async () => {
    const svc = await loadService();
    svc.setEnabledBoxIds([920501]);
    svc.setCurrentStageKey(9999);
    expect(svc.tryMarkDroppedFromSave([{ type: 1, quantity: 1 }])).toBe(false);
    expect(svc.tryMarkDroppedFromSave([{ type: 1, quantity: 2 }])).toBe(false);
    expect(
      svc.getState().slotRows.find((r) => r.slot === "stageBoss" && r.level === 50)?.status,
    ).not.toBe("cooldown");
    expect(svc.getState().rows.find((r) => r.boxId === 920501)?.status).not.toBe("cooldown");
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

  it("does not load legacy boss timers from disk", async () => {
    writeFileSync(
      join(userDataDir, "box_timers.json"),
      JSON.stringify({
        timers: [{ boxId: 920151, droppedAtMs: Date.now() }],
        enabledBoxIds: [920151],
      }),
    );

    const svc = await loadService();
    expect(svc.getState().rows).toHaveLength(0);
    expect(svc.getState().cooldownCount).toBe(0);
  });

  it("defaults sortOrder to cooldown-first and persists ready-first", async () => {
    const svc = await loadService();
    expect(svc.getState().sortOrder).toBe("cooldown-first");

    svc.setSortOrder("ready-first");
    expect(svc.getState().sortOrder).toBe("ready-first");

    const raw = JSON.parse(readFileSync(join(userDataDir, "box_timers.json"), "utf-8")) as {
      sortOrder: string;
    };
    expect(raw.sortOrder).toBe("ready-first");

    const svc2 = await loadService();
    expect(svc2.getState().sortOrder).toBe("ready-first");
  });
});
