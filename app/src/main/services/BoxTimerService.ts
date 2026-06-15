import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildStageBoxCatalog } from "../../core/stageBoxes";
import {
  canonicalTrackerBoxId,
  countHeldRareStageBoxes,
  effectiveBoxCooldownSeconds,
  loadStageBoxCatalogFile,
  loadStageBoxTrackerRoutes,
  rareBossChestQuantity,
  resolveTrackedDropBoxId,
  routeForStageKey,
  trackerRoutesById,
  type StageBoxTrackerRoute,
} from "../../core/stageBoxTracker";
import { stageName } from "../../core/stages";
import { compareBoxTimerRows, normalizeBoxTrackerSortOrder } from "../../core/boxTrackerSort";
import type {
  BoxTimerCatalogEntry,
  BoxTimerFarmStageOption,
  BoxTimerRow,
  BoxTimerState,
  BoxTrackerSortOrder,
  ChestHolding,
} from "../../../shared/types";
import { IPC } from "../../../shared/ipc";
import { broadcast } from "./broadcast";
import { createLogger } from "../log";
import type { ChestEventPayload } from "./NotificationService";

const log = createLogger("boxTimers");

interface PersistedTimer {
  boxId: number;
  droppedAtMs: number;
}

interface PersistedFile {
  timers: PersistedTimer[];
  enabledBoxIds?: number[];
  cooldownSecondsByBoxId?: Record<string, number>;
  clearTimeSecondsByBoxId?: Record<string, number>;
  idealStageKeyByBoxId?: Record<string, number>;
  notifyWhenReadyByBoxId?: Record<string, boolean>;
  sortOrder?: BoxTrackerSortOrder;
}

export class BoxTimerService {
  private readonly catalogFile = loadStageBoxCatalogFile();
  private readonly routes = loadStageBoxTrackerRoutes();
  private readonly routeById = trackerRoutesById(this.routes);
  private readonly boxById = new Map(buildStageBoxCatalog().items.map((b) => [b.id, b]));
  private readonly routeBoxIds: number[];
  private timers = new Map<number, number>();
  private enabledBoxIds = new Set<number>();
  private cooldownSecondsByBoxId = new Map<number, number>();
  private clearTimeSecondsByBoxId = new Map<number, number>();
  private idealStageKeyByBoxId = new Map<number, number>();
  private notifyWhenReadyByBoxId = new Map<number, boolean>();
  private sortOrder: BoxTrackerSortOrder = "cooldown-first";
  private wasOnCooldown = new Map<number, boolean>();
  private onChestReady: ((payload: ChestEventPayload) => void) | null = null;
  private onChestDropped: ((payload: ChestEventPayload) => void) | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private subscribers = 0;
  private currentStageKey = 0;
  private lastRareChestQty: number | null = null;
  private lastInventoryBoxCount = new Map<number, number>();
  private inventoryBaselineSeeded = false;
  private playerLogPath = "";
  private playerLogAvailable = false;

  constructor() {
    this.routeBoxIds = [...this.routeById.keys()].sort(
      (a, b) => (this.boxById.get(a)?.level ?? 0) - (this.boxById.get(b)?.level ?? 0) || a - b,
    );
    this.load();
    this.seedWasOnCooldown();
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
    if (!this.isEnabledRoute(boxId)) return this.buildState();
    this.timers.set(boxId, Date.now());
    const box = this.boxById.get(boxId);
    this.onChestDropped?.({
      boxId,
      name: box?.name ?? `Box ${boxId}`,
      level: box?.level ?? null,
    });
    return this.commitState();
  }

  /** Start cooldown when Player.log reports a tracked stage boss box drop. */
  tryMarkDroppedFromLog(itemKey: number): boolean {
    const boxId = resolveTrackedDropBoxId(
      itemKey,
      this.enabledBoxIds,
      (id) => this.routeById.has(id),
      this.catalogFile,
    );
    if (boxId == null) {
      this.logIgnoredLogDrop(itemKey);
      return false;
    }

    log.info(
      `Stage boss drop detected from Player.log (ItemKey ${itemKey} → Lv${this.boxById.get(boxId)?.level ?? "?"})`,
    );
    this.markDropped(boxId);
    return true;
  }

