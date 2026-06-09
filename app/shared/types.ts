// Types shared across the Electron main, preload, and renderer processes.

export interface HeroSnapshot {
  key: string;
  level: number;
  exp: number;
  unlocked: boolean;
}

export interface SaveSnapshot {
  heroes: HeroSnapshot[];
  totalHeroExp: number;
  cubeLevel: number;
  cubeExp: number;
  playTime: number;
  saveMtime: number; // epoch seconds (file mtime)
  stageKey: number;
  stageWave: number;
  maxStage: number;
  gold: number;
}

export interface HistoryEntry {
  wallTime: number; // epoch seconds when read
  delta: number; // XP gained on this read
  rate: number; // rolling XP/hour at this point
  totalXp: number;
  stageKey: number;
  stageWave: number;
}

export interface HeroRate {
  key: string;
  name: string;
  level: number;
  rate: number; // rolling XP/hour for this hero
}

// Live payload pushed from main to the renderer.
export interface Stats {
  connected: boolean;
  status: string;
  rollingRate: number; // XP/hour
  sessionRate: number; // XP/hour
  goldRate: number; // gold/hour (earned)
  cumulativeGained: number; // XP gained this session
  goldGained: number; // gold earned this session
  elapsed: number; // seconds since session start
  secondsSinceGain: number | null;
  secondsSinceRead: number | null;
  stageKey: number;
  stageWave: number;
  heroes: HeroRate[];
  history: HistoryEntry[];
}

export interface GameDataStatus {
  loaded: boolean;
  count: number;
  fetchedUtc: string | null;
  source: "cache" | "bundled" | "none";
  stale: boolean;
}

export interface GameDataRefreshResult {
  ok: boolean;
  count?: number;
  error?: string;
  status: GameDataStatus;
}

// --- Inventory ---

// Raw owned-item instance from itemSaveDatas (the master list of all owned
// items: inventory + stash + trading + equipped).
export type ItemLocation = "inventory" | "stash" | "trading" | "equipped" | "unknown";

export interface InventoryItemInstance {
  itemKey: number;
  isChaotic: boolean;
  inUse: boolean;
  location: ItemLocation;
}

export interface ChestHolding {
  type: number;
  quantity: number;
}

export interface InventorySnapshot {
  items: InventoryItemInstance[];
  chests: ChestHolding[];
  saveMtime: number;
  /** Stack counts from aggregateSaveDatas when decoded (materials only). */
  materialStacks?: Map<number, number>;
}

// Owned items grouped by ItemKey and resolved against the game catalog.
export interface ResolvedInventoryRow {
  itemKey: number;
  name: string; // "Unknown #<key>" when not in the catalog
  grade: string;
  type: string; // GEAR | MATERIAL | ...
  level: number | null;
  marketTradable: boolean;
  marketHashName: string | null;
  count: number;
  inUseCount: number;
  chaoticCount: number;
  known: boolean;
  priceRaw: string | null;
  unitPrice: number | null;
  priceSource: "median" | "lowest" | null;
  value: number | null;
  inventoryCount: number;
  stashCount: number;
  tradingCount: number;
}

export interface InventoryPriceInfo {
  median: number | null;
  lowest: number | null;
  rawMedian: string | null;
  rawLowest: string | null;
}

export interface InventoryComposition {
  total: number;
  byGrade: Record<string, number>;
  byType: Record<string, number>;
  tradableCount: number;
  unknownCount: number;
  chaoticCount: number;
  inUseCount: number;
  priceableCount: number;
  valuedTotal: number;
  currency: string | null;
}

export interface ResolvedInventory {
  rows: ResolvedInventoryRow[];
  composition: InventoryComposition;
  chests: ChestHolding[];
  saveMtime: number;
  gameDataLoaded: boolean;
  currency: string | null;
}

export interface PriceStatus {
  currency: string;
  count: number;
  fetchedUtc: string | null;
  running: boolean;
}

export interface PriceProgress {
  done: number;
  total: number;
  current: string;
  priced: number;
  failed: number;
}

export interface PriceRefreshResult {
  ok: boolean;
  priced: number;
  skipped: number;
  failed: number;
  stopped: "completed" | "cancelled" | "rate-limited";
  currency: string;
  error?: string;
}

export interface AppConfig {
  savePath: string;
  es3Password: string;
  pollIntervalSeconds: number;
  rollingWindowMinutes: number;
  trackCubeExp: boolean;
  startTopmost: boolean;
  logHistoryCsv: boolean;
  currency: string;
  /** Manual +N common chest slots when rune decode/catalog is incomplete. */
  extraCommonBoxSlots: number;
}

// --- Chests (BoxData holdings) ---

export interface ResolvedChestRow {
  boxType: number;
  label: string;
  category: string;
  quantity: number;
}

export interface CommonBoxStatus {
  quantity: number;
  capacity: number;
  isFull: boolean;
  slotsRemaining: number;
}

export interface ChestState {
  rows: ResolvedChestRow[];
  common: CommonBoxStatus;
  totalHeld: number;
  saveMtime: number;
  runeBonusSlots: number;
}

// --- Box tracker (manual rare boss box timers) ---

export interface BoxTimerRow {
  boxId: number;
  name: string;
  level: number | null;
  idealStageKey: number;
  idealStageLabel: string;
  cooldownSeconds: number;
  active: boolean;
  remainingSeconds: number;
  progress: number;
}

export interface BoxTimerState {
  rows: BoxTimerRow[];
  currentStageKey: number;
  disclaimer?: string;
}

// API surface exposed on `window.tbh` by the preload via contextBridge.
export interface TbhApi {
  onStats(cb: (stats: Stats) => void): () => void;
  reset(): void;
  getStats(): Promise<Stats | null>;
  openOverlay(): void;
  showMain(): void;
  closeOverlay(): void;
  gameDataStatus(): Promise<GameDataStatus>;
  refreshGameData(): Promise<GameDataRefreshResult>;
  getInventory(): Promise<ResolvedInventory | null>;
  onInventory(cb: (inv: ResolvedInventory) => void): () => void;
  pricesStatus(): Promise<PriceStatus>;
  refreshPrices(force?: boolean): Promise<PriceRefreshResult & { status: PriceStatus }>;
  cancelPrices(): void;
  setCurrency(iso: string): Promise<PriceStatus>;
  onPricesProgress(cb: (p: PriceProgress) => void): () => void;
  getConfig(): Promise<AppConfig>;
  saveConfig(patch: Partial<AppConfig>): Promise<AppConfig>;
  getChests(): Promise<ChestState | null>;
  onChests(cb: (state: ChestState) => void): () => void;
  openBoxTracker(): void;
  closeBoxTracker(): void;
  getBoxTimers(): Promise<BoxTimerState>;
  onBoxTimers(cb: (state: BoxTimerState) => void): () => void;
  markBoxDropped(boxId: number): Promise<BoxTimerState>;
  clearBoxTimer(boxId: number): Promise<BoxTimerState>;
}
