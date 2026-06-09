"""Read and parse the TBH: Task Bar Hero save file into an XP snapshot.

Decrypted save structure (relevant parts):
    {
      "PlayerSaveData": { "value": "<json string>" },
      "AccountSaveData": {...},
      "SystemInfo": {...}
    }
    PlayerSaveData.value (nested JSON) contains:
      - heroSaveDatas: [ { heroKey, HeroLevel, HeroExp, IsUnLock, ... }, ... ]
      - cubeSaveLevelData: { Level, Exp }
      - commonSaveData: { playTime, ... }
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from typing import Optional

from . import es3

# Currency key for gold (the game's single currency).
GOLD_KEY = 100001


@dataclass
class HeroSnapshot:
    key: str
    level: int
    exp: float
    unlocked: bool


@dataclass
class SaveSnapshot:
    heroes: list[HeroSnapshot] = field(default_factory=list)
    total_hero_exp: float = 0.0
    cube_level: int = 0
    cube_exp: float = 0.0
    play_time: float = 0.0
    save_mtime: float = 0.0
    stage_key: int = 0
    stage_wave: int = 0
    max_stage: int = 0
    gold: float = 0.0


class SaveReadError(Exception):
    """Raised when the save cannot be read (missing/locked/mid-write)."""


def _read_bytes_shared(path: str, retries: int = 4, delay: float = 0.05) -> bytes:
    """Read a file that another process (the game) may be writing to.

    Retries briefly on sharing violations / transient OS errors.
    """
    last_exc: Optional[Exception] = None
    for _ in range(retries):
        try:
            with open(path, "rb") as fh:
                return fh.read()
        except (PermissionError, OSError) as exc:
            last_exc = exc
            time.sleep(delay)
    raise SaveReadError(f"Could not read save file: {last_exc}")


def _unwrap_es3_entry(entry):
    """ES3 stores each top-level key as {"__type": ..., "value": <data>}.

    `value` is frequently a JSON string that must be parsed again.
    """
    if isinstance(entry, dict) and "value" in entry:
        value = entry["value"]
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("{") or stripped.startswith("["):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
        return value
    return entry


def parse_snapshot(decrypted_text: str, save_mtime: float = 0.0) -> SaveSnapshot:
    root = json.loads(decrypted_text)
    player = _unwrap_es3_entry(root.get("PlayerSaveData"))
    if not isinstance(player, dict):
        raise SaveReadError("PlayerSaveData missing or malformed.")

    snap = SaveSnapshot(save_mtime=save_mtime)

    heroes = player.get("heroSaveDatas") or []
    for h in heroes:
        if not isinstance(h, dict):
            continue
        try:
            exp = float(h.get("HeroExp", 0) or 0)
        except (TypeError, ValueError):
            exp = 0.0
        hero = HeroSnapshot(
            key=str(h.get("heroKey", "?")),
            level=int(h.get("HeroLevel", 0) or 0),
            exp=exp,
            unlocked=bool(h.get("IsUnLock", False)),
        )
        snap.heroes.append(hero)
        snap.total_hero_exp += hero.exp

    currencies = player.get("currenySaveDatas") or []
    if isinstance(currencies, list):
        for cur in currencies:
            if isinstance(cur, dict) and int(cur.get("Key", 0) or 0) == GOLD_KEY:
                try:
                    snap.gold = float(cur.get("Quantity", 0) or 0)
                except (TypeError, ValueError):
                    snap.gold = 0.0
                break

    cube = player.get("cubeSaveLevelData")
    if isinstance(cube, dict):
        try:
            snap.cube_level = int(cube.get("Level", 0) or 0)
            snap.cube_exp = float(cube.get("Exp", 0) or 0)
        except (TypeError, ValueError):
            pass

    common = player.get("commonSaveData")
    if isinstance(common, dict):
        try:
            snap.play_time = float(common.get("playTime", 0) or 0)
        except (TypeError, ValueError):
            pass
        try:
            snap.stage_key = int(common.get("currentStageKey", 0) or 0)
            snap.stage_wave = int(common.get("currentStageWave", 0) or 0)
            snap.max_stage = int(common.get("maxCompletedStage", 0) or 0)
        except (TypeError, ValueError):
            pass

    return snap


def read_snapshot(path: str, password: str = es3.DEFAULT_PASSWORD) -> SaveSnapshot:
    """Read, decrypt and parse the save file into a SaveSnapshot."""
    expanded = os.path.expandvars(os.path.expanduser(path))
    if not os.path.isfile(expanded):
        raise SaveReadError(f"Save file not found: {expanded}")
    mtime = os.path.getmtime(expanded)
    raw = _read_bytes_shared(expanded)
    try:
        text = es3.decrypt_to_text(raw, password)
    except es3.Es3Error as exc:
        raise SaveReadError(str(exc)) from exc
    try:
        return parse_snapshot(text, save_mtime=mtime)
    except json.JSONDecodeError as exc:
        raise SaveReadError(f"Decrypted data is not valid JSON: {exc}") from exc
