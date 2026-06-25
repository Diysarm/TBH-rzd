import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildStageBoxCatalog } from "../../core/stageBoxes";
import {
  canonicalTrackerBoxId,
  countHeldRareStageBoxes,
  loadStageBoxCatalogFile,
  loadStageBoxTrackerRoutes,
  rareBossChestQuantity,
  resolveTrackedDropBoxId,
  trackerRoutesById,
  type StageBoxTrackerRoute,
} from "../../core/stageBoxTracker";
import {
  bossLevelForStageKey,
  commonChestQuantity,
  commonBoxIdForLevel,
  parseSlotTimerStorageKey,
  rareBoxIdForLevel,
  SLOT_CHEST_DEFAULT_COOLDOWN_SECONDS,
  SLOT_CHEST_KINDS,
  SLOT_CHEST_SHORT_LABELS,
  slotChestKindFromItemKey,
  slotLevelsForEnabledRoutes,
  slotTimerStorageKey,
  stageBoxLevelFromItemKey,
  totalHeldCommonStageBoxes,
  trackerMetaForChestLevel,
  type SlotChestKind,
} from "../../core/slotChestTracker";
import { stageName } from "../../core/stages";
import { normalizeBoxTrackerSortOrder } from "../../core/boxTrackerSort";
import type {
  BoxTimerCatalogEntry,
  BoxTimerFarmStageOption,
  BoxTimerState,
  BoxTrackerSortOrder,
  ChestHolding,
  SlotChestTimerRow,
  SlotChestCooldownConfig,
  SlotLevelTimerGroup,
} from "../../../shared/types";
import { IPC } from "../../../shared/ipc";
import { broadcast } from "./broadcast";
import { createLogger } from "../log";

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
  slotDroppedAtMs?: Record<string, number>;
  slotCooldownSecondsByKind?: Record<string, number>;
}

export class BoxTimerService {
  private readonly catalogFile = loadStageBoxCatalogFile();
  private readonly routes = loadStageBoxTrackerRoutes();
  private readonly routeById = trackerRoutesById(this.routes);
  private readonly boxById = new Map(buildStageBoxCatalog().items.map((b) => [b.id, b]));
  private readonly routeBoxIds: number[];
  private timers = new Map<number, number>();
  private slotTimers = new Map<string, number>();
  private slotCooldownSecondsByKind = new Map<SlotChestKind, number>();
  private enabledBoxIds = new Set<number>();
  private cooldownSecondsByBoxId = new Map<number, number>();
  private clearTimeSecondsByBoxId = new Map<number, number>();
  private idealStageKeyByBoxId = new Map<number, number>();
  private notifyWhenReadyByBoxId = new Map<number, boolean>();
  private sortOrder: BoxTrackerSortOrder = "cooldown-first";
  private tickTimer: NodeJS.Timeout | null = null;
  private subscribers = 0;
  private currentStageKey = 0;
  private lastCommonChestQty: number | null = null;
  private lastRareChestQty: number | null = null;
  private lastHeldCommonBoxCount: number | null = null;
  private lastInventoryBoxCount = new Map<number, number>();
  private inventoryBaselineSeeded = false;
  private playerLogPath = "";
  private playerLogAvailable = false;

  constructor() {
    this.routeBoxIds = [...this.routeById.keys()].sort(
      (a, b) => (this.boxById.get(a)?.level ?? 0) - (this.boxById.get(b)?.level ?? 0) || a - b,
    );
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
    if (!this.isEnabledRoute(boxId)) return this.buildState();
    return this.buildState();
  }

  /** Start cooldown when Player.log reports a tracked stage boss box drop. */
  tryMarkDroppedFromLog(itemKey: number): boolean {
    let marked = false;
    const slot = slotChestKindFromItemKey(itemKey, this.catalogFile);
    const chestLevel = stageBoxLevelFromItemKey(itemKey, this.catalogFile);
    if (slot && chestLevel != null) {
      if (this.markSlotDropped(slot, chestLevel, `Player.log ItemKey ${itemKey}`)) {
        marked = true;
      }
    }

    const boxId = resolveTrackedDropBoxId(
      itemKey,
      this.enabledBoxIds,
      (id) => this.routeById.has(id),
      this.catalogFile,
    );
    if (boxId == null) {
      this.logIgnoredLogDrop(itemKey);
    }
    return marked;
  }

