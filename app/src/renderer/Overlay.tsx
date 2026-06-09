import { useStats } from "./lib/useStats";
import { fmtCompact, fmtAgo } from "./lib/format";
import { stageName } from "../core/stages";

const IDLE_THRESHOLD = 120;

// Compact always-on-top overlay. The whole card is draggable except the
// buttons (see .no-drag in styles.css).
export function Overlay() {
  const stats = useStats();

  return (
    <div className="overlay">
      <div className="overlay-bar">
        <span className="overlay-title">TBH</span>
        <div className="overlay-actions no-drag">
          <button title="Reset" onClick={() => window.tbh.reset()}>
            {"\u21bb"}
          </button>
          <button title="Open full window" onClick={() => window.tbh.showMain()}>
            {"\u2922"}
          </button>
          <button title="Close overlay" onClick={() => window.tbh.closeOverlay()}>
            {"\u2715"}
          </button>
        </div>
      </div>

      {!stats ? (
        <p className="muted overlay-msg">Connecting...</p>
      ) : (
        <>
          <div className="overlay-rate">
            <span className="overlay-num">{fmtCompact(stats.rollingRate)}</span>
            <span className="overlay-unit">XP / hr</span>
          </div>
          <div className="overlay-gold">{fmtCompact(stats.goldRate)} gold / hr</div>
          <div className="overlay-foot">
            <span>{stageName(stats.stageKey, stats.stageWave)}</span>
            <span
              className={
                stats.secondsSinceGain !== null && stats.secondsSinceGain > IDLE_THRESHOLD
                  ? "warn"
                  : ""
              }
            >
              {fmtAgo(stats.secondsSinceGain)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
