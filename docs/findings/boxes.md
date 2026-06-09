# BoxData, chest capacity, and runes

Research spike against a live `SaveFile_Live.es3` (2026-06). See also
[`SAVE_FORMAT.md`](../SAVE_FORMAT.md) for the raw field layout.

## BoxData (held unopened chests)

`PlayerSaveData.BoxData` is three parallel arrays:

| Field | Role |
|-------|------|
| `BoxTypes[]` | Chest category id per slot |
| `BoxQuantity[]` | Count in that slot |
| `BoxUniqueId[]` | Internal slot ids (not used by companion) |

The companion already parses non-zero quantities in
[`app/src/core/inventory/parse.ts`](../../app/src/core/inventory/parse.ts).

### Observed BoxType values

| BoxType | Category | Notes |
|---------|----------|-------|
| `0` | **common** (gray) | All slots in a live save with only commons used type `0` |
| `5` | **rare** (blue) | Present in test fixture; stage-boss held slots |
| `9` | **act** (red) | Present in test fixture; act-boss held slots |

Additional type ids may appear in other saves — unmapped types show as
`Type N` until confirmed.

**Important:** `BoxData` counts are *held chest slots*, separate from
`910xxx` / `920xxx` / `930xxx` **STAGEBOX** ItemKeys in `itemSaveDatas`
(opened box items used for gear).

### Common capacity

Players stockpile **common (gray)** chests because opening one shares a
cooldown with **blue** stage-boss chests. Community baseline: **5** common
slots before rune bonuses.

Capacity formula used by the companion:

```
capacity = baseCapacity (5)
         + sum(level for each purchased rune in rune_box_cap.json)
         + settings.extraCommonBoxSlots
```

`isFull` when aggregated common quantity ≥ capacity.

## RuneSaveData (purchased runes)

Purchased rune nodes live in `PlayerSaveData.RuneSaveData`:

```json
"RuneSaveData": [
  { "RuneKey": 11, "Level": 3 },
  { "RuneKey": 12, "Level": 3 }
]
```

- `RuneKey` — node id (matches [taskbarhero.org rune database](https://taskbarhero.org/en/runes/))
- `Level` — current upgrade level (`0` = not purchased)

North-East **chest capacity** chain (Rune of Expansion): nodes `11`–`16`, plus
extension nodes `1801`–`1808` and `1901`–`1908`. Bundled ids in
[`data/rune_box_cap.json`](../../data/rune_box_cap.json); each level adds **+1**
slot per catalog entry.

Inventory/stash runes (`22`–`23`, `13001`, etc.) are **not** chest-capacity
nodes and are excluded from the cap catalog.

## Rare boss box farming (920xxx)

Rare boss box **drop cooldown** (~12 minutes) is **not** stored in the save.
The box-tracker overlay uses manual **Dropped** buttons with local persistence
(`box_timers.json` in app userData), inspired by community tools like
[taskbarhero.sbs](https://taskbarhero.sbs/).

Ideal farming stages are bundled in [`data/rare_box_routes.json`](../../data/rare_box_routes.json)
(community/wiki curated, no runtime fetch).

## Settings fallback

`extraCommonBoxSlots` in Settings (Advanced) adds manual bonus slots when rune
decode or catalog ids are incomplete.
