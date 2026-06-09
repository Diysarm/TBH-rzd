"""Session and rate tracking for XP gained over time.

The tracked metric is total hero XP gained (optionally including the Cube's XP).

Two design points keep the XP/hour figure honest:

1. Rates are measured against the *save file's modification time* (when the game
   actually wrote that XP), not against when we happened to poll. The game only
   writes the save every minute or two, so polling-based timing would make the
   rate decay between writes even though no time-relevant XP was lost.

2. The rate is only recomputed when XP actually changes. Between changes the
   value is held constant, so it never drifts downward just because wall-clock
   time advanced.

We also never trust the absolute XP number to be monotonic: a hero's `HeroExp`
may reset on level-up. Gains are accumulated from positive deltas only; a drop
is treated as a reset and the new post-reset value is counted as the gain.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass

from .save_reader import SaveSnapshot

# How many history entries (XP-changing reads) to keep in memory.
HISTORY_LIMIT = 500


@dataclass
class HistoryEntry:
    wall_time: float       # when we read it (epoch seconds)
    delta: float           # XP gained on this read
    rate: float            # XP/hour at this point (rolling)
    total_xp: float        # tracked total XP after this read
    stage_key: int         # current map/stage key
    stage_wave: int        # current wave


class _RateMeter:
    """Tracks a monotonic 'gained' total and a rolling per-hour rate.

    Samples are timestamped by save-write time and only added on positive gain,
    so the rate is held steady between changes (see module docstring).
    """

    def __init__(self, window: float):
        self.window = window
        self.gained = 0.0
        self.samples: deque[tuple[float, float]] = deque()
        self.rolling = 0.0

    def init(self, mtime: float) -> None:
        self.samples.append((mtime, 0.0))

    def add(self, gain: float, mtime: float) -> None:
        if gain <= 0:
            return
        self.gained += gain
        self.samples.append((mtime, self.gained))
        while len(self.samples) > 2 and (mtime - self.samples[0][0]) > self.window:
            self.samples.popleft()
        if len(self.samples) >= 2:
            t0, g0 = self.samples[0]
            t1, g1 = self.samples[-1]
            dt = t1 - t0
            if dt > 0:
                self.rolling = (g1 - g0) / dt * 3600.0


def _delta_gain(prev: float | None, current: float) -> float:
    """XP gained between two readings of one accumulator."""
    if prev is None:
        return 0.0
    d = current - prev
    if d >= 0:
        return d
    # Value dropped -> treat as a reset (e.g. level-up). Count what's accrued since.
    return max(current, 0.0)


class XpTracker:
    def __init__(self, rolling_window_seconds: float = 300.0, track_cube: bool = False):
        self.rolling_window = max(10.0, float(rolling_window_seconds))
        self.track_cube = bool(track_cube)
        self.reset()

    def reset(self) -> None:
        now = time.time()
        self.session_start = now
        self.cumulative_gained = 0.0
        self._prev_hero: dict[str, float] = {}
        self._hero_meters: dict[str, _RateMeter] = {}
        self._prev_cube: float | None = None
        # Samples are (save_mtime, cumulative_gained), recorded only on change.
        self._samples: deque[tuple[float, float]] = deque()
        self._initialized = False
        self._first_mtime: float | None = None
        self._last_change_mtime: float | None = None
        self.current_total_xp = 0.0
        self.last_update: float | None = None
        self.last_gain_time: float | None = None  # wall-clock, for idle detection
        self.heroes: list = []
        # Cached rates; only updated when XP actually changes.
        self._rolling_rate = 0.0
        self._session_rate = 0.0
        # History of XP-changing reads (newest appended at the end).
        self.history: deque[HistoryEntry] = deque(maxlen=HISTORY_LIMIT)
        self.on_history: callable | None = None  # optional callback(HistoryEntry)
        # Gold tracking (gold is spent, so we only count positive changes = earned).
        self.current_gold = 0.0
        self.gold_gained = 0.0
        self._prev_gold: float | None = None
        self._gold_samples: deque[tuple[float, float]] = deque()
        self._gold_first_mtime: float | None = None
        self._gold_last_change_mtime: float | None = None
        self._gold_rolling_rate = 0.0
        self._gold_session_rate = 0.0

    def update(self, snap: SaveSnapshot) -> float:
        """Incorporate a new snapshot. Returns XP gained since last update."""
        now = time.time()
        mtime = snap.save_mtime or now
        self.heroes = snap.heroes
        self.current_total_xp = snap.total_hero_exp + (snap.cube_exp if self.track_cube else 0.0)
        self.current_gold = snap.gold

        if not self._initialized:
            for h in snap.heroes:
                self._prev_hero[h.key] = h.exp
                meter = _RateMeter(self.rolling_window)
                meter.init(mtime)
                self._hero_meters[h.key] = meter
            self._prev_cube = snap.cube_exp
            self._prev_gold = snap.gold
            self._initialized = True
            self._first_mtime = mtime
            self._last_change_mtime = mtime
            self._samples.append((mtime, 0.0))
            self._gold_first_mtime = mtime
            self._gold_last_change_mtime = mtime
            self._gold_samples.append((mtime, 0.0))
            self.last_update = now
            return 0.0

        self._update_gold(snap.gold, mtime)

        gain = 0.0
        for h in snap.heroes:
            hero_gain = _delta_gain(self._prev_hero.get(h.key), h.exp)
            gain += hero_gain
            self._prev_hero[h.key] = h.exp
            meter = self._hero_meters.get(h.key)
            if meter is None:
                meter = _RateMeter(self.rolling_window)
                meter.init(mtime)
                self._hero_meters[h.key] = meter
            meter.add(hero_gain, mtime)

        if self.track_cube:
            gain += _delta_gain(self._prev_cube, snap.cube_exp)
            self._prev_cube = snap.cube_exp

        if gain > 0:
            self.cumulative_gained += gain
            self.last_gain_time = now
            self._last_change_mtime = mtime
            self._samples.append((mtime, self.cumulative_gained))
            self._prune(mtime)
            self._recompute_rates()

            entry = HistoryEntry(
                wall_time=now,
                delta=gain,
                rate=self._rolling_rate,
                total_xp=self.current_total_xp,
                stage_key=snap.stage_key,
                stage_wave=snap.stage_wave,
            )
            self.history.append(entry)
            if self.on_history is not None:
                try:
                    self.on_history(entry)
                except Exception:  # pragma: no cover - never let logging break tracking
                    pass

        self.last_update = now
        return gain

    def _update_gold(self, gold: float, mtime: float) -> None:
        # Gold is spent as well as earned; count only positive changes (earned).
        gain = gold - self._prev_gold if self._prev_gold is not None else 0.0
        self._prev_gold = gold
        if gain <= 0:
            return
        self.gold_gained += gain
        self._gold_last_change_mtime = mtime
        self._gold_samples.append((mtime, self.gold_gained))
        while (len(self._gold_samples) > 2
               and (mtime - self._gold_samples[0][0]) > self.rolling_window):
            self._gold_samples.popleft()
        if len(self._gold_samples) >= 2:
            t0, g0 = self._gold_samples[0]
            t1, g1 = self._gold_samples[-1]
            dt = t1 - t0
            if dt > 0:
                self._gold_rolling_rate = (g1 - g0) / dt * 3600.0
        if self._gold_first_mtime is not None and self._gold_last_change_mtime is not None:
            span = self._gold_last_change_mtime - self._gold_first_mtime
            if span > 0:
                self._gold_session_rate = self.gold_gained / span * 3600.0

    def _prune(self, ref_mtime: float) -> None:
        while len(self._samples) > 2 and (ref_mtime - self._samples[0][0]) > self.rolling_window:
            self._samples.popleft()

    def _recompute_rates(self) -> None:
        # Rolling rate: XP gained across the recent window, over the save-time span.
        if len(self._samples) >= 2:
            t0, g0 = self._samples[0]
            t1, g1 = self._samples[-1]
            dt = t1 - t0
            if dt > 0:
                self._rolling_rate = (g1 - g0) / dt * 3600.0
        # Session rate: total gained over the whole save-time span (time spent playing).
        if self._first_mtime is not None and self._last_change_mtime is not None:
            span = self._last_change_mtime - self._first_mtime
            if span > 0:
                self._session_rate = self.cumulative_gained / span * 3600.0

    @property
    def elapsed(self) -> float:
        """Real wall-clock time since the session started (a running clock)."""
        return time.time() - self.session_start

    @property
    def session_rate(self) -> float:
        """Average XP/hour over time actually spent playing (held between changes)."""
        return self._session_rate

    @property
    def rolling_rate(self) -> float:
        """Recent XP/hour (held constant between XP changes)."""
        return self._rolling_rate

    def hero_rate(self, key: str) -> float:
        """Recent XP/hour for a single hero (0 if not tracked yet)."""
        meter = self._hero_meters.get(key)
        return meter.rolling if meter is not None else 0.0

    @property
    def gold_rolling_rate(self) -> float:
        """Recent gold/hour earned (held constant between gold changes)."""
        return self._gold_rolling_rate

    @property
    def gold_session_rate(self) -> float:
        return self._gold_session_rate

    @property
    def seconds_since_gain(self) -> float | None:
        if self.last_gain_time is None:
            return None
        return time.time() - self.last_gain_time

    @property
    def seconds_since_read(self) -> float | None:
        if self.last_update is None:
            return None
        return time.time() - self.last_update
