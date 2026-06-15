import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_NOTIFICATION_PREFS } from "../../shared/notificationCatalog";

const notificationCtor = vi.hoisted(() =>
  vi.fn(function MockNotification(this: { show: () => void; on: () => void }) {
    this.show = vi.fn();
    this.on = vi.fn();
  }),
);

vi.mock("electron", () => ({
  Notification: Object.assign(notificationCtor, { isSupported: vi.fn(() => true) }),
}));

vi.mock("../../src/main/log", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { Notification } from "electron";
import { NotificationService } from "../../src/main/services/NotificationService";
import type { AppConfig } from "../../shared/types";

const baseConfig: AppConfig = {
  savePath: "",
  es3Password: "",
  pollIntervalSeconds: 5,
  rollingWindowMinutes: 5,
  startTopmost: true,
  logHistoryCsv: true,
  currency: "USD",
  notificationsEnabled: true,
  notifyOnUpdateAvailable: true,
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
};

describe("NotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Notification.isSupported).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips update notification when master toggle is off", () => {
    const service = new NotificationService(
      () => ({ ...baseConfig, notificationsEnabled: false }),
      vi.fn(),
    );
    service.showUpdateAvailable("2.0.0");
    expect(notificationCtor).not.toHaveBeenCalled();
  });

  it("skips update notification when update toggle is off", () => {
    const service = new NotificationService(
      () => ({ ...baseConfig, notifyOnUpdateAvailable: false }),
      vi.fn(),
    );
    service.showUpdateAvailable("2.0.0");
    expect(notificationCtor).not.toHaveBeenCalled();
  });

  it("dedupes update notifications per version", () => {
    const service = new NotificationService(() => baseConfig, vi.fn());
    service.showUpdateAvailable("2.0.0");
    service.showUpdateAvailable("2.0.0");
    expect(notificationCtor).toHaveBeenCalledTimes(1);
  });

  it("does not play sounds for chest ready", () => {
    const service = new NotificationService(() => baseConfig, vi.fn());
    service.showChestReady({ boxId: 920151, name: "Test box", level: 15 });
    expect(notificationCtor).not.toHaveBeenCalled();
  });

  it("does not play sounds for chest drop", () => {
    const service = new NotificationService(() => baseConfig, vi.fn());
    service.showChestDrop({ boxId: 920151, name: "Test box", level: 15 });
    expect(notificationCtor).not.toHaveBeenCalled();
  });

  it("does not play sounds for hero level up", () => {
    const service = new NotificationService(() => baseConfig, vi.fn());
    service.showHeroLevelUp([{ key: "101", previousLevel: 5, newLevel: 6 }]);
    expect(notificationCtor).not.toHaveBeenCalled();
  });

  it("preview sound is a no-op", () => {
    const service = new NotificationService(() => baseConfig, vi.fn());
    service.previewNotificationSound("double-tap");
    expect(notificationCtor).not.toHaveBeenCalled();
  });
});