  /**
   * Fallback when Player.log is buffered: rare boss chest slot count rose on a
   * stage that drops a tracked level (save poll, ~5s).
   */
  tryMarkDroppedFromSave(chests: ChestHolding[], stageKey = this.currentStageKey): boolean {
    const commonQty = commonChestQuantity(chests);
    const rareQty = rareBossChestQuantity(chests);
    let marked = false;

    const bossLevel = bossLevelForStageKey(stageKey, this.routes);

    if (this.lastCommonChestQty !== null && commonQty > this.lastCommonChestQty && bossLevel != null) {
      if (
        this.markSlotDropped(
          "common",
          bossLevel,
          `save common slot ${this.lastCommonChestQty}→${commonQty} @ ${stageName(stageKey)}`,
        )
      ) {
        marked = true;
      }
    }
    this.lastCommonChestQty = commonQty;

    if (this.lastRareChestQty === null) {
      this.lastRareChestQty = rareQty;
      return marked;
    }

    const prevRare = this.lastRareChestQty;
    this.lastRareChestQty = rareQty;
    if (rareQty <= prevRare) return marked;

    if (bossLevel != null && this.markSlotDropped("stageBoss", bossLevel, `save blue slot ${prevRare}→${rareQty} @ ${stageName(stageKey)}`)) {
      marked = true;
    }

    return marked;
  }

  /** Detect new rare stage-box instances in itemSaveDatas (opened or listed items). */
  tryMarkDroppedFromInventory(items: readonly { itemKey: number }[]): boolean {
    const commonHeld = totalHeldCommonStageBoxes(items, this.catalogFile);
    let marked = false;

    if (this.lastHeldCommonBoxCount !== null && commonHeld > this.lastHeldCommonBoxCount) {
      const bossLevel = bossLevelForStageKey(this.currentStageKey, this.routes);
      if (bossLevel != null) {
        if (
          this.markSlotDropped(
            "common",
            bossLevel,
            `save inventory common count ${this.lastHeldCommonBoxCount}→${commonHeld}`,
          )
        ) {
          marked = true;
        }
      }
    }
    this.lastHeldCommonBoxCount = commonHeld;

    const counts = countHeldRareStageBoxes(items, this.catalogFile);

    if (!this.inventoryBaselineSeeded) {
      for (const boxId of this.routeBoxIds) {
        this.lastInventoryBoxCount.set(boxId, counts.get(boxId) ?? 0);
      }
      this.inventoryBaselineSeeded = true;
      return marked;
    }

    for (const boxId of this.routeBoxIds) {
      if (!this.enabledBoxIds.has(boxId)) continue;
      const prev = this.lastInventoryBoxCount.get(boxId) ?? 0;
      const count = counts.get(boxId) ?? 0;
      if (count > prev) {
        const level = this.boxById.get(boxId)?.level;
        if (level != null) {
          if (
            this.markSlotDropped(
              "stageBoss",
              level,
              `save inventory rare+ @ Lv${level}`,
            )
          ) {
            marked = true;
          }
        }
      }
      this.lastInventoryBoxCount.set(boxId, count);
    }
    return marked;
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
    return this.commitState();
  }

  markSlotDropped(slot: SlotChestKind, level: number, source?: string): boolean {
    if (!SLOT_CHEST_KINDS.includes(slot) || level <= 0) return false;
    if (!this.isSlotLevelTracked(level)) {
      log.info(`Slot ${slot} Lv${level} ignored — enable Lv${level} in tracker chips`);
      return false;
    }
    const key = slotTimerStorageKey(slot, level);
    log.info(
      `Slot chest drop (${SLOT_CHEST_SHORT_LABELS[slot]} Lv${level}${source ? `, ${source}` : ""})`,
    );
    this.slotTimers.set(key, Date.now());
    this.commitState();
    return true;
  }

