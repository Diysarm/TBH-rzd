import { useState } from "react";
import { Live } from "./tabs/Live";

type TabId = "live" | "inventory" | "market";

const TABS: { id: TabId; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "inventory", label: "Inventory" },
  { id: "market", label: "Market" },
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
      </nav>
      <main className="content">
        {tab === "live" && <Live />}
        {tab === "inventory" && <Placeholder title="Inventory" note="Owned items + composition (Phase 4)." />}
        {tab === "market" && <Placeholder title="Market" note="Steam Market valuation (Phase 5)." />}
      </main>
    </div>
  );
}

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="placeholder">
      <h1>{title}</h1>
      <p>{note}</p>
    </div>
  );
}
