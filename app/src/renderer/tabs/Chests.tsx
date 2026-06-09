import { useChests } from "../lib/useChests";

export function Chests() {
  const chests = useChests();

  if (!chests) {
    return (
      <div className="placeholder">
        <h1>Chests</h1>
        <p className="muted">Waiting for save data…</p>
      </div>
    );
  }

  const { common, rows, totalHeld, runeBonusSlots } = chests;
  const otherRows = rows.filter((r) => r.category !== "common");
  const pct = common.capacity > 0 ? Math.min(100, (common.quantity / common.capacity) * 100) : 0;

  return (
    <div className="chests-tab">
      <header className="chests-header">
        <h1>Chests</h1>
        <p className="muted">
          Unopened chest slots from your save ({totalHeld.toLocaleString()} held). Common and blue boss
          boxes share an open cooldown — many players stockpile commons until full.
        </p>
      </header>

      <section className="chest-section common-section">
        <div className="chest-section-head">
          <h2>Common (gray)</h2>
          {common.isFull && <span className="badge full">Full</span>}
        </div>
        <div className="chest-cap-row">
          <span className="chest-cap-label">
            {common.quantity} / {common.capacity}
          </span>
          {runeBonusSlots > 0 && (
            <span className="muted small">includes +{runeBonusSlots} from runes</span>
          )}
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={common.quantity} aria-valuemin={0} aria-valuemax={common.capacity}>
          <div className="progress-fill gray" style={{ width: `${pct}%` }} />
        </div>
        {!common.isFull && (
          <p className="muted small">{common.slotsRemaining} slot(s) remaining before common cap</p>
        )}
      </section>

      {otherRows.length > 0 && (
        <section className="chest-section">
          <h2>Other held types</h2>
          <table className="chest-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {otherRows.map((r) => (
                <tr key={r.boxType}>
                  <td>{r.label}</td>
                  <td>{r.category}</td>
                  <td>{r.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="chest-actions">
        <button type="button" className="btn primary" onClick={() => window.tbh.openBoxTracker()}>
          Open box tracker overlay
        </button>
        <p className="muted small">
          Track rare boss box drops with 12-minute timers and community ideal-stage routes.
        </p>
      </section>
    </div>
  );
}
