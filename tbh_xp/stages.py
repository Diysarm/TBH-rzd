"""Decode TBH stage keys into human-readable map names.

Stage keys are 4-digit numbers encoding Difficulty | Act | Stage, e.g.
    3205 -> difficulty 3 (Hell),  act 2, stage 5   -> "Hell 2-5"
    2309 -> difficulty 2 (Nightmare), act 3, stage 9 -> "Nightmare 3-9"

(Inferred from the save + the in-game difficulty tiers Normal/Nightmare/Hell/
Torment. If a displayed map ever looks wrong, this mapping is the place to fix.)
"""

from __future__ import annotations

DIFFICULTIES = {1: "Normal", 2: "Nightmare", 3: "Hell", 4: "Torment"}


def stage_name(key: int, wave: int | None = None) -> str:
    try:
        key = int(key)
    except (TypeError, ValueError):
        return "?"
    if key <= 0:
        return "?"
    difficulty = key // 1000
    act = (key // 100) % 10
    stage = key % 100
    diff = DIFFICULTIES.get(difficulty, f"D{difficulty}")
    name = f"{diff} {act}-{stage}"
    if wave:
        name += f" (w{wave})"
    return name
