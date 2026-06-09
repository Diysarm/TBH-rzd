# Refactor plan

Goal: maintainability, testability, and room to grow. **All phases complete on `refactor/maintainability`.**

## Pain points (addressed)

- ~~`main/index.ts` ~550 lines~~ → ~25 lines bootstrap
- ~~IPC channel strings duplicated~~ → `shared/ipc.ts`
- ~~`core/saveReader.ts` uses `node:fs`~~ → `main/io/saveFile.ts` + `core/save/snapshot.ts`
- ~~Duplicate types (`Config` vs `AppConfig`)~~ → unified `AppConfig` in `shared/types.ts`
- ~~Renderer filter logic untested~~ → `renderer/lib/inventoryFilters.ts` + tests

## Target structure

See `AGENTS.md` → **Architecture & refactor conventions**.

## Phases

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | `shared/ipc.ts`, extract windows + lifecycle + `registerIpc`, slim `index.ts` | Done |
| **2** | `TrackingService`, `InventoryService`, split IPC handlers | Done |
| **3** | Move fs out of core; split `inventory.ts`; unified config type | Done |
| **4** | Extract Inventory UI helpers + components; slim `SteamMarketProvider` | Done |

## Exit criteria

| Criterion | Status |
|-----------|--------|
| `index.ts` < 80 lines | ✓ (~25) |
| No `node:fs` under `core/` | ✓ |
| All IPC channels in `shared/ipc.ts` | ✓ |
| Config/currency/CSV bugs covered by tests | ✓ |
| `npm test` + `typecheck` + `build` green | ✓ (57 tests) |

## Bug fixes included (confident)

- **#1** Settings currency → `ensureOwnedPrices(true)` (`configPatch.ts`)
- **#3** CSV logging toggle without tracker recreate (`configPatch.ts`)
- **#4** Confirm dialog + inline hint before session-resetting settings (`Settings.tsx`)

Deferred for discussion: materials (`aggregateSaveDatas`), gear variant ` A`, unknown locations.

## Next (post-merge)

- Phase 5 (optional): DI container for services, extract `InventoryTable` component further
- Wire chosen app icon from `docs/design/icons/` into electron-builder