  /**
   * Fallback when Player.log is buffered: rare boss chest slot count rose on a
   * stage that drops a tracked level (save poll, ~5s).
   */
  tryMarkDroppedFromSave(chests: ChestHolding[], stageKey = this.currentStageKey): boolean {
    const rareQty = rareBossChestQuantity(chests);
    if (this.lastRareChestQty === null) {
      this.lastRareChestQty = rareQty;
      return false;
    }

    const prev = this.lastRareChestQty;
    this.lastRareChestQty = rareQty;
    if (rareQty <= prev) return false;

    const route = routeForStageKey(stageKey, this.routes);
    if (route == null) {
      log.info(
        `Rare boss chest slot ${prev}→${rareQty} on stage ${stageKey} (${stageName(stageKey)}) — no tracked level for this stage`,
      );
      return false;
    }

    return this.tryMarkDropped(
      route.boxId,
      `save rare slot ${prev}→${rareQty} @ stage ${stageKey}`,
    );
  }

  /** Detect new rare stage-box instances in itemSaveDatas (opened or listed items). */
  tryMarkDroppedFromInventory(items: readonly { itemKey: number }[]): boolean {
    const counts = countHeldRareStageBoxes(items, this.catalogFile);

    if (!this.inventoryBaselineSeeded) {
      for (const boxId of this.routeBoxIds) {
        this.lastInventoryBoxCount.set(boxId, counts.get(boxId) ?? 0);
      }
      this.inventoryBaselineSeeded = true;
      return false;
    }

    let marked = false;
    for (const boxId of this.routeBoxIds) {
      if (!this.enabledBoxIds.has(boxId)) continue;
      const prev = this.lastInventoryBoxCount.get(boxId) ?? 0;
      const count = counts.get(boxId) ?? 0;
      if (count > prev) {
        if (this.tryMarkDropped(boxId, `save inventory count ${prev}→${count}`)) {
          marked = true;
        }
      }
      this.lastInventoryBoxCount.set(boxId, count);
    }
    return marked;
  }

  private tryMarkDropped(boxId: number, source: string): boolean {
    if (!this.isEnabledRoute(boxId)) return false;
    if (this.isDropOnCooldown(boxId)) return false;

    log.info(
      `Stage boss drop detected (${source} → Lv${this.boxById.get(boxId)?.level ?? "?"})`,
    );
    this.markDropped(boxId);
    return true;
  }

  private isDropOnCooldown(boxId: number): boolean {
    const droppedAt = this.timers.get(boxId);
    if (droppedAt === undefined) return false;
    const effectiveCd = this.resolveEffectiveCooldownSeconds(boxId);
    const elapsed = (Date.now() - droppedAt) / 1000;
    return elapsed < effectiveCd;
  }

  private logIgnoredLogDrop(itemKey: number): void {
    const canonical = canonicalTrackerBoxId(itemKey, this.catalogFile);
    if (canonical == null || !this.routeById.has(canonical)) return;
    if (this.enabledBoxIds.has(canonical)) return;
    const level = this.boxById.get(canonical)?.level ?? "?";
    log.info(`Player.log Lv${level} drop — enable Lv${level} in tracker chips for auto-detect`);
  }

  setPlayerLogStatus(path: string, available: boolean): void {
    if (this.playerLogPath === path && this.playerLogAvailable === available) return;
    this.playerLogPath = path;
    this.playerLogAvailable = available;
    this.push();
  }

  clearTimer(boxId: number): BoxTimerState {
    this.timers.delete(boxId);
    this.wasOnCooldown.delete(boxId);
    return this.commitState();
  }

  setOnChestReady(callback: (payload: ChestEventPayload) => void): void {
    this.onChestReady = callback;
  }

  setOnChestDropped(callback: (payload: ChestEventPayload) => void): void {
    this.onChestDropped = callback;
  }

  setBoxTrackerNotify(boxId: number, enabled: boolean): BoxTimerState {
    if (!this.routeById.has(boxId)) return this.buildState();
    if (enabled) {
      this.notifyWhenReadyByBoxId.delete(boxId);
    } else {
      this.notifyWhenReadyByBoxId.set(boxId, false);
    }
    return this.commitState();
  }

  setSortOrder(sortOrder: BoxTrackerSortOrder): BoxTimerState {
    this.sortOrder = normalizeBoxTrackerSortOrder(sortOrder);
    return this.commitState();
  }

  setCooldownSeconds(boxId: number, cooldownSeconds: number): BoxTimerState {
    if (!this.routeById.has(boxId)) return this.buildState();
    const seconds = Math.max(60, Math.min(86_400, Math.round(cooldownSeconds)));
    this.cooldownSecondsByBoxId.set(boxId, seconds);
    const clear = this.clearTimeSecondsByBoxId.get(boxId) ?? 0;
    if (clear > seconds) {
      this.clearTimeSecondsByBoxId.set(boxId, seconds);
    }
    return this.commitState();
  }

