"""Always-on-top XP/hour tracker overlay for TBH: Task Bar Hero (Tkinter)."""

from __future__ import annotations

import csv
import os
import time
import tkinter as tk
import tkinter.font as tkfont

from .config import Config, load_config
from .save_reader import SaveReadError, read_snapshot
from .stages import stage_name
from .tracker import HistoryEntry, XpTracker

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- Theme ---------------------------------------------------------------
BG = "#0f1117"
PANEL = "#171a23"
CARD = "#1d212c"
BORDER = "#2a2f3d"
FG = "#e8eaf0"
MUTED = "#8b93a7"
ACCENT = "#5ad17a"      # XP green
ACCENT_DIM = "#3a8f54"
WARN = "#e0a64a"
ERR = "#e0614a"
BLUE = "#5aa9e0"
GOLD = "#e8c45a"

FONT = "Segoe UI"

# Hero key -> display name. Unknown keys fall back to the raw key.
HERO_NAMES = {
    "101": "Knight",
    "201": "Ranger",
    "301": "Sorcerer",
    "401": "Priest",
    "501": "Hunter",
    "601": "Slayer",
}


def hero_name(key: str) -> str:
    return HERO_NAMES.get(str(key), str(key))


def fmt_clock(ts: float) -> str:
    lt = time.localtime(ts)
    h = lt.tm_hour % 12 or 12
    ampm = "AM" if lt.tm_hour < 12 else "PM"
    return f"{h}:{lt.tm_min:02d}:{lt.tm_sec:02d} {ampm}"


def fmt_ago(seconds: float | None) -> str:
    if seconds is None:
        return "never"
    return f"{fmt_duration(seconds)} ago"


class ToolTip:
    """Lightweight hover tooltip for a widget."""

    def __init__(self, widget: tk.Widget, text: str):
        self.widget = widget
        self.text = text
        self.tip: tk.Toplevel | None = None
        widget.bind("<Enter>", self._show, add="+")
        widget.bind("<Leave>", self._hide, add="+")

    def _show(self, _event=None) -> None:
        if self.tip is not None or not self.text:
            return
        x = self.widget.winfo_rootx() + 14
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 4
        self.tip = tk.Toplevel(self.widget)
        self.tip.wm_overrideredirect(True)
        self.tip.wm_geometry(f"+{x}+{y}")
        self.tip.attributes("-topmost", True)
        tk.Label(self.tip, text=self.text, bg="#05070b", fg=FG, font=(FONT, 8),
                 justify="left", padx=8, pady=5, bd=1, relief="solid").pack()

    def _hide(self, _event=None) -> None:
        if self.tip is not None:
            self.tip.destroy()
            self.tip = None


def fmt_compact(n: float) -> str:
    n = float(n)
    sign = "-" if n < 0 else ""
    n = abs(n)
    if n >= 1_000_000_000:
        return f"{sign}{n / 1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"{sign}{n / 1_000_000:.2f}M"
    if n >= 1_000:
        return f"{sign}{n / 1_000:.2f}K"
    return f"{sign}{n:,.0f}"


