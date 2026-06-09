import { useBoxTimers, fmtTimer } from "./lib/useBoxTimers";
import { stageName } from "../core/stages";

export function BoxTracker() {
  const state = useBoxTimers();

  if (!state) {
    return (
      <div className="box-tracker">
        <p className="muted overlay-msg">Loading…</p>
      </div>
    );
  }

  const currentLabel = stageName(state.currentStageKey);

  return (
    <div className="box-tracker">
      <div className="overlay-bar">
        <span className="overlay-title">Box tracker</span>
        <div className="overlay-actions no-drag">
          <button type="button" title="Open full window" onClick={() => window.tbh.showMain()}>
            {"\u2922"}
          </button>
          <button type="button" title="Close" onClick={() => window.tbh.closeBoxTracker()}>
            {"\u2715"}
          </button>
        </div>
      </div>

      <div className="box-tracker-meta">
        <span className="muted small">Current: {currentLabel}</span>
        {state.disclaimer && <span className="muted small">{state.disclaimer}</span>}
      </div>

      <ul className="box-tracker-list">
        {state.rows.map((row) => {
          const atIdeal =
            row.idealStageKey > 0 && state.currentStageKey === row.idealStageKey;
          return (
            <li key={row.boxId} className={row.active ? "box-row active" : "box-row"}>
              <div className="box-row-head">
                <span className="box-name">{row.name}</span>
                {row.level != null && <span className="box-lv">Lv{row.level}</span>}
              </div>
              <div className="box-route muted small">
                Ideal: {row.idealStageLabel}
                {atIdeal && <span className="route-ok"> (here)</span>}
              </div>
              {row.active ? (
                <>
                  <div className="progress-bar compact">
                    <div className="progress-fill blue" style={{ width: `${row.progress * 100}%` }} />
                  </div>
                  <div className="box-row-actions">
                    <span className="timer-label">{fmtTimer(row.remainingSeconds)}</span>
                    <button
                      type="button"
                      className="btn small-btn"
                      onClick={() => void window.tbh.clearBoxTimer(row.boxId)}
                    >
                      Clear
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="btn small-btn dropped-btn"
                  onClick={() => void window.tbh.markBoxDropped(row.boxId)}
                >
                  Dropped
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