  clearCooldownOverride(boxId: number): BoxTimerState {
    this.cooldownSecondsByBoxId.delete(boxId);
    const maxClear = this.resolveCooldownSeconds(boxId);
    const clear = this.clearTimeSecondsByBoxId.get(boxId) ?? 0;
    if (clear > maxClear) {
      this.clearTimeSecondsByBoxId.set(boxId, maxClear);
    }
    return this.commitState();
  }

  setClearTimeSeconds(boxId: number, clearTimeSeconds: number): BoxTimerState {
    if (!this.routeById.has(boxId)) return this.buildState();
    const maxClear = this.resolveCooldownSeconds(boxId);
    const seconds = Math.max(0, Math.min(maxClear, Math.round(clearTimeSeconds)));
    if (seconds === 0) {
      this.clearTimeSecondsByBoxId.delete(boxId);
    } else {
      this.clearTimeSecondsByBoxId.set(boxId, seconds);
    }
    return this.commitState();
  }

  clearClearTimeOverride(boxId: number): BoxTimerState {
    this.clearTimeSecondsByBoxId.delete(boxId);
    return this.commitState();
  }

  setFarmStageKey(boxId: number, stageKey: number): BoxTimerState {
    const route = this.routeById.get(boxId);
    if (!route || !route.dropStageKeys.includes(stageKey)) return this.buildState();
    if (stageKey === route.idealStageKey) {
      this.idealStageKeyByBoxId.delete(boxId);
    } else {
      this.idealStageKeyByBoxId.set(boxId, stageKey);
    }
    return this.commitState();
  }

  clearFarmStageOverride(boxId: number): BoxTimerState {
    this.idealStageKeyByBoxId.delete(boxId);
    return this.commitState();
  }

  /** Replace the visible timer set (e.g. preset chips). */
  setEnabledBoxIds(boxIds: number[]): BoxTimerState {
    const valid = boxIds.filter((id) => this.routeById.has(id));
    this.enabledBoxIds = new Set(valid);
    for (const boxId of [...this.timers.keys()]) {
      if (!this.enabledBoxIds.has(boxId)) this.timers.delete(boxId);
    }
    return this.commitState();
  }

  /** Reset timers and enabled routes after box_timers.json was deleted. */
  resetStorage(): BoxTimerState {
    this.timers.clear();
    this.enabledBoxIds.clear();
    this.cooldownSecondsByBoxId.clear();
    this.clearTimeSecondsByBoxId.clear();
    this.idealStageKeyByBoxId.clear();
    this.notifyWhenReadyByBoxId.clear();
    this.sortOrder = "cooldown-first";
    this.wasOnCooldown.clear();
    for (const id of this.defaultEnabledIds()) this.enabledBoxIds.add(id);
    return this.commitState();
  }

  private isEnabledRoute(boxId: number): boolean {
    return this.routeById.has(boxId) && this.enabledBoxIds.has(boxId);
  }

  private commitState(): BoxTimerState {
    this.persist();
    const state = this.buildState();
    broadcast(IPC.BOX_TIMERS, state);
    return state;
  }

  push(): void {
    broadcast(IPC.BOX_TIMERS, this.buildState());
  }

  private resolveCooldownSeconds(boxId: number): number {
    return this.cooldownSecondsByBoxId.get(boxId) ?? this.catalogFile.defaultCooldownSeconds ?? 780;
  }

  private resolveClearTimeSeconds(boxId: number): number {
    return this.clearTimeSecondsByBoxId.get(boxId) ?? 0;
  }

  private resolveEffectiveCooldownSeconds(boxId: number): number {
    return effectiveBoxCooldownSeconds(
      this.resolveCooldownSeconds(boxId),
      this.resolveClearTimeSeconds(boxId),
    );
  }

  private seedWasOnCooldown(): void {
    const now = Date.now();
    for (const boxId of this.enabledBoxIds) {
      const droppedAt = this.timers.get(boxId);
      if (droppedAt === undefined) {
        this.wasOnCooldown.set(boxId, false);
        continue;
      }
      const cooldownSeconds = this.resolveEffectiveCooldownSeconds(boxId);
      const elapsed = (now - droppedAt) / 1000;
      const remaining = Math.max(0, Math.ceil(cooldownSeconds - elapsed));
      this.wasOnCooldown.set(boxId, remaining > 0);
    }
  }

  private resolveNotifyWhenReady(boxId: number): boolean {
    if (!this.enabledBoxIds.has(boxId)) return false;
    const explicit = this.notifyWhenReadyByBoxId.get(boxId);
    return explicit ?? true;
  }

