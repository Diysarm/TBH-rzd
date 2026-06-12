import { app, nativeImage, type BrowserWindow } from "electron";
import { join } from "node:path";

/** Bundled main lives in out/main/ — resolve repo icons relative to that. */
function devIconsDir(): string {
  return join(__dirname, "../../../docs/design/icons");
}

function windowIconFileName(): string {
  return process.platform === "win32" ? "companion-icon.ico" : "companion-icon-256.png";
}

export function appIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, windowIconFileName());
  }
  return join(devIconsDir(), windowIconFileName());
}

export function trayIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "tray-icon-32.png");
  }
  return join(devIconsDir(), "tray-icon-32.png");
}

export function appIconImage() {
  return nativeImage.createFromPath(appIconPath());
}

export function setWindowIcon(win: BrowserWindow): void {
  const image = appIconImage();
  if (!image.isEmpty()) {
    win.setIcon(image);
  }
}

export function trayImage() {
  const image = nativeImage.createFromPath(trayIconPath());
  if (image.isEmpty()) return image;
  return image.resize({ width: 16, height: 16 });
}
