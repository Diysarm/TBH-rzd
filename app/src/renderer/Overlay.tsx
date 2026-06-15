import { PRODUCT_NAME } from "../../shared/product";
import { useStats } from "./lib/useStats";
import { useInventory } from "./lib/useInventory";
import { usePriceProgress, usePriceStatus } from "./lib/usePrices";
import { fmtCompact } from "./lib/format";
import { formatMoney } from "../core/steamPrice";
import { stageName } from "../core/stages";
import { AlwaysOnTopIconPin } from "./components/AlwaysOnTopPin";
import { IconButton } from "./components/ui/IconButton";
import { OverlayFrame } from "./components/ui/OverlayFrame";

const RATE_TIP =
  "XP/hour updates when the game writes new XP to the save (often up to 3 minutes apart).";
const GOLD_TIP = "Gold earned per hour while farming (spending ignored).";

export function Overlay() {
  const stats = useStats();
  const inv = useInventory();
  const priceStatus = usePriceStatus();
  const priceProgress = usePriceProgress();

  const currency = inv?.currency ?? priceStatus?.currency ?? "USD";
  const invValue = inv?.composition.valuedTotal ?? null;
  const pricing = priceStatus?.running ?? false;
  const pricingLabel = priceProgress
    ? `${priceProgress.done}/${priceProgress.total}`
    : "…";

  return (
    <OverlayFrame density="compact">
      <div className="flex items-center justify-between gap-1">
        <span className="rzd-display truncate text-[10px] font-semibold text-accent">
          {PRODUCT_NAME}
        </span>
        <div className="no-drag flex shrink-0 gap-0.5">
          <AlwaysOnTopIconPin />
          <IconButton type="button" className="text-[11px]" title="Reset" onClick={() => window.tbh.reset()}>
            {"\u21bb"}
          </IconButton>
          <IconButton type="button" className="text-[11px]" title="Main window" onClick={() => window.tbh.showMain()}>
            {"\u2922"}
          </IconButton>
          <IconButton
            type="button"
            edge="end"
            className="text-[11px]"
            title="Close overlay"
            onClick={() => window.tbh.closeOverlay()}
          >
            {"\u2715"}
          </IconButton>
        </div>
      </div>

      {!stats ? (
        <p className="m-0 text-[10px] text-muted">Connecting…</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
            <p className="m-0 cursor-help" title={RATE_TIP}>
              <span className="text-lg font-bold leading-none text-gold">{fmtCompact(stats.rollingRate)}</span>
              <span className="ml-0.5 text-[8px] uppercase text-muted">xp/h</span>
            </p>
            <p className="m-0 cursor-help text-right" title={GOLD_TIP}>
              <span className="text-sm font-semibold leading-none text-accent">
                {fmtCompact(stats.goldRate)}
              </span>
              <span className="ml-0.5 text-[8px] uppercase text-muted">g/h</span>
            </p>
          </div>
          <p className="m-0 truncate text-[9px] text-muted">
            {stageName(stats.stageKey, stats.stageWave)}
            {inv ? (
              <>
                {" · Inv "}
                {invValue !== null ? formatMoney(invValue, currency) : "—"}
                {pricing ? ` (${pricingLabel})` : ""}
              </>
            ) : null}
          </p>
        </>
      )}
    </OverlayFrame>
  );
}
