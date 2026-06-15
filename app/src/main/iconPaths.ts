import { app, nativeImage, type BrowserWindow } from "electron";
import { join } from "node:path";

/** Bundled main lives in out/main/ — resolve repo icons relative to that. */
function devIconsDir(): string {
  return join(__dirname, "../../../docs/design/icons");
}

/** Runtime window icon — PNG decodes reliably in Electron (multi-size ICO glitches on title bar). */
function windowIconFileName(): string {
  return "rzd-icon-256.png";
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
  const image = nativeImage.createFromPath(appIconPath());
  if (image.isEmpty()) return image;
  // Windows title bar expects a small raster; 256px PNG alone can render as noise.
  if (process.platform === "win32") {
    return image.resize({ width: 32, height: 32 });
  }
  return image;
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
