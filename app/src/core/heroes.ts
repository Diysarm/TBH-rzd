// Hero key -> display name. Unknown keys fall back to the raw key.
// Ported from the HERO_NAMES map in tbh_xp/app.py.

export const HERO_NAMES: Record<string, string> = {
  "101": "Knight",
  "201": "Ranger",
  "301": "Sorcerer",
  "401": "Priest",
  "501": "Hunter",
  "601": "Slayer",
};

export function heroName(key: string): string {
  return HERO_NAMES[String(key)] ?? String(key);
}
