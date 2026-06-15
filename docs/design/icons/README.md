# TBH Rzd icons

Distinct from upstream TBH Companion branding.

| File | Use |
|------|-----|
| `rzd-icon-512.png` | Master (edit this, then rebuild) |
| `rzd-icon-256.png` | Window + taskbar at runtime (Electron) |
| `rzd-icon.ico` | NSIS installer + `.exe` file icon only (not loaded at runtime) |
| `tray-icon-32.png` | System tray |

Regenerate derivatives after editing the master:

```bash
cd app && npm run build:icons
```

Requires `sharp` and `to-ico` (installed at repo root when you run the script).

Legacy `companion-icon.*` files are unused; safe to delete.
