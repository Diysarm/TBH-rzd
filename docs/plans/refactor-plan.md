# Refactor plan

Maintainability, testability, performance, and security — aligned with project architecture (`AGENTS.md`), **react-best-practices**, and **best-practices** skills.

**Branch:** `refactor/maintainability`  
**Skills:** `.cursor/skills/react-best-practices/SKILL.md`, `.cursor/skills/best-practices/SKILL.md`  
**QA gate:** `.cursor/skills/tbh-qa/SKILL.md` — every phase ends with `npm run qa` + dev smoke.

---

## Status overview

| Phase | Focus | Status |
|-------|--------|--------|
| **1–4** | Main/core structure (IPC, services, save split, inventory UI extract) | **Done** |
| **5** | Renderer data layer — dedupe IPC, kill waterfalls | Planned |
| **6** | Bundle & tab loading — lazy tabs, direct imports | Planned |
| **7** | Re-render & list rendering — Inventory/Live perf | Planned |
| **8** | Security & quality — CSP, audit, errors, semantics | Planned |
| **9** | Main/process polish — DI, remaining domain bugs | Planned |

Phases 5–8 map directly to skill rule categories. Phase 9 catches backlog items that are product fixes, not perf/security patterns.

---

## Completed — Phases 1–4

| Goal | Outcome |
|------|---------|
| Slim bootstrap | `main/index.ts` ~25 lines |
| IPC parity | `shared/ipc.ts`, handlers by domain |
| Pure core | `core/save/snapshot`, `main/io/saveFile`, `core/inventory/*` |
| Services | `TrackingService`, `InventoryService`, `broadcast` |
| Renderer extract | `inventoryFilters.ts`, `GradeBars`, `MarketListingLink` |
| Market split | `priceCache`, `steamPriceApi`, slim `SteamMarketProvider` |
| Config | Unified `AppConfig`; config patch tests |
| QA | `npm run qa`, `npm run qa:dev`, tbh-qa skill, CI workflow |

**Exit criteria met:** no `node:fs` in `core/`, bundle path guards, 58+ tests, typecheck + build green.

---

## Phase 5 — Renderer data layer (react: `async-*`, `client-*`)

**Problem today:** Each tab/hook opens its own IPC subscription. `useStats()` runs in both `App` (`SaveStatusBar`) and `Live` — duplicate listeners and duplicate React state. Same pattern for inventory vs Market price listeners.

**Skill rules applied:**

| Rule | Application |
|------|-------------|
| `async-parallel` | Initial mount: `getStats` + `getInventory` in parallel where both needed |
| `client-swr-dedup` / `client-event-listeners` | Single subscription per channel, shared context |
| `rerender-derived-state-no-effect` | Derive idle/warn flags in render, not extra effects |

**Work:**

1. Add `renderer/context/TbhProvider.tsx` (or `lib/tbhStore.ts`):
   - One `onStats` / `getStats` pair for the whole app
   - One `onInventory` / `getInventory` pair
   - Optional: `onPricesProgress` + status for Market/Inventory
2. Replace direct `useStats()` / `useInventory()` in tabs with `useTbhStats()`, `useTbhInventory()` reading from context.
3. Keep hooks as thin wrappers for backward compatibility during migration.

**Files:** `App.tsx`, `Live.tsx`, `Overlay.tsx`, `lib/useStats.ts`, `lib/useInventory.ts`, new `context/*`.

**Tests:** Renderer hook tests with mocked `window.tbh` (optional Vitest + happy-dom).

**Exit criteria:**

- [ ] At most one IPC listener per channel in renderer
- [ ] SaveStatusBar + Live share one stats state (no double fetch on mount)
- [ ] tbh-qa pass

---

## Phase 6 — Bundle & tab loading (react: `bundle-*`)

**Problem today:** `App.tsx` statically imports all four tabs (~600 kB renderer chunk). User spends most time on Live; Inventory/Market/Settings load eagerly.

