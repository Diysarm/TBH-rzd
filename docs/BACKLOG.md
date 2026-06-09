# Backlog - future release ideas

Parking lot for features we want but aren't building yet. Each entry notes the
gist plus any known gotchas so we don't rediscover them. Newest first.

## Inventory: filter by type and grade

Add type and grade filters to the Inventory tab (today it only has free-text
search + a "tradable only" toggle).

- Data is already present: every `ResolvedInventoryRow` carries `grade` and
  `type`, and the composition has `byGrade` / `byType`.
- Implementation: two dropdowns (or multi-select chips) in `Inventory.tsx`
  driven by the distinct grades/types in the current rows; combine with the
  existing search + tradable filters. Sort grade options by the existing
  `GRADE_ORDER` so they read low->high rarity.
- Small/contained; no save or catalog changes needed.

## Inventory: "in use" (equipped) column + filter

Show whether an item is currently equipped/in use, with a column and a filter.

- **Needs research:** `itemSaveDatas` is the flat master list; it does not say
  what's equipped. Equipped items are referenced elsewhere (likely
  `heroSaveDatas` / a loadout structure) by `UniqueId`. Step 1 is to find where
  equipped item ids live in the save.
- **Gotcha:** that mapping is a `UniqueId` join, and `UniqueId` exceeds JS's
  safe-integer range (distinct ids collide after `JSON.parse`, ~6/185 observed).
  Must parse those ids losslessly (string/bigint) - see `docs/SAVE_FORMAT.md`.
- **UI nuance:** rows are grouped by `ItemKey`, so "in use" can be partial (e.g.
  1 of 3 copies equipped). Show "X/Y in use" or split equipped vs spare. Likely
  also wants pet/rune slots, not just hero gear.

## All tabs: global "last updated" header

Every tab's data comes from the same save read, so surface the save freshness
once at the app level instead of only on the Live tab.

- Add a thin status bar in `App.tsx` (above/within the tab area) showing
  "Last updated: Ns ago" (and "is the game running?" idle state after the
  threshold), shared by all tabs and the overlay.
- The `stats` stream already ticks every second and carries `secondsSinceRead` /
  save mtime, so a small shared hook can drive it without new IPC. Consider a
  dedicated lightweight `save-status` channel if we don't want the full stats
  payload on non-Live tabs.
- De-duplicate: the Live tab's own "last updated" line would fold into this.