  private resolveFarmStage(boxId: number): {
    key: number;
    label: string;
    defaultKey: number;
    defaultLabel: string;
    isCustom: boolean;
    options: BoxTimerFarmStageOption[];
  } {
    const route = this.routeById.get(boxId);
    const defaultKey = route?.idealStageKey ?? 0;
    const defaultLabel = defaultKey > 0 ? stageName(defaultKey) : "—";
    const override = this.idealStageKeyByBoxId.get(boxId);
    const key = override ?? defaultKey;
    const options = this.buildFarmStageOptions(route);
    return {
      key,
      label: key > 0 ? stageName(key) : "—",
      defaultKey,
      defaultLabel,
      isCustom: override != null,
      options,
    };
  }

  private buildFarmStageOptions(
    route: StageBoxTrackerRoute | undefined,
  ): BoxTimerFarmStageOption[] {
    if (!route) return [];
    const wikiKey = route.idealStageKey;
    return route.dropStageKeys.map((stageKey) => ({
      stageKey,
      label: stageKey === wikiKey ? `${stageName(stageKey)} (recommended)` : stageName(stageKey),
    }));
  }

  private buildCatalog(): BoxTimerCatalogEntry[] {
    return this.routeBoxIds.map((boxId) => {
      const box = this.boxById.get(boxId);
      const route = this.routeById.get(boxId);
      const farm = this.resolveFarmStage(boxId);
      return {
        boxId,
        name: box?.name ?? `Box ${boxId}`,
        level: box?.level ?? null,
        idealStageKey: farm.key,
        idealStageLabel: farm.label,
        defaultIdealStageKey: farm.defaultKey,
        defaultIdealStageLabel: farm.defaultLabel,
        idealStageIsCustom: farm.isCustom,
        farmStageOptions: farm.options,
        dropStageRangeLabel: route?.dropStageRangeLabel ?? "—",
        cooldownSeconds: this.resolveCooldownSeconds(boxId),
        cooldownIsCustom: this.cooldownSecondsByBoxId.has(boxId),
        clearTimeSeconds: this.resolveClearTimeSeconds(boxId),
        enabled: this.enabledBoxIds.has(boxId),
        notifyWhenReady: this.resolveNotifyWhenReady(boxId),
      };
    });
  }

  private buildRow(boxId: number, now: number): BoxTimerRow {
    const box = this.boxById.get(boxId);
    const cooldownSeconds = this.resolveCooldownSeconds(boxId);
    const clearTimeSeconds = this.resolveClearTimeSeconds(boxId);
    const effectiveCooldownSeconds = this.resolveEffectiveCooldownSeconds(boxId);
    const droppedAt = this.timers.get(boxId);
    let remainingSeconds = 0;
    let active = false;
    let progress = 0;

    if (droppedAt !== undefined) {
      const elapsed = (now - droppedAt) / 1000;
      remainingSeconds = Math.max(0, Math.ceil(effectiveCooldownSeconds - elapsed));
      active = remainingSeconds > 0;
      progress =
        effectiveCooldownSeconds > 0 ? Math.min(1, elapsed / effectiveCooldownSeconds) : 1;
      if (!active) {
        this.timers.delete(boxId);
        this.persist();
      }
    }

    const farm = this.resolveFarmStage(boxId);
    const atIdealStage = farm.key > 0 && this.currentStageKey === farm.key;

    return {
      boxId,
      name: box?.name ?? `Box ${boxId}`,
      level: box?.level ?? null,
      idealStageKey: farm.key,
      idealStageLabel: farm.label,
      cooldownSeconds,
      cooldownIsCustom: this.cooldownSecondsByBoxId.has(boxId),
      clearTimeSeconds,
      effectiveCooldownSeconds,
      active,
      remainingSeconds,
      progress,
      status: active ? "cooldown" : "ready",
      atIdealStage,
    };
  }

