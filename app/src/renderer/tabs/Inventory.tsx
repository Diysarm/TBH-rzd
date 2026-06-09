import { useEffect, useMemo, useState } from "react";
import { useInventory } from "../lib/useInventory";
import { gradeLabel, typeLabel } from "../../core/labels";
import { formatMoney } from "../../core/steamPrice";
import { rowMatchesAnyLocation, unassignedCount } from "../../core/inventory/location";
import {
  filterAndSortRows,
  gradeOptionsFromInventory,
  typeOptionsFromInventory,
  defaultSortDir,
  type SortKey,
  type LocationFilter,
} from "../lib/inventoryFilters";
import { GradeBars, gradeColor } from "../components/inventory/GradeBars";
import { MarketListingLink } from "../components/inventory/MarketListingLink";
import type { ResolvedInventoryRow } from "../../../shared/types";
import type { PriceProgress, PriceStatus } from "../../../shared/types";

function priceSourceTitle(source: ResolvedInventoryRow["priceSource"]): string | undefined {
  if (source === "median") return "Recent sale median on Steam Market";
  if (source === "lowest") return "Lowest listing (no recent sales on Steam)";
  return undefined;
}

export function Inventory() {
  const inv = useInventory();
  const [query, setQuery] = useState("");
  const [tradableOnly, setTradableOnly] = useState(false);
  const [inUseOnly, setInUseOnly] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [priceStatus, setPriceStatus] = useState<PriceStatus | null>(null);
  const [priceProgress, setPriceProgress] = useState<PriceProgress | null>(null);

  useEffect(() => {
    void window.tbh.pricesStatus().then(setPriceStatus).catch(() => {});
    const off = window.tbh.onPricesProgress((p) => {
      setPriceProgress(p);
      void window.tbh.pricesStatus().then(setPriceStatus).catch(() => {});
    });
    return off;
  }, []);

  useEffect(() => {
    if (!inv) return;
    if (gradeFilter !== "ALL" && !inv.rows.some((r) => r.grade === gradeFilter)) {
      setGradeFilter("ALL");
    }
    if (typeFilter !== "ALL" && !inv.rows.some((r) => r.type === typeFilter)) {
      setTypeFilter("ALL");
    }
    if (locationFilter !== "ALL" && !rowMatchesAnyLocation(inv.rows, locationFilter)) {
      setLocationFilter("ALL");
    }
  }, [inv, gradeFilter, typeFilter, locationFilter]);

  const gradeOptions = useMemo(() => (inv ? gradeOptionsFromInventory(inv) : []), [inv]);
  const typeOptions = useMemo(() => (inv ? typeOptionsFromInventory(inv) : []), [inv]);

  const rows = useMemo(() => {
    if (!inv) return [];
    return filterAndSortRows(inv, {
      query,
      tradableOnly,
      inUseOnly,
      gradeFilter,
      typeFilter,
      locationFilter,
      sortKey,
      sortDir,
    });
  }, [inv, query, tradableOnly, inUseOnly, gradeFilter, typeFilter, locationFilter, sortKey, sortDir]);

  if (!inv) {
    return (
      <div className="placeholder">
        <h1>Inventory</h1>
        <p>Waiting for the save file... open the game so it writes a save.</p>
      </div>
    );
  }

  const c = inv.composition;
  const chestTotal = inv.chests.reduce((s, x) => s + x.quantity, 0);
  const currency = inv.currency ?? "USD";
  const pricing = priceStatus?.running ?? false;

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultSortDir(key));
    }
  }

  function clearFilters() {
    setQuery("");
    setTradableOnly(false);
    setInUseOnly(false);
    setGradeFilter("ALL");
    setTypeFilter("ALL");
    setLocationFilter("ALL");
  }

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " \u25b2" : " \u25bc") : "");

  return (
    <div className="inventory">
      <h1>Inventory</h1>

      <div className="inv-cards">
        <div className="stat">
          <div className="stat-value">{(c.total ?? 0).toLocaleString()}</div>
          <div className="stat-label">items owned</div>
        </div>
        <div className="stat">
          <div className="stat-value">{inv.rows.length.toLocaleString()}</div>
          <div className="stat-label">distinct</div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {c.valuedTotal != null && Number.isFinite(c.valuedTotal)
              ? formatMoney(c.valuedTotal, currency)
              : "-"}
          </div>
          <div className="stat-label">Steam value (priced)</div>
        </div>
        <div className="stat">
          <div className="stat-value">{chestTotal.toLocaleString()}</div>
          <div className="stat-label">unopened chests</div>
        </div>
      </div>

      {pricing && (
        <div className="inv-hint">
          Updating Steam prices in the background
          {priceProgress
            ? `: ${priceProgress.done}/${priceProgress.total} (${priceProgress.priced} priced)`
            : "..."}
          .{" "}
          <button className="btn small-btn danger" onClick={() => window.tbh.cancelPrices()}>
            Stop
          </button>
        </div>
      )}

      <GradeBars composition={c} />

      {(c.unknownCount ?? 0) > 0 && (
        <div className="inv-hint">
          {c.unknownCount} item(s) aren&apos;t in the catalog{" "}
          {inv.gameDataLoaded ? "(possibly added by a game update)" : "(catalog not loaded)"}.{" "}
          <button className="btn small-btn" onClick={() => void window.tbh.refreshGameData()}>
            Refresh game data
          </button>
        </div>
      )}

      <div className="inv-controls">
        <input
          className="inv-search"
          placeholder="Search items..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="inv-filter"
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          title="Filter by grade"
        >
          <option value="ALL">All grades</option>
          {gradeOptions.map((g) => (
            <option key={g} value={g}>
              {gradeLabel(g)}
            </option>
          ))}
        </select>
        <select
          className="inv-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          title="Filter by type"
        >
          <option value="ALL">All types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
        <select
          className="inv-filter"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value as LocationFilter)}
          title="Filter by storage location"
        >
          <option value="ALL">All locations</option>
          <option value="inventory">Inventory</option>
          <option value="stash">Stash</option>
          <option value="trading">Trading</option>
          <option value="equipped">Equipped</option>
          <option value="unknown">Unknown</option>
        </select>
        <label className="inv-toggle">
          <input
            type="checkbox"
            checked={tradableOnly}
            onChange={(e) => setTradableOnly(e.target.checked)}
          />
          Tradable only
        </label>
        <label className="inv-toggle">
          <input type="checkbox" checked={inUseOnly} onChange={(e) => setInUseOnly(e.target.checked)} />
          In use only
        </label>
        <span className="muted small">{rows.length} shown</span>
      </div>

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("name")}>Name{arrow("name")}</th>
              <th onClick={() => toggleSort("grade")}>Grade{arrow("grade")}</th>
              <th onClick={() => toggleSort("type")}>Type{arrow("type")}</th>
              <th className="num" onClick={() => toggleSort("count")}>
                Count{arrow("count")}
              </th>
              <th className="num">Location</th>
              <th className="num" onClick={() => toggleSort("inUse")}>
                In use{arrow("inUse")}
              </th>
              <th className="num" onClick={() => toggleSort("price")}>
                Price{arrow("price")}
              </th>
              <th className="num" onClick={() => toggleSort("value")}>
                Value{arrow("value")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="inv-empty muted">
                  No items match these filters.{" "}
                  <button type="button" className="btn small-btn" onClick={clearFilters}>
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              rows.map((row: ResolvedInventoryRow) => {
                const inUse = row.inUseCount ?? 0;
                return (
                  <tr key={row.itemKey} className={row.known ? "" : "unknown-row"}>
                    <td>
                      <span className="grade-dot" style={{ background: gradeColor(row.grade) }} />
                      {row.name}
                      {row.chaoticCount > 0 && (
                        <span className="chaotic" title="Chaotic">
                          {" "}
                          &#9670;
                        </span>
                      )}
                    </td>
                    <td style={{ color: gradeColor(row.grade) }}>{gradeLabel(row.grade)}</td>
                    <td className="muted">{typeLabel(row.type)}</td>
                    <td className="num">{row.count}</td>
                    <td className="num loc-cell">
                      {(row.inventoryCount ?? 0) > 0 && <span title="Inventory">Inv {row.inventoryCount}</span>}
                      {(row.stashCount ?? 0) > 0 && <span title="Stash">St {row.stashCount}</span>}
                      {(row.tradingCount ?? 0) > 0 && <span title="Trading">Tr {row.tradingCount}</span>}
                      {inUse > 0 && <span title="Equipped">Eq {inUse}</span>}
                      {unassignedCount(row) > 0 && <span title="Unassigned">?</span>}
                    </td>
                    <td className="num">
                      {inUse > 0 ? (
                        <span className="in-use">
                          {inUse}
                          {inUse < row.count ? `/${row.count}` : ""}
                        </span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td className="num">
                      {row.marketHashName ? (
                        row.priceRaw ? (
                          <MarketListingLink
                            hash={row.marketHashName}
                            title={priceSourceTitle(row.priceSource)}
                          >
                            {row.priceRaw}
                          </MarketListingLink>
                        ) : (
                          <MarketListingLink hash={row.marketHashName} title="Open on Steam Market">
                            <span className="muted">pending</span>
                          </MarketListingLink>
                        )
                      ) : (
                        <span className="muted" title="Not priced (non-tradable or below Legendary gear)">
                          -
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {row.marketHashName ? (
                        <MarketListingLink
                          hash={row.marketHashName}
                          title={
                            row.value != null && Number.isFinite(row.value)
                              ? `${priceSourceTitle(row.priceSource) ?? "Steam Market"} · stack value`
                              : "Open on Steam Market"
                          }
                        >
                          {row.value != null && Number.isFinite(row.value)
                            ? formatMoney(row.value, currency)
                            : "-"}
                        </MarketListingLink>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
