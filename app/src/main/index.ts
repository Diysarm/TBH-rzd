import { app } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { attachExternalLinkHandlers } from "./app/lifecycle";
import { createLogger, initDiagnosticLog } from "./log";
import { getAppServices, restoreSessionWindows, startTracking, stopTracking } from "./app/appState";
import { registerIpc } from "./ipc/registerIpc";
import { createTray, destroyTray, isAppQuitting, setAppQuitting } from "./tray/trayService";

/** Keep in sync with `build.appId` in package.json. Do not change after release — NSIS / auto-update identity. */
const PRODUCTION_APP_ID = "com.electron.tbh-companion";

// Dev uses a distinct ID so Windows taskbar metadata is not tied to electron.exe for production.
app.setAppUserModelId(app.isPackaged ? PRODUCTION_APP_ID : `${PRODUCTION_APP_ID}.dev`);

function appDisplayName(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8")) as {
      build?: { productName?: string };
    };
    return pkg.build?.productName ?? "TBH Companion";
  } catch {
    return "TBH Companion";
  }
}

app.setName(appDisplayName());

app.on("web-contents-created", (_event, contents) => {
  attachExternalLinkHandlers(contents);
});

function appVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8")) as {
      version?: string;
    };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

app.whenReady().then(() => {
  initDiagnosticLog();
  const appLog = createLogger("app");
  appLog.info(`TBH Companion v${appVersion()} ready`);
  const sessionUi = startTracking();
  const services = getAppServices();
  registerIpc(services);
  services.startUpdates();
  createTray(services);
  restoreSessionWindows(sessionUi);

  app.on("activate", () => {
    getAppServices().showMain();
  });
});

app.on("before-quit", () => {
  createLogger("app").info("App quitting");
  setAppQuitting(true);
  const services = getAppServices();
  services.stopUpdates();
  services.flushSession();
  destroyTray();
});

app.on("window-all-closed", () => {
  if (isAppQuitting()) {
    stopTracking();
    if (process.platform !== "darwin") app.quit();
  }
});
