import { PRODUCT_NAME } from "../../../shared/product";
import { Notification } from "electron";

import type { NotificationSoundId } from "../../../shared/notificationCatalog";
import type { AppConfig } from "../../../shared/types";
import { createLogger } from "../log";

const log = createLogger("notifications");

export interface ChestEventPayload {
  boxId: number;
  name: string;
  level: number | null;
}

export interface HeroLevelUpPayload {
  key: string;
  previousLevel: number;
  newLevel: number;
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
      body: `${PRODUCT_NAME} v${version} is available. Open About to download.`,
    });
    notification.on("click", () => this.focusMainWindow());
    notification.show();
  }

  showChestDrop(_payload: ChestEventPayload): void {}

  showChestReady(_payload: ChestEventPayload): void {}

  showHeroLevelUp(_events: HeroLevelUpPayload[]): void {}

  previewNotificationSound(_soundId: NotificationSoundId): void {}
}