  clearSlotTimer(slot: SlotChestKind, level: number): BoxTimerState {
    if (level > 0) this.slotTimers.delete(slotTimerStorageKey(slot, level));
    return this.commitState();
  }

  setSlotCooldownSeconds(slot: SlotChestKind, cooldownSeconds: number): BoxTimerState {
    if (!SLOT_CHEST_KINDS.includes(slot)) return this.buildState();
    const seconds = Math.max(60, Math.min(86_400, Math.round(cooldownSeconds)));
    if (seconds === SLOT_CHEST_DEFAULT_COOLDOWN_SECONDS[slot]) {
      this.slotCooldownSecondsByKind.delete(slot);
    } else {
      this.slotCooldownSecondsByKind.set(slot, seconds);
    }
    return this.commitState();
  }

  clearSlotCooldownOverride(slot: SlotChestKind): BoxTimerState {
    if (!SLOT_CHEST_KINDS.includes(slot)) return this.buildState();
    this.slotCooldownSecondsByKind.delete(slot);
    return this.commitState();
  }

  private resolveSlotCooldownSeconds(slot: SlotChestKind): number {
    return (
      this.slotCooldownSecondsByKind.get(slot) ?? SLOT_CHEST_DEFAULT_COOLDOWN_SECONDS[slot]
    );
  }

  private buildSlotCooldownConfig(): SlotChestCooldownConfig {
    return {
      commonSeconds: this.resolveSlotCooldownSeconds("common"),
      stageBossSeconds: this.resolveSlotCooldownSeconds("stageBoss"),
      commonIsCustom: this.slotCooldownSecondsByKind.has("common"),
      stageBossIsCustom: this.slotCooldownSecondsByKind.has("stageBoss"),
      defaultCommonSeconds: SLOT_CHEST_DEFAULT_COOLDOWN_SECONDS.common,
      defaultStageBossSeconds: SLOT_CHEST_DEFAULT_COOLDOWN_SECONDS.stageBoss,
    };
  }

  private isSlotLevelTracked(level: number): boolean {
    return slotLevelsForEnabledRoutes(this.enabledBoxIds, this.routes).includes(level);
  }

  private pruneExpiredSlotTimers(now: number): void {
    for (const storageKey of [...this.slotTimers.keys()]) {
      const parsed = parseSlotTimerStorageKey(storageKey);
      if (!parsed) {
        this.slotTimers.delete(storageKey);
        continue;
      }
      const droppedAt = this.slotTimers.get(storageKey);
      if (droppedAt === undefined) continue;
      const elapsed = (now - droppedAt) / 1000;
      if (elapsed >= this.resolveSlotCooldownSeconds(parsed.slot)) {
        this.slotTimers.delete(storageKey);
      }
    }
  }