  private buildState(): BoxTimerState {
    const now = Date.now();
    const rows: BoxTimerRow[] = [];
    const readyNotifications: ChestEventPayload[] = [];

    for (const boxId of this.routeBoxIds) {
      if (!this.enabledBoxIds.has(boxId)) {
        this.wasOnCooldown.delete(boxId);
        continue;
      }
      const prevOnCooldown = this.wasOnCooldown.get(boxId) ?? false;
      const row = this.buildRow(boxId, now);
      if (prevOnCooldown && !row.active && this.resolveNotifyWhenReady(boxId)) {
        readyNotifications.push({ boxId, name: row.name, level: row.level });
      }
      this.wasOnCooldown.set(boxId, row.active);
      rows.push(row);
    }

    for (const payload of readyNotifications) {
      this.onChestReady?.(payload);
    }

    rows.sort((a, b) => compareBoxTimerRows(a, b, this.sortOrder));

    const readyCount = rows.filter((r) => r.status === "ready").length;
    const cooldownCount = rows.filter((r) => r.status === "cooldown").length;

    return {
      rows,
      catalog: this.buildCatalog(),
      enabledCount: this.enabledBoxIds.size,
      readyCount,
      cooldownCount,
      sortOrder: this.sortOrder,
      currentStageKey: this.currentStageKey,
      defaultCooldownSeconds: this.catalogFile.defaultCooldownSeconds ?? 780,
      playerLogPath: this.playerLogPath,
      playerLogAvailable: this.playerLogAvailable,
    };
  }

  private defaultEnabledIds(): number[] {
    const preferred = [920151, 920201, 920301, 920401];
    const picked = preferred.filter((id) => this.routeById.has(id));
    return picked.length > 0 ? picked : this.routeBoxIds.slice(0, 4);
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
    if (!existsSync(path)) {
      for (const id of this.defaultEnabledIds()) this.enabledBoxIds.add(id);
      return;
    }
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as PersistedFile;
      for (const t of raw.timers ?? []) {
        if (t.boxId && t.droppedAtMs) this.timers.set(t.boxId, t.droppedAtMs);
      }
      for (const [boxId, seconds] of Object.entries(raw.cooldownSecondsByBoxId ?? {})) {
        const id = Number(boxId);
        if (id > 0 && seconds > 0 && this.routeById.has(id)) {
          this.cooldownSecondsByBoxId.set(id, seconds);
        }
      }
      for (const [boxId, seconds] of Object.entries(raw.clearTimeSecondsByBoxId ?? {})) {
        const id = Number(boxId);
        const clear = Number(seconds);
        if (id > 0 && clear > 0 && this.routeById.has(id)) {
          const maxClear = this.resolveCooldownSeconds(id);
          this.clearTimeSecondsByBoxId.set(id, Math.min(clear, maxClear));
        }
      }
      for (const [boxId, stageKey] of Object.entries(raw.idealStageKeyByBoxId ?? {})) {
        const id = Number(boxId);
        const key = Number(stageKey);
        const route = this.routeById.get(id);
        if (id > 0 && key > 0 && route?.dropStageKeys.includes(key)) {
          if (key === route.idealStageKey) continue;
          this.idealStageKeyByBoxId.set(id, key);
        }
      }
      for (const [boxId, notify] of Object.entries(raw.notifyWhenReadyByBoxId ?? {})) {
        const id = Number(boxId);
        if (id > 0 && this.routeById.has(id)) {
          this.notifyWhenReadyByBoxId.set(id, Boolean(notify));
        }
      }
      this.sortOrder = normalizeBoxTrackerSortOrder(raw.sortOrder);
      const enabled = raw.enabledBoxIds?.filter((id) => this.routeById.has(id)) ?? [];
      if (enabled.length > 0) {
        for (const id of enabled) this.enabledBoxIds.add(id);
      } else {
        for (const id of this.defaultEnabledIds()) this.enabledBoxIds.add(id);
      }
    } catch {
      for (const id of this.defaultEnabledIds()) this.enabledBoxIds.add(id);
    }
    this.seedWasOnCooldown();
  }

  private persist(): void {
    const path = this.persistPath();
    mkdirSync(dirname(path), { recursive: true });
    const timers: PersistedTimer[] = [...this.timers.entries()].map(([boxId, droppedAtMs]) => ({
      boxId,
      droppedAtMs,
    }));
    const cooldownSecondsByBoxId = Object.fromEntries(this.cooldownSecondsByBoxId);
    const clearTimeSecondsByBoxId = Object.fromEntries(
      [...this.clearTimeSecondsByBoxId.entries()].filter(([, seconds]) => seconds > 0),
    );
    const idealStageKeyByBoxId = Object.fromEntries(this.idealStageKeyByBoxId);
    const notifyWhenReadyByBoxId = Object.fromEntries(
      [...this.notifyWhenReadyByBoxId.entries()].filter(([, enabled]) => !enabled),
    );
    writeFileSync(
      path,
      JSON.stringify(
        {
          timers,
          enabledBoxIds: [...this.enabledBoxIds],
          cooldownSecondsByBoxId,
          clearTimeSecondsByBoxId,
          idealStageKeyByBoxId,
          notifyWhenReadyByBoxId,
          sortOrder: this.sortOrder,
        },
        null,
        2,
      ),
    );
  }
}