def fmt_duration(seconds: float) -> str:
    seconds = int(max(0, seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


class TrackerApp:
    def __init__(self, root: tk.Tk, cfg: Config):
        self.root = root
        self.cfg = cfg
        self.tracker = XpTracker(
            rolling_window_seconds=cfg.rolling_window_minutes * 60.0,
            track_cube=cfg.track_cube_exp,
        )
        self.topmost = cfg.start_topmost
        self._drag = (0, 0)
        self._hero_rows: list[tuple[tk.Label, tk.Label]] = []
        self._error: str | None = None
        self._history_visible = True
        self._rendered_history = 0
        self._csv_path: str | None = None
        if cfg.log_history_csv:
            self._setup_csv_log()
            self.tracker.on_history = self._log_history
        self._build_ui()
        self._poll()
        self._tick()

    # --- CSV history log ------------------------------------------------
    def _setup_csv_log(self) -> None:
        log_dir = os.path.join(_PROJECT_ROOT, "logs")
        os.makedirs(log_dir, exist_ok=True)
        self._csv_path = os.path.join(log_dir, "xp_history.csv")
        if not os.path.exists(self._csv_path) or os.path.getsize(self._csv_path) == 0:
            with open(self._csv_path, "w", newline="", encoding="utf-8") as fh:
                csv.writer(fh).writerow(
                    ["timestamp", "delta_xp", "xp_per_hour", "total_xp", "stage_key", "map", "wave"]
                )

    def _log_history(self, e: HistoryEntry) -> None:
        if not self._csv_path:
            return
        with open(self._csv_path, "a", newline="", encoding="utf-8") as fh:
            csv.writer(fh).writerow([
                time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(e.wall_time)),
                round(e.delta), round(e.rate), round(e.total_xp),
                e.stage_key, stage_name(e.stage_key), e.stage_wave,
            ])

    # --- window setup ---------------------------------------------------
    def _build_ui(self) -> None:
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", self.topmost)
        self.root.configure(bg=BORDER)

        outer = tk.Frame(self.root, bg=BORDER, width=320)
        outer.pack(fill="both", expand=True, padx=1, pady=1)
        container = tk.Frame(outer, bg=BG)
        container.pack(fill="both", expand=True)

        self._build_header(container)
        self._build_hero_card(container)
        self._build_rate(container)
        self._build_stats(container)
        self._build_lastupdated(container)
        self._build_history(container)
        self._build_footer(container)

        # Size to content at a fixed width and place near the top-right corner.
        self._resize_to_content(place=True)

    def _resize_to_content(self, place: bool = False) -> None:
        self.root.update_idletasks()
        w = 320
        h = self.root.winfo_reqheight()
        if place:
            sw = self.root.winfo_screenwidth()
            x = max(0, sw - w - 24)
            self.root.geometry(f"{w}x{h}+{x}+48")
        else:
            self.root.geometry(f"{w}x{h}")

    def _build_header(self, parent: tk.Frame) -> None:
        header = tk.Frame(parent, bg=PANEL, height=34)
        header.pack(fill="x")
        header.pack_propagate(False)

        title = tk.Label(
            header, text="TBH  ·  XP TRACKER", bg=PANEL, fg=FG,
            font=(FONT, 9, "bold"), padx=12,
        )
        title.pack(side="left")

        for label, cmd, color in (
            ("\u2715", self.close, ERR),       # X
            ("\u21bb", self.reset_session, MUTED),  # reset
        ):
            b = tk.Label(header, text=label, bg=PANEL, fg=color,
                         font=(FONT, 11), padx=9, cursor="hand2")
            b.pack(side="right")
            b.bind("<Button-1>", lambda e, c=cmd: c())
            self._hover(b, color)

        self.pin_btn = tk.Label(header, text="\U0001f4cc", bg=PANEL,
                                fg=ACCENT if self.topmost else MUTED,
                                font=(FONT, 10), padx=8, cursor="hand2")
        self.pin_btn.pack(side="right")
        self.pin_btn.bind("<Button-1>", lambda e: self.toggle_pin())

        self.hist_btn = tk.Label(header, text="\u2630", bg=PANEL, fg=ACCENT,
                                 font=(FONT, 11), padx=8, cursor="hand2")
        self.hist_btn.pack(side="right")
        self.hist_btn.bind("<Button-1>", lambda e: self.toggle_history())

        # Dragging by the header.
        for widget in (header, title):
            widget.bind("<Button-1>", self._start_drag)
            widget.bind("<B1-Motion>", self._on_drag)

    def _build_rate(self, parent: tk.Frame) -> None:
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="x", pady=(10, 2))
        self.rate_var = tk.StringVar(value="0")
        self.rate_lbl = tk.Label(wrap, textvariable=self.rate_var, bg=BG, fg=ACCENT,
                                 font=(FONT, 34, "bold"))
        self.rate_lbl.pack()
        caption = tk.Label(wrap, text="XP / HOUR", bg=BG, fg=MUTED,
                           font=(FONT, 8, "bold"))
        caption.pack()
        tip = ("XP refreshes each time the game writes its save \u2014\n"
               "roughly every 1\u20132 minutes while it's running.\n"
               "The rate is held steady between updates.")
        ToolTip(self.rate_lbl, tip)
        ToolTip(caption, tip)

        self.gold_rate_var = tk.StringVar(value="0 gold / hr")
        self.gold_lbl = tk.Label(wrap, textvariable=self.gold_rate_var, bg=BG,
                                 fg=GOLD, font=(FONT, 12, "bold"))
        self.gold_lbl.pack(pady=(4, 0))
        ToolTip(self.gold_lbl,
                "Gold earned per hour.\nGold you spend is ignored, so this is\n"
                "accurate while farming, lower while spending.")

    def _build_stats(self, parent: tk.Frame) -> None:
        grid = tk.Frame(parent, bg=BG)
        grid.pack(fill="x", padx=10, pady=8)
        self.stat_vars: dict[str, tk.StringVar] = {}
        cells = [
            ("GAINED", "gained"),
            ("ELAPSED", "elapsed"),
            ("AVG / HR", "avg"),
            ("TOTAL XP", "total"),
        ]
        for i, (label, key) in enumerate(cells):
            r, c = divmod(i, 2)
            grid.columnconfigure(c, weight=1)
            card = tk.Frame(grid, bg=CARD)
            card.grid(row=r, column=c, sticky="nsew", padx=3, pady=3, ipady=4)
            var = tk.StringVar(value="-")
            self.stat_vars[key] = var
            tk.Label(card, textvariable=var, bg=CARD, fg=FG,
                     font=(FONT, 13, "bold")).pack(pady=(4, 0))
            tk.Label(card, text=label, bg=CARD, fg=MUTED,
                     font=(FONT, 7, "bold")).pack(pady=(0, 2))

    def _build_lastupdated(self, parent: tk.Frame) -> None:
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="x", padx=13, pady=(2, 4))
        self.updated_var = tk.StringVar(value="Last updated: never")
        tk.Label(wrap, textvariable=self.updated_var, bg=BG, fg=MUTED,
                 font=(FONT, 9), anchor="w").pack(side="left")

        reset = tk.Label(wrap, text="\u21bb Reset", bg=CARD, fg=FG,
                         font=(FONT, 8, "bold"), padx=10, pady=3, cursor="hand2")
        reset.pack(side="right")
        reset.bind("<Button-1>", lambda e: self.reset_session())
        reset.bind("<Enter>", lambda e: reset.config(bg=ACCENT, fg=BG), add="+")
        reset.bind("<Leave>", lambda e: reset.config(bg=CARD, fg=FG), add="+")

    def _build_history(self, parent: tk.Frame) -> None:
        self.history_wrap = tk.Frame(parent, bg=BG)
        self.history_wrap.pack(fill="both", expand=True, padx=13, pady=(2, 6))
        tk.Label(self.history_wrap, text="HISTORY  ·  XP CHANGES", bg=BG, fg=MUTED,
                 font=(FONT, 7, "bold")).pack(anchor="w")

        box = tk.Frame(self.history_wrap, bg=PANEL)
        box.pack(fill="both", expand=True, pady=(3, 0))
        scroll = tk.Scrollbar(box, orient="vertical")
        scroll.pack(side="right", fill="y")
        self.history_text = tk.Text(
            box, height=8, bg=PANEL, fg=FG, bd=0, highlightthickness=0,
            font=("Consolas", 8), wrap="none", padx=8, pady=6,
            yscrollcommand=scroll.set, cursor="arrow",
        )
        self.history_text.pack(side="left", fill="both", expand=True)
        scroll.config(command=self.history_text.yview)
        self.history_text.tag_configure("delta", foreground=ACCENT)
        self.history_text.tag_configure("map", foreground=BLUE)
        self.history_text.tag_configure("muted", foreground=MUTED)
        self.history_text.tag_configure("empty", foreground="#525a6e")
        self.history_text.bind("<MouseWheel>",
                               lambda e: self.history_text.yview_scroll(int(-e.delta / 120), "units"))
        self.history_text.configure(state="disabled")

    def _build_hero_card(self, parent: tk.Frame) -> None:
        self.hero_wrap = tk.Frame(parent, bg=BG)
        self.hero_wrap.pack(fill="x", padx=13, pady=(8, 2))
        tk.Label(self.hero_wrap, text="HEROES", bg=BG, fg=MUTED,
                 font=(FONT, 7, "bold")).pack(anchor="w")
        self.hero_box = tk.Frame(self.hero_wrap, bg=BG)
        self.hero_box.pack(fill="x")

    def _build_footer(self, parent: tk.Frame) -> None:
        footer = tk.Frame(parent, bg=PANEL, height=26)
        footer.pack(fill="x", side="bottom")
        footer.pack_propagate(False)
        self.status_dot = tk.Label(footer, text="\u25cf", bg=PANEL, fg=MUTED,
                                   font=(FONT, 9), padx=8)
        self.status_dot.pack(side="left")
        self.status_var = tk.StringVar(value="starting\u2026")
        tk.Label(footer, textvariable=self.status_var, bg=PANEL, fg=MUTED,
                 font=(FONT, 8)).pack(side="left")

    # --- interactions ---------------------------------------------------
    def _hover(self, widget: tk.Label, base: str) -> None:
        widget.bind("<Enter>", lambda e: widget.config(fg=FG), add="+")
        widget.bind("<Leave>", lambda e: widget.config(fg=base), add="+")

    def _start_drag(self, event) -> None:
        self._drag = (event.x_root - self.root.winfo_x(),
                      event.y_root - self.root.winfo_y())

    def _on_drag(self, event) -> None:
        x = event.x_root - self._drag[0]
        y = event.y_root - self._drag[1]
        self.root.geometry(f"+{x}+{y}")

    def toggle_pin(self) -> None:
        self.topmost = not self.topmost
        self.root.attributes("-topmost", self.topmost)
        self.pin_btn.config(fg=ACCENT if self.topmost else MUTED)

    def reset_session(self) -> None:
        self.tracker.reset()
        self.tracker.on_history = self._log_history if self._csv_path else None
        self._rendered_history = -1  # force history redraw (clears the list)
        # Refresh the on-screen values immediately (don't wait for the next poll).
        self.rate_var.set("0")
        self.gold_rate_var.set("0 gold / hr")
        self.stat_vars["gained"].set("0")
        self.stat_vars["avg"].set("0")
        self.stat_vars["elapsed"].set("00:00")
        self._render_history()
        self.status_var.set("tracker reset")

    def toggle_history(self) -> None:
        self._history_visible = not self._history_visible
        if self._history_visible:
            self.history_wrap.pack(fill="both", expand=True, padx=13, pady=(2, 6))
            self.hist_btn.config(fg=ACCENT)
        else:
            self.history_wrap.pack_forget()
            self.hist_btn.config(fg=MUTED)
        self._resize_to_content()

    def close(self) -> None:
        self.root.destroy()

    # --- polling loop ---------------------------------------------------
    def _poll(self) -> None:
        """Re-read the save and refresh value-based widgets (every poll interval)."""
        interval_ms = max(1000, int(self.cfg.poll_interval_seconds * 1000))
        try:
            snap = read_snapshot(self.cfg.expanded_save_path, self.cfg.es3_password)
            self.tracker.update(snap)
            self._error = None
            self._render_values()
        except SaveReadError as exc:
            self._error = str(exc)
        except Exception as exc:  # pragma: no cover - defensive
            self._error = f"unexpected: {exc}"
        self.root.after(interval_ms, self._poll)

    def _tick(self) -> None:
        """Refresh time-based widgets every second (elapsed clock + status)."""
        self.stat_vars["elapsed"].set(fmt_duration(self.tracker.elapsed))
        # "Last updated" = time since XP last changed (not since the last file read).
        since = self.tracker.seconds_since_gain
        self.updated_var.set(f"Last updated: {fmt_ago(since)}")
        self._render_status()
        self.root.after(1000, self._tick)

    def _render_values(self) -> None:
        t = self.tracker
        self.rate_var.set(fmt_compact(t.rolling_rate))
        self.gold_rate_var.set(f"{fmt_compact(t.gold_rolling_rate)} gold / hr")
        self.stat_vars["gained"].set(fmt_compact(t.cumulative_gained))
        self.stat_vars["avg"].set(fmt_compact(t.session_rate))
        self.stat_vars["total"].set(fmt_compact(t.current_total_xp))

        self._render_history()
        self._render_heroes(t.heroes)

    def _render_history(self) -> None:
        if len(self.tracker.history) == self._rendered_history:
            return
        self._rendered_history = len(self.tracker.history)
        txt = self.history_text
        txt.configure(state="normal")
        txt.delete("1.0", "end")
        if not self.tracker.history:
            txt.insert("end", "no XP changes recorded yet\u2026", ("empty",))
        else:
            # Newest first.
            for e in reversed(self.tracker.history):
                clock = fmt_clock(e.wall_time)
                txt.insert("end", f"{clock:<12}", ("muted",))
                txt.insert("end", f" +{fmt_compact(e.delta):<7}", ("delta",))
                txt.insert("end", f" {fmt_compact(e.rate)}/hr", ())
                txt.insert("end", f"  {stage_name(e.stage_key, e.stage_wave)}\n", ("map",))
        txt.configure(state="disabled")

    def _render_status(self) -> None:
        if self._error:
            self.status_dot.config(fg=WARN if "not found" in self._error.lower() else ERR)
            msg = self._error
            self.status_var.set(msg if len(msg) < 52 else msg[:49] + "\u2026")
            return
        idle = self.tracker.seconds_since_gain
        if idle is not None and idle > 120:
            self.status_dot.config(fg=WARN)
            self.status_var.set(f"no XP for {fmt_duration(idle)} \u2013 is the game running?")
        elif self.tracker.last_update is not None:
            self.status_dot.config(fg=ACCENT)
            updated = time.strftime("%H:%M:%S", time.localtime(self.tracker.last_update))
            self.status_var.set(f"live \u00b7 updated {updated}")
        else:
            self.status_dot.config(fg=MUTED)
            self.status_var.set("starting\u2026")

    def _render_heroes(self, heroes) -> None:
        active = [h for h in heroes if h.unlocked or h.exp > 0]
        active = active or list(heroes)
        # Rebuild rows if hero count changed.
        if len(self._hero_rows) != len(active):
            for child in self.hero_box.winfo_children():
                child.destroy()
            self._hero_rows = []
            for _ in active:
                row = tk.Frame(self.hero_box, bg=BG)
                row.pack(fill="x", pady=1)
                name = tk.Label(row, bg=BG, fg=FG, font=(FONT, 9), anchor="w")
                name.pack(side="left")
                val = tk.Label(row, bg=BG, fg=MUTED, font=(FONT, 9), anchor="e")
                val.pack(side="right")
                self._hero_rows.append((name, val))
        for (name, val), h in zip(self._hero_rows, active):
            name.config(text=f"{hero_name(h.key)}  Lv {h.level}")
            rate = self.tracker.hero_rate(h.key)
            val.config(text=f"{fmt_compact(rate)} xp/hr", fg=ACCENT if rate > 0 else MUTED)

def main() -> None:
    cfg = load_config()
    root = tk.Tk()
    root.title("TBH XP Tracker")
    try:
        tkfont.nametofont("TkDefaultFont")
    except tk.TclError:
        pass
    TrackerApp(root, cfg)
    root.mainloop()


if __name__ == "__main__":
    main()
