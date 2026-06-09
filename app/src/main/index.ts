import { app, BrowserWindow, ipcMain, shell } from "electron";

import { join } from "node:path";

import { loadConfig, saveConfig, expandPath, type Config } from "./config";

import { SaveWatcher } from "./saveWatcher";

import { buildStats } from "./stats";

import { makeHistoryLogger } from "./historyLog";

import { GameDataProvider } from "./gameDataProvider";

import { SteamMarketProvider } from "./steamMarketProvider";

import { XpTracker } from "../core/tracker";

import { resolveInventory, ownedMarketNames } from "../core/inventory";

import type {
  SaveSnapshot,
  InventorySnapshot,
  ResolvedInventory,
  InventoryPriceInfo,
  PriceProgress,
  AppConfig,
} from "../../shared/types";



const isDev = !!process.env.ELECTRON_RENDERER_URL;



let config: Config;

let tracker: XpTracker;

const gameData = new GameDataProvider();

let market: SteamMarketProvider;

let watcher: SaveWatcher | null = null;

let lastSnap: SaveSnapshot | null = null;

let lastInventoryRaw: InventorySnapshot | null = null;

let lastInventory: ResolvedInventory | null = null;

let lastError: string | null = null;

let tickTimer: NodeJS.Timeout | null = null;

let mainWindow: BrowserWindow | null = null;

let overlayWindow: BrowserWindow | null = null;

let priceRefreshQueued = false;



function rendererTarget(hash: string): { url?: string; file: string; hash: string } {

  return {

    url: isDev ? `${process.env.ELECTRON_RENDERER_URL}#${hash}` : undefined,

    file: join(__dirname, "../renderer/index.html"),

    hash,

  };

}



function pushStats(): void {

  const stats = buildStats(tracker, lastSnap, lastError);

  for (const win of BrowserWindow.getAllWindows()) {

    if (!win.isDestroyed()) win.webContents.send("stats", stats);

  }

}



function priceLookup(name: string): InventoryPriceInfo | undefined {

  const e = market?.get(name);

  if (!e) return undefined;

  return {
    median: e.median,
    lowest: e.lowest,
    rawMedian: e.rawMedian ?? null,
    rawLowest: e.rawLowest ?? (e as { raw?: string | null }).raw ?? null,
  };
}



function resolveAndPushInventory(): void {
  if (!lastInventoryRaw || !market) return;
  try {
    const status = gameData.status();
    const currency = market.status().currency;
    lastInventory = resolveInventory(
      lastInventoryRaw,
      (key) => gameData.get(key),
      status.loaded,
      priceLookup,
    );
    lastInventory.currency = currency;
    lastInventory.composition.currency = currency;
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send("inventory", lastInventory);
    }
  } catch (err) {
    console.error("resolveAndPushInventory failed:", err);
  }
}



function onInventory(snap: InventorySnapshot): void {

  lastInventoryRaw = snap;

  resolveAndPushInventory();

  void ensureOwnedPrices();

}



function broadcastPriceProgress(p: PriceProgress): void {

  for (const win of BrowserWindow.getAllWindows()) {

    if (!win.isDestroyed()) win.webContents.send("prices-progress", p);

  }

}



/** Background refresh for owned, priceable items; keeps going through 429 backoff. */

async function ensureOwnedPrices(force = false): Promise<void> {

  if (!lastInventoryRaw || !market) return;

  if (market.status().running) {

    priceRefreshQueued = true;

    return;

  }

  const names = ownedMarketNames(
    lastInventoryRaw,
    (key) => gameData.get(key),
  );

  const pending = market.pendingNames(names, force);

  if (pending.length === 0) return;



  await market.refresh(names, {

    force,

    onProgress: broadcastPriceProgress,

    onPriced: () => resolveAndPushInventory(),

  });

  resolveAndPushInventory();



  if (priceRefreshQueued) {

    priceRefreshQueued = false;

    void ensureOwnedPrices();

  }

}



function configForRenderer(): AppConfig {
  return { ...config };
}

function createWatcher(): SaveWatcher {
  return new SaveWatcher({
    path: expandPath(config.savePath),
    password: config.es3Password,
    pollMs: Math.max(1, config.pollIntervalSeconds) * 1000,
    onSnapshot: (snap) => {
      lastSnap = snap;
      lastError = null;
      tracker.update(snap);
      pushStats();
    },
    onError: (message) => {
      lastError = message;
      pushStats();
    },
    onInventory,
  });
}

function restartWatcher(): void {
  watcher?.stop();
  watcher = createWatcher();
  watcher.start();
}

function startTracking(): void {
  config = loadConfig();
  market = new SteamMarketProvider(config.currency);
  tracker = new XpTracker(config.rollingWindowMinutes * 60, config.trackCubeExp);
  if (config.logHistoryCsv) {
    tracker.onHistory = makeHistoryLogger();
  }

  watcher = createWatcher();
  watcher.start();

  tickTimer = setInterval(pushStats, 1000);

  gameData.load();
  gameData.refreshIfStale();
}



