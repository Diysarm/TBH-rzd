import { formatMoney } from "../../../core/steamPrice";
import { GradeBars } from "./GradeBars";
import type { ResolvedInventory } from "../../../../shared/types";

export function InventorySummary({
  inv,
  chestTotal,
  currency,
  onViewChests,
}: {
  inv: ResolvedInventory;
  chestTotal: number;
  currency: string;
  onViewChests?: () => void;
}) {
  const c = inv.composition;

  return (
    <>
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
          <div className="stat-label">
            unopened chests
            {onViewChests && (
              <>
                {" "}
                <button type="button" className="linkish" onClick={onViewChests}>
                  View chests →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <GradeBars composition={c} />
      {(c.unknownCount ?? 0) > 0 && (
        <div className="inv-hint">
          {c.unknownCount} item(s) are not in the bundled catalog (Unknown #id).{" "}
          <button type="button" className="btn small-btn" onClick={() => void window.tbh.refreshGameData()}>
            Refresh catalog
          </button>
        </div>
      )}
    </>
  );
}
