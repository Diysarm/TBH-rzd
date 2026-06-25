import { memo } from "react";
import { gradeLabel, typeLabel } from "../../../core/labels";
import { gradeColor } from "./gradeColor";
import { MarketListingLink } from "./MarketListingLink";
import type { ResolvedInventoryRow } from "../../../../shared/types";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cn } from "../../lib/cn";

function priceSourceTitle(source: ResolvedInventoryRow["priceSource"]): string | undefined {
  if (source === "median") return "Recent sale median on Steam Market";
  if (source === "lowest") return "Lowest listing (no recent sales on Steam)";
  return undefined;
}

function emptyPriceDisplay(row: ResolvedInventoryRow): { label: string; title: string } {
  if (row.priceChecked) {
    return {
      label: "No listings",
      title: "No active Steam Market listings or recent sales for this item",
    };
  }
  return {
    label: "—",
    title: "Steam price not loaded yet",
  };
}

export interface InventoryTableProps {
  rows: ResolvedInventoryRow[];
  sortKey: "name" | "grade" | "level" | "type" | "count" | "inUse" | "price" | "value";
  sortDir: "asc" | "desc";
  onSort: (
    key: "name" | "grade" | "level" | "type" | "count" | "inUse" | "price" | "value",
  ) => void;
  onClearFilters: () => void;
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return null;
  return <>{dir === "asc" ? " \u25b2" : " \u25bc"}</>;
}

const thClass =
  "sticky top-0 z-[1] bg-panel px-2 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted cursor-pointer select-none border-b border-border font-semibold";
const thNumClass = cn(thClass, "text-right");
const tdClass = "px-2 py-1.5 border-b border-border";
const tdNumClass = cn(tdClass, "text-right tabular-nums");

const InventoryRow = memo(function InventoryRow({ row }: { row: ResolvedInventoryRow }) {
  const inUse = row.inUseCount ?? 0;
  const emptyPrice = row.marketHashName ? emptyPriceDisplay(row) : null;
  return (
    <tr
      className={cn(
        "hover:bg-card [content-visibility:auto] [contain-intrinsic-size:0_36px]",
        !row.known && "opacity-70",
      )}
    >
      <td className={cn(tdClass, "max-w-[11rem]")} title={row.name}>
        <div className="flex min-w-0 items-center gap-1">
          <span
            className="size-[9px] shrink-0 rounded-full"
            style={{ background: gradeColor(row.grade) }}
          />
          <span className="min-w-0 truncate">{row.name}</span>
          {row.chaoticCount > 0 && (
            <span className="shrink-0 text-gold" title="Chaotic">
              &#9670;
            </span>
          )}
        </div>
      </td>
      <td className={tdClass} style={{ color: gradeColor(row.grade) }}>
        {gradeLabel(row.grade)}
      </td>
      <td className={tdNumClass}>
        {row.level != null ? row.level : <span className="text-muted">-</span>}
      </td>
      <td className={cn(tdClass, "text-muted text-[12px]")}>{typeLabel(row.type)}</td>
      <td className={tdNumClass}>{row.count}</td>
      <td className={tdNumClass}>
        {inUse > 0 ? (
          <span className="text-accent">
            {inUse}
            {inUse < row.count ? `/${row.count}` : ""}
          </span>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td className={cn(tdNumClass, "whitespace-nowrap")}>
        {row.marketHashName ? (
          row.priceRaw ? (
            <MarketListingLink
              hash={row.marketHashName}
              title={priceSourceTitle(row.priceSource)}
              className="text-gold no-underline hover:text-accent hover:underline"
            >
              {row.priceRaw}
            </MarketListingLink>
          ) : (
            <MarketListingLink hash={row.marketHashName} title={emptyPrice!.title}>
              <span className="text-[12px] text-muted">{emptyPrice!.label}</span>
            </MarketListingLink>
          )
        ) : (
          <span className="text-muted" title="Not priced (non-tradable or below Legendary gear)">
            -
          </span>
        )}
      </td>
    </tr>
  );
});

export function InventoryTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  onClearFilters,
}: InventoryTableProps) {
  return (
    <Card padding="none" className="min-h-[200px] flex-1 overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={thClass} onClick={() => onSort("name")}>
              Name
              <SortArrow active={sortKey === "name"} dir={sortDir} />
            </th>
            <th className={thClass} onClick={() => onSort("grade")}>
              Grade
              <SortArrow active={sortKey === "grade"} dir={sortDir} />
            </th>
            <th className={thNumClass} onClick={() => onSort("level")}>
              Level
              <SortArrow active={sortKey === "level"} dir={sortDir} />
            </th>
            <th className={thClass} onClick={() => onSort("type")}>
              Type
              <SortArrow active={sortKey === "type"} dir={sortDir} />
            </th>
            <th className={thNumClass} onClick={() => onSort("count")}>
              Count
              <SortArrow active={sortKey === "count"} dir={sortDir} />
            </th>
            <th className={thNumClass} onClick={() => onSort("inUse")}>
              In use
              <SortArrow active={sortKey === "inUse"} dir={sortDir} />
            </th>
            <th className={thNumClass} onClick={() => onSort("price")}>
              Price
              <SortArrow active={sortKey === "price"} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-muted">
                No items match these filters.{" "}
                <Button size="sm" className="ml-1.5" onClick={onClearFilters}>
                  Clear filters
                </Button>
              </td>
            </tr>
          ) : (
            rows.map((row) => <InventoryRow key={row.itemKey} row={row} />)
          )}
        </tbody>
      </table>
    </Card>
  );
}
