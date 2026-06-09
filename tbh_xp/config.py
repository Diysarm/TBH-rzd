"""Load tracker configuration from config.json (project root)."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

from . import es3

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CONFIG_PATH = os.path.join(_PROJECT_ROOT, "config.json")

_DEFAULT_SAVE = (
    r"%USERPROFILE%\AppData\LocalLow\TesseractStudio\TaskbarHero\SaveFile_Live.es3"
)


@dataclass
class Config:
    save_path: str = _DEFAULT_SAVE
    es3_password: str = es3.DEFAULT_PASSWORD
    poll_interval_seconds: float = 5.0
    rolling_window_minutes: float = 5.0
    track_cube_exp: bool = False
    start_topmost: bool = True
    log_history_csv: bool = True

    @property
    def expanded_save_path(self) -> str:
        return os.path.expandvars(os.path.expanduser(self.save_path))


def load_config(path: str = _CONFIG_PATH) -> Config:
    cfg = Config()
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return cfg

    cfg.save_path = str(data.get("savePath", cfg.save_path))
    cfg.es3_password = str(data.get("es3Password", cfg.es3_password)) or es3.DEFAULT_PASSWORD
    cfg.poll_interval_seconds = float(data.get("pollIntervalSeconds", cfg.poll_interval_seconds))
    cfg.rolling_window_minutes = float(data.get("rollingWindowMinutes", cfg.rolling_window_minutes))
    cfg.track_cube_exp = bool(data.get("trackCubeExp", cfg.track_cube_exp))
    cfg.start_topmost = bool(data.get("startTopmost", cfg.start_topmost))
    cfg.log_history_csv = bool(data.get("logHistoryCsv", cfg.log_history_csv))
    return cfg
