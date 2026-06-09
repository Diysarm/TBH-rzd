"""Headless self-test: verify the save decrypts and XP can be read.

Run:  python -m tbh_xp.selftest
Prints only aggregate numbers (no personal save contents).
"""

from __future__ import annotations

from .config import load_config
from .save_reader import SaveReadError, read_snapshot


def main() -> int:
    cfg = load_config()
    print(f"save path : {cfg.expanded_save_path}")
    try:
        snap = read_snapshot(cfg.expanded_save_path, cfg.es3_password)
    except SaveReadError as exc:
        print(f"FAILED    : {exc}")
        return 1

    unlocked = [h for h in snap.heroes if h.unlocked or h.exp > 0]
    print("decrypt   : OK")
    print(f"heroes    : {len(snap.heroes)} ({len(unlocked)} active)")
    for h in unlocked:
        print(f"   {h.key:<14} Lv {h.level:<3} exp={h.exp:,.0f}")
    print(f"total hero xp : {snap.total_hero_exp:,.0f}")
    print(f"cube          : Lv {snap.cube_level} exp={snap.cube_exp:,.0f}")
    print(f"gold          : {snap.gold:,.0f}")
    print(f"play time     : {snap.play_time/3600:.1f} h")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