function registerIpc(): void {

  ipcMain.handle("get-stats", () => buildStats(tracker, lastSnap, lastError));

  ipcMain.on("reset", () => {

    tracker.reset();

    pushStats();

  });

  ipcMain.on("open-overlay", () => {

    createOverlayWindow();

    mainWindow?.hide();

  });

  ipcMain.on("show-main", () => {

    createMainWindow();

    mainWindow?.show();

    overlayWindow?.close();

  });

  ipcMain.on("close-overlay", () => overlayWindow?.close());



  ipcMain.handle("get-inventory", () => lastInventory);



  ipcMain.handle("gamedata-status", () => gameData.status());

  ipcMain.handle("gamedata-refresh", async () => {

    const result = await gameData.refresh();

    if (result.ok) resolveAndPushInventory();

    return { ...result, status: gameData.status() };

  });



  ipcMain.handle("prices-status", () => market.status());

  ipcMain.handle("prices-refresh", async (_e, force?: boolean) => {

    const result = await market.refresh(

      lastInventoryRaw
        ? ownedMarketNames(lastInventoryRaw, (key) => gameData.get(key))
        : undefined,

      {

        force: Boolean(force),

        onProgress: broadcastPriceProgress,

        onPriced: () => resolveAndPushInventory(),

      },

    );

    resolveAndPushInventory();

    return { ...result, status: market.status() };

  });

  ipcMain.on("prices-cancel", () => market.cancel());

  ipcMain.handle("set-currency", (_e, iso: string) => {
    config.currency = iso;
    saveConfig(config);
    market.setCurrency(iso);
    resolveAndPushInventory();
    void ensureOwnedPrices(true);
    return market.status();
  });

  ipcMain.handle("get-config", () => configForRenderer());

  ipcMain.handle("save-config", (_e, patch: Partial<AppConfig>) => {
    const needsWatcher =
      patch.savePath !== undefined ||
      patch.pollIntervalSeconds !== undefined ||
      patch.es3Password !== undefined;
    const needsTracker =
      patch.rollingWindowMinutes !== undefined || patch.trackCubeExp !== undefined;

    config = { ...config, ...patch };
    saveConfig(config);

    if (patch.currency !== undefined) {
      market.setCurrency(config.currency);
      resolveAndPushInventory();
    }
    if (needsTracker) {
      tracker = new XpTracker(config.rollingWindowMinutes * 60, config.trackCubeExp);
      if (config.logHistoryCsv) tracker.onHistory = makeHistoryLogger();
    }
    if (needsWatcher) restartWatcher();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(config.startTopmost);
    }
    pushStats();
    resolveAndPushInventory();
    return configForRenderer();
  });
}



function loadInto(win: BrowserWindow, hash: string): void {

  const t = rendererTarget(hash);

  if (t.url) {

    win.loadURL(t.url);

  } else {

    win.loadFile(t.file, { hash: t.hash });

  }

}



function createMainWindow(): void {

  if (mainWindow && !mainWindow.isDestroyed()) {

    mainWindow.show();

    return;

  }

  mainWindow = new BrowserWindow({

    width: 900,

    height: 640,

    minWidth: 420,

    minHeight: 480,

    show: false,

    backgroundColor: "#0f1117",

    autoHideMenuBar: true,

    webPreferences: {

      preload: join(__dirname, "../preload/index.js"),

      sandbox: false,

    },

  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.setAlwaysOnTop(config.startTopmost);
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {

    mainWindow = null;

  });

  loadInto(mainWindow, "main");

}



function createOverlayWindow(): void {

  if (overlayWindow && !overlayWindow.isDestroyed()) {

    overlayWindow.show();

    overlayWindow.focus();

    return;

  }

  overlayWindow = new BrowserWindow({

    width: 280,

    height: 200,

    show: false,

    frame: false,

    resizable: false,

    alwaysOnTop: true,

    skipTaskbar: true,

    backgroundColor: "#0f1117",

    webPreferences: {

      preload: join(__dirname, "../preload/index.js"),

      sandbox: false,

    },

  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");

  overlayWindow.on("ready-to-show", () => overlayWindow?.show());

  overlayWindow.on("closed", () => {

    overlayWindow = null;

  });

  loadInto(overlayWindow, "overlay");

}



/** Open http(s) links in the system browser, not a blank Electron tab. */
function attachExternalLinkHandlers(contents: Electron.WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
}



app.on("web-contents-created", (_event, contents) => {
  attachExternalLinkHandlers(contents);
});



app.whenReady().then(() => {

  registerIpc();

  startTracking();

  createMainWindow();

  app.on("activate", () => {

    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();

  });

});



app.on("window-all-closed", () => {

  if (tickTimer) clearInterval(tickTimer);

  watcher?.stop();

  if (process.platform !== "darwin") app.quit();

});


