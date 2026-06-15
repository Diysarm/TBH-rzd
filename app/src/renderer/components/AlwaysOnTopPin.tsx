import { useEffect, useState } from "react";
import { reportIpcError } from "../lib/reportError";
import { IconButton } from "./ui/IconButton";
import { cn } from "../lib/cn";

function PinIcon({ active }: { active: boolean }) {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.5c-1.2 0-2.2 1-2.2 2.2 0 .7.3 1.3.8 1.7L5.2 8.5v1.2h5.6V8.5l-1.4-3.1c.5-.4.8-1 .8-1.7 0-1.2-1-2.2-2.2-2.2Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 9.7h3M7.2 9.7V14M8.8 9.7V14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function useAlwaysOnTopPin() {
  const [pinned, setPinned] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void window.tbh
      .getConfig()
      .then((config) => setPinned(config.startTopmost))
      .catch((err: unknown) => reportIpcError(err))
      .finally(() => setReady(true));
  }, []);

  const toggle = () => {
    const next = !pinned;
    setPinned(next);
    void window.tbh
      .saveConfig({ startTopmost: next })
      .then((config) => setPinned(config.startTopmost))
      .catch((err: unknown) => {
        reportIpcError(err);
        setPinned((value) => !value);
      });
  };

  return { pinned, ready, toggle };
}

export function AlwaysOnTopIconPin({ className }: { className?: string }) {
  const { pinned, ready, toggle } = useAlwaysOnTopPin();
  if (!ready) return null;

  return (
    <IconButton
      type="button"
      title={pinned ? "Unpin — allow behind other windows" : "Pin on top"}
      aria-pressed={pinned}
      onClick={toggle}
      className={cn(pinned && "text-ideal", className)}
    >
      <PinIcon active={pinned} />
    </IconButton>
  );
}
