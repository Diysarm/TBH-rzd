import type { IpcMain } from "electron";
import { IPC } from "../../../../shared/ipc";
import type { AppServices } from "../../app/appState";

export function registerUpdateHandlers(ipc: IpcMain, services: AppServices): void {
  ipc.handle(IPC.UPDATE_CHECK, () => services.checkForUpdates());
  ipc.handle(IPC.UPDATE_DOWNLOAD, () => services.downloadUpdate());
  ipc.handle(IPC.UPDATE_QUIT_AND_INSTALL, () => {
    services.quitAndInstall();
  });
  ipc.handle(IPC.GET_UPDATE_STATUS, () => services.getUpdateStatus());
}