**Skill rules applied:**

| Rule | Application |
|------|-------------|
| `bundle-dynamic-imports` | `React.lazy` + `Suspense` per tab |
| `bundle-conditional` | Load tab module only when selected |
| `bundle-barrel-imports` | Import from `core/grades`, `core/steamPrice` directly — avoid new barrel files in hot paths; keep `core/inventory/index.ts` for main/tests only, not renderer |

**Work:**

1. Split tabs into lazy routes:

   ```tsx
   const Live = lazy(() => import("./tabs/Live").then(m => ({ default: m.Live })));
   ```

2. Tab shell: keep `nav` + `SaveStatusBar` eager; wrap tab body in `<Suspense fallback={…}>`.
3. Audit renderer imports from `core/` — ensure tree-shakeable (no accidental `gamedata` pull).
4. Measure: compare `out/renderer/assets/*.js` size before/after (document in PR).

**Files:** `App.tsx`, `electron.vite.config.ts` (manual chunks if needed).

**Exit criteria:**

- [ ] Initial JS payload smaller or split into separate chunks
- [ ] Switching tabs loads without blank crash
- [ ] tbh-qa pass

---

## Phase 7 — Re-render & list rendering (react: `rerender-*`, `rendering-*`, `js-*`)

**Problem today:** `Inventory.tsx` holds many `useState` filters + `useMemo`; large tables re-render fully on every price push. `Live` hero list grows with unlocked heroes.

**Skill rules applied:**

| Rule | Application |
|------|-------------|
| `rerender-memo` | Extract `InventoryRow`, filter controls as memoized components |
| `rerender-functional-setstate` | Stable filter handlers |
| `rendering-content-visibility` | CSS `content-visibility: auto` on table rows / hero rows |
| `rendering-hoist-jsx` | Static labels, grade legend outside row render |
| `js-index-maps` / `js-set-map-lookups` | Pre-index filter options once per inventory snapshot |
| `rerender-transitions` | Price refresh progress via `startTransition` (non-blocking UI) |

**Work:**

1. Split `Inventory.tsx`:
   - `components/inventory/InventoryTable.tsx`
   - `components/inventory/InventoryFilters.tsx`
   - `components/inventory/InventorySummary.tsx` (cards + grade bars)
2. Move filter state reducer optional (`useReducer`) if prop drilling grows.
3. Add `content-visibility` + `contain-intrinsic-size` in `styles.css` for long tables.
4. Market/Inventory: wrap price progress updates in `startTransition`.

**Files:** `Inventory.tsx`, `styles.css`, `Market.tsx`.

**Tests:** Extend `test/renderer/inventoryFilters.test.ts`; snapshot or row memo behavior if useful.

**Exit criteria:**

- [ ] Inventory table scroll smooth with 100+ rows (manual)
- [ ] No redundant filter recompute on unrelated state changes
- [ ] tbh-qa pass

---

## Phase 8 — Security & quality (best-practices)

**Problem today:** Partial CSP; `sandbox: false`; swallowed errors in hooks; duplicate tab semantics; no `npm audit` in CI.

**Skill rules applied:**

| Area | Rule / checklist item |
|------|------------------------|
| Security | CSP complete for Electron renderer; no mixed content |
| Security | `npm audit` in CI; document Electron `sandbox` tradeoff |
| Errors | Error boundaries at app root + tab level; no silent `.catch(() => {})` without dev log |
| Compatibility | Valid doctype, charset, viewport (already in `index.html`) |
| Code quality | Semantic HTML: `<nav>`, `<main>`, `<header>` for save bar |
| Code quality | Cleanup: all `useEffect` return unsubscribe (audit Market/Inventory) |
| Production | Source maps: hidden or off in production build |

**Work:**

1. **CSP** (`index.html` + `mainWindow` webPreferences if needed):
   - `script-src 'self'`
   - `connect-src 'self'` (Vite dev exception documented)
   - Keep Steam CDN on `img-src` only (external links via `shell.openExternal`, not iframe)