  private visibleSlotLevels(): number[] {
    const levels = new Set(slotLevelsForEnabledRoutes(this.enabledBoxIds, this.routes));
    for (const storageKey of this.slotTimers.keys()) {
      const parsed = parseSlotTimerStorageKey(storageKey);
      if (parsed) levels.add(parsed.level);
    }
    return [...levels].sort((a, b) => a - b);
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
    this.slotTimers.clear();
    this.slotCooldownSecondsByKind.clear();
    this.enabledBoxIds.clear();
    this.cooldownSecondsByBoxId.clear();
    this.clearTimeSecondsByBoxId.clear();
    this.idealStageKeyByBoxId.clear();
    this.notifyWhenReadyByBoxId.clear();
    this.sortOrder = "cooldown-first";
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

  private buildSlotRow(slot: SlotChestKind, level: number, now: number): SlotChestTimerRow {
    const cooldownSeconds = this.resolveSlotCooldownSeconds(slot);
    const storageKey = slotTimerStorageKey(slot, level);
    const droppedAt = this.slotTimers.get(storageKey);
    const meta = trackerMetaForChestLevel(level, this.catalogFile);
    const dropStageRangeLabel = meta?.dropStageRangeLabel ?? "—";
    let remainingSeconds = 0;
    let active = false;
    let progress = 0;

    if (droppedAt !== undefined) {
      const elapsed = (now - droppedAt) / 1000;
      remainingSeconds = Math.max(0, Math.ceil(cooldownSeconds - elapsed));
      active = remainingSeconds > 0;
      progress = cooldownSeconds > 0 ? Math.min(1, elapsed / cooldownSeconds) : 1;
      if (!active) {
        this.slotTimers.delete(storageKey);
        this.persist();
      }
    }

    return {
      slot,
      level,
      label: `${SLOT_CHEST_SHORT_LABELS[slot]} Lv${level}`,
      dropStageRangeLabel,
      cooldownSeconds,
      cooldownIsCustom: this.slotCooldownSecondsByKind.has(slot),
      active,
      remainingSeconds,
      progress,
      status: active ? "cooldown" : "ready",
    };
  }

  private buildSlotLevelGroups(now: number): SlotLevelTimerGroup[] {
    this.pruneExpiredSlotTimers(now);
    return this.visibleSlotLevels().map((level) => {
      const meta = trackerMetaForChestLevel(level, this.catalogFile);
      return {
        level,
        commonBoxId: commonBoxIdForLevel(level, this.catalogFile) ?? 0,
        rareBoxId: rareBoxIdForLevel(level, this.catalogFile) ?? 0,
        dropStageRangeLabel: meta?.dropStageRangeLabel ?? "—",
        common: this.buildSlotRow("common", level, now),
        stageBoss: this.buildSlotRow("stageBoss", level, now),
      };
    });
  }

  private buildState(): BoxTimerState {
    const now = Date.now();
    const slotLevelGroups = this.buildSlotLevelGroups(now);
    const slotRows = slotLevelGroups.flatMap((group) => [group.common, group.stageBoss]);
    const readyCount = slotRows.filter((r) => r.status === "ready").length;
    const cooldownCount = slotRows.filter((r) => r.status === "cooldown").length;

    return {
      rows: [],
      slotRows,
      slotLevelGroups,
      slotCooldown: this.buildSlotCooldownConfig(),
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
      for (const [storageKey, droppedAtMs] of Object.entries(raw.slotDroppedAtMs ?? {})) {
        if (droppedAtMs <= 0) continue;
        const parsed = parseSlotTimerStorageKey(storageKey);
        if (!parsed) continue;
        let level = parsed.level;
        if (level > 1000) {
          const migrated = bossLevelForStageKey(level, this.routes);
          if (migrated == null) continue;
          level = migrated;
        }
        this.slotTimers.set(slotTimerStorageKey(parsed.slot, level), droppedAtMs);
      }
      for (const [slot, seconds] of Object.entries(raw.slotCooldownSecondsByKind ?? {})) {
        if (!SLOT_CHEST_KINDS.includes(slot as SlotChestKind)) continue;
        const value = Number(seconds);
        if (value >= 60 && value <= 86_400) {
          this.slotCooldownSecondsByKind.set(slot as SlotChestKind, Math.round(value));
        }
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
  }

  private persist(): void {
    const path = this.persistPath();
    mkdirSync(dirname(path), { recursive: true });
    const timers: PersistedTimer[] = [];
    const cooldownSecondsByBoxId = Object.fromEntries(this.cooldownSecondsByBoxId);
    const clearTimeSecondsByBoxId = Object.fromEntries(
      [...this.clearTimeSecondsByBoxId.entries()].filter(([, seconds]) => seconds > 0),
    );
    const idealStageKeyByBoxId = Object.fromEntries(this.idealStageKeyByBoxId);
    const notifyWhenReadyByBoxId = Object.fromEntries(
      [...this.notifyWhenReadyByBoxId.entries()].filter(([, enabled]) => !enabled),
    );
    const slotDroppedAtMs = Object.fromEntries(
      [...this.slotTimers.entries()].filter(([, droppedAtMs]) => droppedAtMs > 0),
    );
    const slotCooldownSecondsByKind = Object.fromEntries(this.slotCooldownSecondsByKind);
    writeFileSync(
      path,
      JSON.stringify(
        {
          timers,
          slotDroppedAtMs,
          slotCooldownSecondsByKind,
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
