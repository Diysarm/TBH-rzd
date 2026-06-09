// Map catalog items to Steam Community Market `market_hash_name`s.
//
// Materials: 1:1 on display name. Gear: "<name> (<Grade>) A" (variant letter).
// Gear is only priced at Legendary+; materials are priced regardless of grade.
// Exact grade only (no cross-grade fallback). priceoverview confirms listings.

import type { GameItem } from "./gamedata";
import { gradeTitle, isPriceableGrade } from "./grades";

export interface MarketHashMatch {
  name: string;
}

export function isPriceableItem(type: string, grade: string, marketTradable: boolean): boolean {
  if (!marketTradable) return false;
  if (type === "MATERIAL") return true;
  if (type === "GEAR") return isPriceableGrade(grade);
  return false;
}

function gearMarketHash(itemName: string, catalogGrade: string): string {
  return `${itemName} (${gradeTitle(catalogGrade)}) A`;
}

/** Resolve a catalog item to a Steam market_hash_name, or null if not priceable. */
export function marketHashMatch(item: GameItem): MarketHashMatch | null {
  if (!isPriceableItem(item.type, item.grade, item.marketTradable)) return null;

  if (item.type === "MATERIAL") {
    return { name: item.name };
  }

  if (item.type === "GEAR") {
    return { name: gearMarketHash(item.name, item.grade) };
  }

  return null;
}

export function marketHashName(item: GameItem): string | null {
  return marketHashMatch(item)?.name ?? null;
}
