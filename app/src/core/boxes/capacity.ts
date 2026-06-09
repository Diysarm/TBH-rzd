import type { CommonBoxStatus } from "../../../shared/types";
import type { RuneBoxCapCatalog } from "./catalog";
import type { RunePurchase } from "./runes";
import { runeCapacityBonus } from "./runes";

export function commonBoxCapacity(
  purchases: RunePurchase[],
  runeCapCatalog: RuneBoxCapCatalog,
  settingsOverride = 0,
): number {
  const bonus = runeCapacityBonus(purchases, runeCapCatalog);
  return runeCapCatalog.baseCapacity + bonus + Math.max(0, settingsOverride);
}

export function commonBoxState(heldCommonQty: number, capacity: number): CommonBoxStatus {
  const quantity = Math.max(0, heldCommonQty);
  const cap = Math.max(1, capacity);
  const isFull = quantity >= cap;
  return {
    quantity,
    capacity: cap,
    isFull,
    slotsRemaining: Math.max(0, cap - quantity),
  };
}
