# Backlog - future release ideas

Parking lot for features we want but aren't building yet. Newest first.

## Records tab (stage clears + chest drops)

The in-game Records tab is session-only - not written to the save. We could derive
our own log from save deltas, but the save only rewrites ~every 2 min, so chest
drops can be opened before we observe the `BoxData` delta (lossy). Needs a
reliability design before building.

## Time-series charts + persistence

Store XP/gold/inventory value samples in SQLite (`userData/`) and chart trends
(XP/hr over the last hour, inventory value over the week). Deferred for now.

## Provider registry / extensibility

Extract a small provider interface so future tabs (pets, runes, stages) plug in
without growing `main/index.ts`.

## `aggregateSaveDatas` decoding

Lifetime counters `{ Type, SubKey, Value }` in the save with unknown meanings -
could unlock more stats if reverse-engineered.

## Per-location inventory split refinements

Equipped items are tracked separately from bag/stash/trading slots. Some instances
still show as "unknown" when slot refs don't resolve (timing/collisions). Could
add pet/rune slot sources if found in the save.

## Gear variant letter (` A`, ` B`, ...)

Steam listings disambiguate variants with a trailing letter. We default to ` A` or
pick the nearest market grade; the save may carry which variant an instance is -
not yet decoded from datamine fields.
