import { useState } from "react";
import { Live } from "./tabs/Live";
import { Inventory } from "./tabs/Inventory";
import { Market } from "./tabs/Market";
import { Settings } from "./tabs/Settings";
import { useStats } from "./lib/useStats";
import { fmtAgo } from "./lib/format";
import { ErrorBoundary } from "./lib/ErrorBoundary";

const IDLE_THRESHOLD = 120;

type TabId = "live" | "inventory" | "market" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "inventory", label: "Inventory" },
  { id: "market", label: "Market" },
  { id: "settings", label: "Settings" },
];

export function App() {
  const [tab, setTab] = useState<TabId>("live");

  return (
    <div className="app">
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button className="tab overlay-toggle" title="Open mini overlay" onClick={() => window.tbh.openOverlay()}>
          {"\u25a3"} Mini
        </button>
      </nav>
      <SaveStatusBar />
      <main className="content">
        <ErrorBoundary title={`${tab} tab crashed`}>
          {tab === "live" && <Live />}
          {tab === "inventory" && <Inventory />}
          {tab === "market" && <Market />}
          {tab === "settings" && <Settings />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

// Save-file freshness shared by all tabs (all tab data comes from one save read).
// Distinct from the Live tab's "XP updated" line, which tracks XP-change time.
function SaveStatusBar() {
  const stats = useStats();
  const since = stats?.secondsSinceRead ?? null;
  const idle = since !== null && since > IDLE_THRESHOLD;

  let text: string;
  if (!stats || !stats.connected) text = "Connecting to the save file...";
  else if (since === null) text = "Waiting for the first save read...";
  else text = `Save written ${fmtAgo(since)}`;

  return (
    <div className={idle ? "savebar warn" : "savebar"}>
      <span className="savebar-dot" />
      <span>{text}</span>
      {idle && <span className="savebar-hint">- is the game running?</span>}
    </div>
  );
}
