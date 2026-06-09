import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { GameDataStatus } from "../../shared/types";
import {
  extractAndEnrichItemsFromHtml,
  fetchItemFromDetailPage,
  indexById,
  catalogHasGearLevels,
  normalizeGameItem,
  type GameData,
  type GameItem,
} from "../core/gamedata";

const SOURCE_URL = "https://tbh.city/items";
const DISCOVERED_SOURCE = "https://tbh.city/items/{id}";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // a week

export class GameDataProvider {
  private data: GameData | null = null;
  private index = new Map<number, GameItem>();
  /** ItemKeys resolved from tbh.city detail pages (not in the bulk list). */
  private discovered = new Map<number, GameItem>();
  private source: "cache" | "bundled" | "none" = "none";

  private cachePath(): string {
    try {
      return join(app.getPath("userData"), "gamedata.json");
    } catch {
      return join(process.cwd(), "gamedata.cache.json");
    }
  }

  private discoveredPath(): string {
    try {
      return join(app.getPath("userData"), "discovered_items.json");
    } catch {
      return join(process.cwd(), "discovered_items.cache.json");
    }
  }

  private levelCachePath(): string {
    try {
      return join(app.getPath("userData"), "gear_levels.json");
    } catch {
      return join(process.cwd(), "gear_levels.cache.json");
    }
  }

  private bundledPath(): string {
    const candidates = [
      join(process.resourcesPath ?? "", "data", "gamedata.json"),
      join(process.cwd(), "..", "data", "gamedata.json"),
      join(process.cwd(), "data", "gamedata.json"),
    ];
    return candidates.find((p) => existsSync(p)) ?? candidates[candidates.length - 1];
  }

  private loadLevelCache(): Map<string, number> {
    const path = this.levelCachePath();
    if (!existsSync(path)) return new Map();
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8").replace(/^\uFEFF/, "")) as {
        levels?: Record<string, number>;
      };
      return new Map(Object.entries(raw.levels ?? {}));
    } catch {
      return new Map();
    }
  }

  private saveLevelCache(levels: ReadonlyMap<string, number>): void {
    const path = this.levelCachePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ levels: Object.fromEntries(levels) }));
  }

  private loadDiscoveredCache(): void {
    const path = this.discoveredPath();
    if (!existsSync(path)) return;
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8").replace(/^\uFEFF/, "")) as {
        items?: unknown[];
      };
      if (!Array.isArray(raw.items)) return;
      for (const row of raw.items) {
        const item = normalizeGameItem(row as Record<string, unknown>);
        if (item) this.discovered.set(item.id, item);
      }
    } catch {
      // ignore corrupt cache
    }
  }

  private saveDiscoveredCache(): void {
    const path = this.discoveredPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        source: DISCOVERED_SOURCE,
        fetchedUtc: new Date().toISOString(),
        items: [...this.discovered.values()],
      }),
    );
  }

  /** Load the best available snapshot. Safe to call once at startup. */
  load(): void {
    const cache = this.cachePath();
    const bundled = this.bundledPath();

    if (existsSync(cache) && this.tryLoad(cache)) {
      this.source = "cache";
      if (!catalogHasGearLevels(this.index.values()) && this.tryLoadBundledLevelsOverlay(bundled)) {
        this.loadDiscoveredCache();
        return;
      }
      this.loadDiscoveredCache();
      return;
    }
    if (existsSync(bundled) && this.tryLoad(bundled)) {
      this.source = "bundled";
      this.loadDiscoveredCache();
      return;
    }
    this.source = "none";
    this.loadDiscoveredCache();
  }

  overlayMissingLevelsFromBundled(): boolean {
    if (catalogHasGearLevels(this.index.values())) return false;
    return this.tryLoadBundledLevelsOverlay(this.bundledPath());
  }

  private tryLoadBundledLevelsOverlay(bundledPath: string): boolean {
    if (!existsSync(bundledPath)) return false;
    try {
      const raw = readFileSync(bundledPath, "utf-8").replace(/^\uFEFF/, "");
      const d = JSON.parse(raw) as { items?: unknown[] };
      if (!Array.isArray(d.items)) return false;

      let patched = 0;
      for (const row of d.items) {
        const bundled = normalizeGameItem(row as Record<string, unknown>);
        if (!bundled || bundled.level == null) continue;
        const existing = this.index.get(bundled.id);
        if (existing && existing.level == null) {
          existing.level = bundled.level;
          patched++;
        }
      }
      if (patched > 0 && this.data) {
        this.data.items = [...this.index.values()];
      }
      return patched > 0;
    } catch {
      return false;
    }
  }

  private tryLoad(path: string): boolean {
    try {
      const raw = readFileSync(path, "utf-8").replace(/^\uFEFF/, "");
      const d = JSON.parse(raw) as {
        source?: string;
        fetchedUtc?: string;
        count?: number;
        items?: unknown[];
      };
      if (!Array.isArray(d.items)) return false;
      const items = d.items
        .map((row) => normalizeGameItem(row as Record<string, unknown>))
        .filter((item): item is GameItem => item != null);
      this.data = {
        source: d.source ?? "",
        fetchedUtc: d.fetchedUtc ?? "",
        items,
        count: items.length,
      };
      this.index = indexById(items);
      return true;
    } catch {
      return false;
    }
  }

  get(itemKey: number): GameItem | undefined {
    return this.index.get(itemKey) ?? this.discovered.get(itemKey);
  }

  /** Fetch tbh.city detail pages for ItemKeys missing from the main catalog. */
  async discoverMissingItems(itemKeys: Iterable<number>): Promise<number> {
    const pending = [...new Set(itemKeys)].filter((id) => id > 0 && !this.get(id));
    if (pending.length === 0) return 0;

    let added = 0;
    for (const id of pending) {
      const item = await fetchItemFromDetailPage(id);
      if (item) {
        this.discovered.set(id, item);
        added++;
      }
    }
    if (added > 0) this.saveDiscoveredCache();
    return added;
  }

  status(): GameDataStatus {
    return {
      loaded: this.data !== null,
      count: (this.data?.count ?? 0) + this.discovered.size,
      fetchedUtc: this.data?.fetchedUtc ?? null,
      source: this.source,
      stale: this.isStale(),
    };
  }

  isStale(): boolean {
    if (!this.data?.fetchedUtc) return true;
    const ts = Date.parse(this.data.fetchedUtc);
    if (Number.isNaN(ts)) return true;
    return Date.now() - ts > REFRESH_TTL_MS;
  }

  async refresh(): Promise<{ ok: boolean; count?: number; error?: string }> {
    try {
      const res = await fetch(SOURCE_URL, {
        headers: { "User-Agent": "Mozilla/5.0 (TBH Companion)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const existingLevels = this.loadLevelCache();
      const { items, levelsByTemplate } = await extractAndEnrichItemsFromHtml(html, existingLevels);
      if (items.length === 0) throw new Error("no items extracted");

      const data: GameData = {
        source: SOURCE_URL,
        fetchedUtc: new Date().toISOString(),
        count: items.length,
        items,
      };
      const cache = this.cachePath();
      mkdirSync(dirname(cache), { recursive: true });
      writeFileSync(cache, JSON.stringify(data));
      this.saveLevelCache(levelsByTemplate);
      this.data = data;
      this.index = indexById(items);
      this.source = "cache";
      return { ok: true, count: items.length };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  refreshIfStale(onComplete?: () => void): void {
    if (this.isStale()) {
      void this.refresh().then((result) => {
        if (result.ok) onComplete?.();
      });
    }
  }
}
