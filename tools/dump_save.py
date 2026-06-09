"""Decrypt the TBH save and write a readable JSON copy for inspection.

Usage (from project root):
    .venv/Scripts/python.exe tools/dump_save.py

Writes: sample/SaveFile_Live.decrypted.json
Also prints a structure summary and anything that looks chest/box related.

NOTE: the decrypted JSON contains your full local save, including account
identifiers (e.g. Steam id in SystemInfo/AccountSaveData). Keep it private.
"""

from __future__ import annotations

import json
import os
import sys

# Allow running as a loose script from the project root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tbh_xp import es3  # noqa: E402
from tbh_xp.config import load_config  # noqa: E402
from tbh_xp.save_reader import _read_bytes_shared, _unwrap_es3_entry  # noqa: E402

CHEST_HINT = ("box", "chest", "reward", "drop", "loot")


def summarize(obj, path="", out=None, depth=0):
    """Collect (path, kind, size) for dict/list nodes, shallow."""
    if out is None:
        out = []
    if depth > 3:
        return out
    if isinstance(obj, dict):
        out.append((path or "<root>", "object", len(obj)))
        for k, v in obj.items():
            summarize(v, f"{path}.{k}" if path else k, out, depth + 1)
    elif isinstance(obj, list):
        out.append((path, f"array[{len(obj)}]", len(obj)))
        if obj:
            summarize(obj[0], f"{path}[0]", out, depth + 1)
    return out


def main() -> int:
    cfg = load_config()
    raw = _read_bytes_shared(cfg.expanded_save_path)
    text = es3.decrypt_to_text(raw, cfg.es3_password)
    root = json.loads(text)

    readable = {k: _unwrap_es3_entry(v) for k, v in root.items()}

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(project_root, "sample")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "SaveFile_Live.decrypted.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(readable, fh, indent=2, ensure_ascii=False)
    print(f"wrote readable save -> {out_path}")
    print(f"size: {os.path.getsize(out_path):,} bytes\n")

    player = readable.get("PlayerSaveData", {})
    print("PlayerSaveData top-level keys:")
    if isinstance(player, dict):
        for k in player:
            v = player[k]
            kind = (f"array[{len(v)}]" if isinstance(v, list)
                    else "object" if isinstance(v, dict) else type(v).__name__)
            print(f"   - {k}  ({kind})")

    # Find chest/box-like structures anywhere in the player data.
    print("\nChest / box related keys found:")
    rows = summarize(player, "PlayerSaveData")
    hits = [r for r in rows if any(h in r[0].lower() for h in CHEST_HINT)]
    if hits:
        for path, kind, _ in hits:
            print(f"   - {path}  ({kind})")
    else:
        print("   (none with obvious chest/box names)")

    # Show the shape of BoxData specifically, if present.
    box = player.get("BoxData") if isinstance(player, dict) else None
    if box is not None:
        print("\nBoxData detail:")
        if isinstance(box, dict):
            for k, v in box.items():
                kind = (f"array[{len(v)}]" if isinstance(v, list)
                        else "object" if isinstance(v, dict) else f"{type(v).__name__}={v!r}")
                print(f"   {k}: {kind}")
        elif isinstance(box, list) and box:
            print(f"   array of {len(box)}; first item keys: "
                  f"{list(box[0].keys()) if isinstance(box[0], dict) else type(box[0]).__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
