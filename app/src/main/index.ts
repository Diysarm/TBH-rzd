import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { loadConfig, expandPath, type Config } from "./config";
import { SaveWatcher } from "./saveWatcher";
import { buildStats } from "./stats";
import { makeHistoryLogger } from "./historyLog";
import { XpTracker } from "../core/tracker";
import type { SaveSnapshot } from "../../shared/types";

const isDev = !!process.env.ELECTRON_RENDERER_URL;

let config: Config;
let tracker: XpTracker;
let watcher: SaveWatcher | null = null;
let lastSnap: SaveSnapshot | null = null;
let lastError: string | null = null;
let tickTimer: NodeJS.Timeout | null = null;

function pushStats(): void {
  const stats = buildStats(tracker, lastSnap, lastError);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("stats", stats);
  }
}

function startTracking(): void {
  config = loadConfig();
  tracker = new XpTracker(config.rollingWindowMinutes * 60, config.trackCubeExp);
  if (config.logHistoryCsv) {
    tracker.onHistory = makeHistoryLogger();
  }

  watcher = new SaveWatcher({
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
  });
  watcher.start();

  // Push every second so time-based fields (elapsed, "last updated") tick even
  // when the save itself hasn't changed.
  tickTimer = setInterval(pushStats, 1000);
}

function registerIpc(): void {
  ipcMain.handle("get-stats", () => buildStats(tracker, lastSnap, lastError));
  ipcMain.on("reset", () => {
    tracker.reset();
    pushStats();
  });
}

function createMainWindow(): void {
  const win = new BrowserWindow({
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

  win.on("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL as string);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

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
