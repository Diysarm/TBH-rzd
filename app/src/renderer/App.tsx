import { useState } from "react";
import { ErrorBoundary } from "./lib/ErrorBoundary";
import { AppSidebar } from "./components/AppSidebar";
import type { TabId } from "./components/AppTabBar";
import { SaveStatusBar } from "./components/SaveStatusBar";
import { Live } from "./tabs/Live";
import { Inventory } from "./tabs/Inventory";
import { Pets } from "./tabs/Pets";
import { Market } from "./tabs/Market";
import { Settings } from "./tabs/Settings";
import { About } from "./tabs/About";

export function App() {
  const [tab, setTab] = useState<TabId>("live");

  return (
    <div className="flex h-full">
      <AppSidebar tab={tab} onTabChange={setTab} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SaveStatusBar />
        <main className="min-h-0 flex-1 overflow-auto p-5">
          <ErrorBoundary key={tab} title={`${tab} tab crashed`}>
            {tab === "live" && <Live />}
            {tab === "inventory" && <Inventory />}
            {tab === "pets" && <Pets />}
            {tab === "market" && <Market />}
            {tab === "settings" && <Settings />}
            {tab === "about" && <About />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
