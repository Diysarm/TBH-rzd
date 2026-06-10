import { useStats } from "./lib/useStats";
import { useInventory } from "./lib/useInventory";
import { usePriceStatus } from "./lib/usePrices";
import { fmtCompact, fmtAgo } from "./lib/format";
import { formatMoney } from "../core/steamPrice";
import { stageName } from "../core/stages";

const IDLE_THRESHOLD = 120;

const RATE_TIP =
  "XP/hour updates only when the game writes new XP to the save (often up to " +
  "3 minutes apart, sometimes longer). It holds steady between writes instead of decaying.";
const GOLD_TIP =
  "Gold earned per hour. Counts gold gained only; spending (upgrades, Cube, " +
  "runes) is ignored, so it's accurate while farming.";

export function Overlay() {
  const stats = useStats();
  const inv = useInventory();
  const priceStatus = usePriceStatus();

  const currency = inv?.currency ?? priceStatus?.currency ?? "USD";
  const invValue = inv?.composition.valuedTotal ?? null;
  const pricing = priceStatus?.running ?? false;

  const idle = stats !== null && stats.secondsSinceGain !== null && stats.secondsSinceGain > IDLE_THRESHOLD;

  return (
    <div className="overlay">
      <div className="overlay-bar">
        <span className="overlay-title">TBH</span>
        <div className="overlay-actions no-drag">
          <button type="button" title="Reset session stats" onClick={() => window.tbh.reset()}>
            {"\u21bb"}
          </button>
          <button type="button" title="Open full window" onClick={() => window.tbh.showMain()}>
            {"\u2922"}
          </button>
          <button type="button" title="Close overlay" onClick={() => window.tbh.closeOverlay()}>
            {"\u2715"}
          </button>
        </div>
      </div>

      {!stats ? (
        <p className="muted overlay-msg">Connecting...</p>
      ) : (
        <>
          <section className="overlay-rate-card">
            <div className="overlay-rate-primary" title={RATE_TIP}>
              <span className="overlay-num">{fmtCompact(stats.rollingRate)}</span>
              <span className="overlay-unit">XP / hr</span>
            </div>

            <div className="overlay-rate-side">
              <div className="overlay-gold" title={GOLD_TIP}>
                {fmtCompact(stats.goldRate)} gold / hr
              </div>
              <div className="overlay-meta">
                <span>
                  Map <b>{stageName(stats.stageKey, stats.stageWave)}</b>
                </span>
                <span className={idle ? "warn" : undefined}>
                  XP + <b>{fmtAgo(stats.secondsSinceGain)}</b>
                </span>
              </div>
            </div>
          </section>

          {inv && (
            <div className="overlay-inv">
              Inv: {invValue !== null ? formatMoney(invValue, currency) : "-"}
              {pricing && <span className="muted"> (pricing…)</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
