import {
  buildChestState,
  loadBoxTypeCatalog,
  loadRuneBoxCapCatalog,
  parseRuneSaveData,
} from "../../core/boxes";
import type { ChestHolding, ChestState } from "../../../shared/types";
import { IPC } from "../../../shared/ipc";
import { broadcast } from "./broadcast";

export class ChestService {
  private readonly boxTypes = loadBoxTypeCatalog();
  private readonly runeCap = loadRuneBoxCapCatalog();
  private lastChests: ChestState | null = null;
  private extraSlots = 0;

  setExtraCommonBoxSlots(n: number): void {
    this.extraSlots = Math.max(0, Math.trunc(n));
    if (this.lastChests) this.resolveAndPush(this.lastChestHoldings, this.lastSaveText, this.lastMtime);
  }

  private lastChestHoldings: ChestHolding[] = [];
  private lastSaveText = "";
  private lastMtime = 0;

  onSave(text: string, mtime: number, chests: ChestHolding[]): void {
    this.lastSaveText = text;
    this.lastMtime = mtime;
    this.lastChestHoldings = chests;
    this.resolveAndPush(chests, text, mtime);
  }

  getChests(): ChestState | null {
    return this.lastChests;
  }

  private resolveAndPush(chests: ChestHolding[], text: string, mtime: number): void {
    try {
      const purchases = parseRuneSaveData(text);
      this.lastChests = buildChestState(
        chests,
        purchases,
        mtime,
        this.boxTypes,
        this.runeCap,
        this.extraSlots,
      );
      broadcast(IPC.CHESTS, this.lastChests);
    } catch (err) {
      console.error("resolveAndPush chests failed:", err);
    }
  }
}
