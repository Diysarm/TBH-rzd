import { fmtTimer } from "../lib/useBoxTimers";
import { cn } from "../lib/cn";

export function ChestTimerIcon({
  src,
  title,
  onCooldown,
  remainingSeconds = 0,
  progress = 0,
  onClick,
}: {
  src: string;
  title: string;
  onCooldown: boolean;
  remainingSeconds?: number;
  progress?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      className="relative shrink-0 rounded-lg p-0.5 transition active:scale-95"
      onClick={onClick}
    >
      <span
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-lg border-2 p-1",
          onCooldown
            ? "border-status-danger/60 bg-status-danger/10"
            : "border-status-info/50 bg-status-info/10 shadow-[0_0_10px_rgb(110_181_255/0.15)]",
        )}
      >
        <img src={src} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
        {onCooldown ? (
          <>
            <span
              className="pointer-events-none absolute inset-0 rounded-md bg-status-danger/25"
              style={{ clipPath: `inset(${Math.round((1 - progress) * 100)}% 0 0 0)` }}
              aria-hidden
            />
            <span className="absolute inset-x-0 bottom-0 rounded-b-md bg-black/80 text-center text-[10px] font-bold leading-tight tabular-nums text-status-danger">
              {fmtTimer(remainingSeconds)}
            </span>
          </>
        ) : (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-status-info/40 bg-status-info shadow-[0_0_6px_rgb(110_181_255/0.7)]"
            aria-hidden
          />
        )}
      </span>
    </button>
  );
}
