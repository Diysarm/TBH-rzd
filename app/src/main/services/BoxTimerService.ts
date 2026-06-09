import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildStageBoxCatalog } from "../../core/stageBoxes";
import { loadRareBoxRoutesCatalog, rareRoutesById } from "../../core/boxes";
import type { BoxTimerRow, BoxTimerState } from "../../../shared/types";
import { IPC } from "../../../shared/ipc";
import { broadcast } from "./broadcast";

interface PersistedTimer {
  boxId: number;
  droppedAtMs: number;
}

interface PersistedFile {
  timers: PersistedTimer[];
}

export class BoxTimerService {
  private readonly routes = loadRareBoxRoutesCatalog();
  private readonly routeById = rareRoutesById(this.routes);
  private readonly stageBoxes = buildStageBoxCatalog().items.filter((i) => i.id >= 920000 && i.id < 930000);
  private timers = new Map<number, number>();
  private tickTimer: NodeJS.Timeout | null = null;
  private subscribers = 0;
  private currentStageKey = 0;

  constructor() {
    this.load();
  }

  setCurrentStageKey(key: number): void {
    if (this.currentStageKey === key) return;
    this.currentStageKey = key;
    this.push();
  }

  startTick(): void {
    this.subscribers++;
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.push(), 1000);
  }

  stopTick(): void {
    this.subscribers = Math.max(0, this.subscribers - 1);
    if (this.subscribers > 0 || !this.tickTimer) return;
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  getState(): BoxTimerState {
    return this.buildState();
  }

  markDropped(boxId: number): BoxTimerState {
    if (!this.routeById.has(boxId)) return this.buildState();
    this.timers.set(boxId, Date.now());
    this.persist();
    const state = this.buildState();
    broadcast(IPC.BOX_TIMERS, state);
    return state;
  }

  clearTimer(boxId: number): BoxTimerState {
    this.timers.delete(boxId);
    this.persist();
    const state = this.buildState();
    broadcast(IPC.BOX_TIMERS, state);
    return state;
  }

  push(): void {
    broadcast(IPC.BOX_TIMERS, this.buildState());
  }

  private buildState(): BoxTimerState {
    const now = Date.now();
    const rows: BoxTimerRow[] = this.stageBoxes.map((box) => {
      const route = this.routeById.get(box.id);
      const cooldownSeconds = route ? this.routes.cooldownSeconds : this.routes.cooldownSeconds;
      const droppedAt = this.timers.get(box.id);
      let remainingSeconds = 0;
      let active = false;
      let progress = 0;

      if (droppedAt !== undefined) {
        const elapsed = (now - droppedAt) / 1000;
        remainingSeconds = Math.max(0, Math.ceil(cooldownSeconds - elapsed));
        active = remainingSeconds > 0;
        progress = Math.min(1, elapsed / cooldownSeconds);
        if (!active) {
          this.timers.delete(box.id);
          this.persist();
        }
      }

      return {
        boxId: box.id,
        name: box.name,
        level: box.level,
        idealStageKey: route?.idealStageKey ?? 0,
        idealStageLabel: route?.idealStageLabel ?? "—",
        cooldownSeconds,
        active,
        remainingSeconds,
        progress,
      };
    });

    rows.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.boxId - b.boxId);

    return {
      rows,
      currentStageKey: this.currentStageKey,
      disclaimer: this.routes.disclaimer,
    };
  }

  private persistPath(): string {
    try {
      return join(app.getPath("userData"), "box_timers.json");
    } catch {
      return join(process.cwd(), "box_timers.json");
    }
  }

  private load(): void {
    const path = this.persistPath();
    if (!existsSync(path)) return;
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as PersistedFile;
      for (const t of raw.timers ?? []) {
        if (t.boxId && t.droppedAtMs) this.timers.set(t.boxId, t.droppedAtMs);
      }
    } catch {
      // ignore corrupt file
    }
  }

  private persist(): void {
    const path = this.persistPath();
    mkdirSync(dirname(path), { recursive: true });
    const timers: PersistedTimer[] = [...this.timers.entries()].map(([boxId, droppedAtMs]) => ({
      boxId,
      droppedAtMs,
    }));
    writeFileSync(path, JSON.stringify({ timers }, null, 2));
  }
}
