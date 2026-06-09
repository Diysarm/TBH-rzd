# Decisions (ADR log)

Terse record of architectural decisions. Newest first.

## 2026-06 - All-TypeScript (Electron + React) over Python + web UI

The hard part (ES3 decryption + save reverse-engineering) is solved and the
scheme is fully known. Node's built-in `crypto` reproduces it
(PBKDF2-SHA1 + AES-128-CBC) with no native deps, so the only reason to stay on
Python is gone. Going single-language removes the Python venv + FastAPI/
WebSocket bridge and ships one runtime. Decision: port `core/` to TypeScript;
keep `tbh_xp/` as a reference until parity, then remove it.

## 2026-06 - Electron over Tauri for the desktop shell

Goal was to stop mixing languages. Tauri's shell is Rust, which reintroduces a
second toolchain. Electron is pure JS/TS with the most mature desktop APIs
(always-on-top overlay, multi-window, tray, single-exe packaging). Accepted the
larger bundle (~150MB) as fine for a desktop tool.

## 2026-06 - IPC over a local HTTP server

For a single desktop app the renderer talks to main directly via Electron IPC
(`contextBridge` preload). No need for a local HTTP/WebSocket server just to
reach our own UI.

## 2026-06 - Private GitHub repo

Repo `tbh-companion` starts private. The ES3 password is already public on the
community wiki, but a fan tool that reverse-engineers a game save is kept
private to start; can flip to public later.

## Earlier (Python prototype) - read the save file, not network traffic

TBH is an idle game that computes XP locally, so there is no useful network
traffic to sniff. Reading the local save file is the correct source. Kept as
the foundational decision behind the whole project.
