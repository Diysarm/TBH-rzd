import { contextBridge, ipcRenderer } from "electron";
import type { Stats, TbhApi } from "../../shared/types";

// Narrow, typed bridge. The renderer never touches Node/Electron directly.
const api: TbhApi = {
  onStats(cb: (stats: Stats) => void): () => void {
    const listener = (_e: unknown, stats: Stats): void => cb(stats);
    ipcRenderer.on("stats", listener);
    return () => ipcRenderer.removeListener("stats", listener);
  },
  reset(): void {
    ipcRenderer.send("reset");
  },
  getStats(): Promise<Stats | null> {
    return ipcRenderer.invoke("get-stats");
  },
};

contextBridge.exposeInMainWorld("tbh", api);