2. **CI:** add `npm audit --audit-level=high` step to `.github/workflows/qa.yml` (allow documented exceptions).
3. **ErrorBoundary:** wrap full `<App />` in `main.tsx`; log to console in dev, user-friendly fallback.
4. **Hooks:** replace empty catches with optional `reportError` helper (dev-only `console.error`).
5. **electron.vite.config.ts:** `build.sourcemap: false` for production renderer/main.
6. **Document** in `docs/ARCHITECTURE.md`: why `sandbox: false` (preload bridge), mitigations (contextIsolation, no nodeIntegration).

**Exit criteria:**

- [ ] CSP documented and enforced for prod build
- [ ] `npm audit` clean or waivers listed in `docs/DECISIONS.md`
- [ ] Root ErrorBoundary catches preload/API failures gracefully
- [ ] tbh-qa pass

---

## Phase 9 — Domain & main polish (backlog + architecture)

**Not skill-driven — product/fix items deferred from playtest:**

| Item | Notes |
|------|--------|
| Materials parsing | `aggregateSaveDatas` spike |
| Gear variant | Decode save variant; stop hardcoding ` A` |
| Unknown location `?` | Slot mapping edge cases |
| Optional DI | Factory for services in tests (`AppState` injection) |
| Branding | Wire icon from `docs/design/icons/` into electron-builder |

**Work:** one item per PR; each runs full tbh-qa.

---

## Cross-cutting requirements (every phase)

### Architecture (unchanged)

See `AGENTS.md` — four layers, no `node:fs` in `core/`, IPC in `shared/ipc.ts`, paths via `main/paths.ts`.

### React skill adaptation notes

This app is **Electron + Vite**, not Next.js. Ignore or defer:

- `server-*` rules (RSC, React.cache on server)
- `next/dynamic` → use `React.lazy` instead
- `async-suspense-boundaries` for SSR streaming → use Suspense around lazy tabs only

Prioritize for desktop companion:

1. **Eliminating waterfalls** (Phase 5)
2. **Bundle size** (Phase 6) — single large chunk hurts cold start
3. **Re-render / long lists** (Phase 7) — inventory valuation table
4. **Client listeners** (Phase 5) — IPC dedup

### Best-practices priority

1. **Security:** CSP, audit, external links via main process (already partially done)
2. **Console & errors:** ErrorBoundary + visible Settings API errors (pattern exists)
3. **Memory:** effect cleanup on all IPC subscriptions (Phase 5 helps centrally)
4. **Semantic HTML:** low risk, incremental in Phase 8

### QA (mandatory)

```powershell
cd app
npm run qa          # always
npm run qa:dev      # when agent cannot see UI
npm run dev         # visual smoke before merge
```

Phase is **not done** until required steps in tbh-qa skill pass.

---

## Suggested execution order

```
Done: Phases 1–4
Next: Phase 5 → 6 → 7 → 8 (skill-driven, low product risk)
Then: Phase 9 items (one PR each, user prioritization)
Merge refactor/maintainability after Phase 5 or 6 if scope grows — split PRs by phase.
```

---

## Metrics to track (optional)

| Metric | How |
|--------|-----|
| Renderer bundle size | `out/renderer/assets/*.js` after build |
| IPC listeners | Count `onStats` / `onInventory` registrations (should → 1 each) |
| Test count | `npm test` summary |
| Audit | `npm audit` high/critical count |

---

## References

- `AGENTS.md` — architecture & conventions
- `docs/ARCHITECTURE.md` — process diagram
- `docs/reviews/playtest-bugs.md` — domain bugs for Phase 9
- `.cursor/skills/react-best-practices/` — rule files under `rules/`
- `.cursor/skills/best-practices/SKILL.md` — security & quality checklist
- `.cursor/skills/tbh-qa/SKILL.md` — completion gate
