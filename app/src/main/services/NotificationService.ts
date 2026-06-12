import { Notification, app } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { AppConfig, ChestSoundVariant } from "../../../shared/types";
import { createLogger } from "../log";

const log = createLogger("notifications");

export interface ChestReadyPayload {
  boxId: number;
  name: string;
  level: number | null;
}

export class NotificationService {
  private readonly getConfig: () => AppConfig;
  private readonly focusMainWindow: () => void;
  private supported: boolean | null = null;
  private lastNotifiedVersion: string | undefined;

  constructor(getConfig: () => AppConfig, focusMainWindow: () => void) {
    this.getConfig = getConfig;
    this.focusMainWindow = focusMainWindow;
  }

  private isSupported(): boolean {
    if (this.supported !== null) return this.supported;
    this.supported = Notification.isSupported();
    if (!this.supported) log.warn("OS notifications are not supported on this system");
    return this.supported;
  }

  showUpdateAvailable(version: string): void {
    const config = this.getConfig();
    if (!config.notificationsEnabled || !config.notifyOnUpdateAvailable) return;
    if (!this.isSupported()) return;
    if (this.lastNotifiedVersion === version) return;
    this.lastNotifiedVersion = version;

    const notification = new Notification({
      title: "Update available",
      body: `TBH Companion v${version} is available. Open About to download.`,
    });
    notification.on("click", () => this.focusMainWindow());
    notification.show();
  }

  showChestReady(_payload: ChestReadyPayload): void {
    const config = this.getConfig();
    if (!config.notificationsEnabled) return;
    this.playChestSound(config.chestSoundVariant);
  }

  previewChestSound(variant?: ChestSoundVariant): void {
    const config = this.getConfig();
    if (!config.notificationsEnabled) return;
    this.playChestSound(variant ?? config.chestSoundVariant);
  }

  private playChestSound(variant: ChestSoundVariant): void {
    if (variant === "none") return;
    const path = soundPath(variant);
    if (!existsSync(path)) {
      log.warn(`Chest sound file missing: ${path}`);
      return;
    }
    if (process.platform !== "win32") {
      log.debug(`Chest sound playback skipped on ${process.platform}`);
      return;
    }
    const escaped = path.replace(/'/g, "''");
    execFile(
      "powershell",
      ["-NoProfile", "-Command", `(New-Object Media.SoundPlayer '${escaped}').PlaySync()`],
      { windowsHide: true },
      (err) => {
        if (err) log.warn(`Chest sound playback failed: ${err.message}`);
      },
    );
  }
}

export function soundPath(variant: ChestSoundVariant): string {
  if (variant === "none") return "";
  const filename = `${variant}.wav`;
  if (app.isPackaged) {
    return join(process.resourcesPath, "sounds", filename);
  }
  return join(app.getAppPath(), "resources", "sounds", filename);
}
