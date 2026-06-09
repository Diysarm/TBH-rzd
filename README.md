# TBH XP Tracker

A lightweight **Windows overlay** that tracks your **XP per hour** in
[*TBH: Task Bar Hero*](https://taskbarhero.org/) by reading the game's local
save file. It runs alongside the game, shows a live XP/hour and gold/hour
readout, session totals, a per-hero breakdown, and a scrollable history of every
XP change with the map you were on.

## How it works

The game stores progress in an [Easy Save 3](https://moodkie.com/easy-save/)
file:

```
%USERPROFILE%\AppData\LocalLow\TesseractStudio\TaskbarHero\SaveFile_Live.es3
```

That file is **AES-encrypted**. The tracker decrypts it locally with the scheme
used by the game:

- Layout: `[16-byte IV/salt][AES-CBC ciphertext]`
- Key: `PBKDF2-HMAC-SHA1(password, salt = IV, iterations = 100, 16 bytes)`
- Cipher: `AES-128-CBC` + PKCS7, plaintext is UTF-8 JSON

XP is read from `PlayerSaveData.heroSaveDatas[*].HeroExp`. The tracker watches
the **total hero XP** and computes the rate from the change over time. Because a
hero's XP can reset on level-up, gains are accumulated from positive deltas only
(a drop is treated as a level-up and the post-reset value is counted), so the
running total stays correct either way.

> **Note on update cadence:** the game only writes the save every minute or two,
> so XP/hour updates in steps. The rate is measured against the save file's
> write time (not the poll time) and is **held steady between updates** — it only
> changes when your XP actually changes, so it never drifts down just because
> time passed. The 5-minute rolling window averages out recent saves.

## Requirements

- Windows 10/11
- Python 3.12 (installed during setup)
- The game running (so the save keeps updating)

Everything lives in a self-contained virtual environment in `.venv/`.

## Setup (already done if I set it up for you)

```powershell
# from the project folder
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Run

- **Double-click `run.cmd`** — launches the overlay with no console window.
- `run-debug.cmd` — same, but keeps a console open so you can see any errors.
- Self-test (no GUI, prints aggregate numbers only):

```powershell
.\.venv\Scripts\python.exe -m tbh_xp.selftest
```

## Using the overlay

- Drag it anywhere by its title bar.
- Buttons (top-right): **☰** show/hide history, **pin** (toggle always-on-top),
  **↻** reset the session, **✕** close.
- **XP / HOUR** big number, with **gold / hour** right below it. Hover either
  for a tooltip explaining the update cadence. Gold/hour counts gold *earned*
  only — gold you spend (upgrades, Cube, runes) is ignored, so it's accurate
  while farming and lower while spending.
- **HEROES** list — each active hero shows its level and its own **XP/hour**.
- **Last updated: Ns ago** — a live counter of how long since your XP last
  actually changed (resets to 0 only when new XP comes in).
- The idle warning appears after **2 minutes** with no XP gain.
- **HISTORY · XP CHANGES** — a scrollable list, newest first, with one row per
  save that gained XP:

  ```
  6:46:15 PM   +1.2M    9.7M/hr   Hell 2-5
  ```

  i.e. the time, the XP gained on that read, the XP/hour at that moment, and the
  map (difficulty + act-stage, with the wave). Use the ☰ button to collapse it.
- The footer shows live status; it warns if no XP has been gained for a while
  (e.g. the game isn't actively fighting).

### History log (CSV)

With `logHistoryCsv` enabled (default), every XP change is also appended to
`logs/xp_history.csv` (timestamp, delta, xp/hour, total xp, stage key, map,
wave) so you have a full history beyond what's on screen.

## Configuration — `config.json`

| Key | Meaning | Default |
| --- | --- | --- |
| `savePath` | Path to `SaveFile_Live.es3` (env vars allowed) | LocalLow path |
| `es3Password` | ES3 decryption password | the game's built-in password |
| `pollIntervalSeconds` | How often to re-read the save | `5` |
| `rollingWindowMinutes` | Window for the "XP/hour" figure | `5` |
| `trackCubeExp` | Also count Hero-dric Cube XP | `false` |
| `startTopmost` | Start pinned on top | `true` |
| `logHistoryCsv` | Append every XP change to `logs/xp_history.csv` | `true` |

### If decryption stops working after a game update

The developer can change the ES3 password in a patch. If that happens the
overlay's status line will read *"wrong password or not a TaskbarHero save"*.
The community [Save Inspector](https://taskbarhero.wiki/save-inspector)
typically tracks the current password — update `es3Password` in `config.json`
and restart.

## Project layout

```
config.json            # user settings
requirements.txt
run.cmd / run-debug.cmd # launchers
tbh_xp/
  es3.py               # ES3 AES decryption
  save_reader.py       # decrypt + parse save -> snapshot
  stages.py            # decode stage keys -> "Hell 2-5"
  tracker.py           # session + rolling XP/hour math + history
  app.py               # Tkinter overlay UI
  selftest.py          # headless verification
logs/xp_history.csv    # appended history (created at runtime)
```

## Disclaimer

This is a fan-made, read-only tool. It only **reads** your own local save file
to display statistics; it never modifies the save or talks to the game/servers.
Not affiliated with or endorsed by Nugem Studio / Tesseract Studio.
