# TBH Rzd

Fork of [lucasfevi/tbh-companion](https://github.com/lucasfevi/tbh-companion) — repo: [Diysarm/TBH-rzd](https://github.com/Diysarm/TBH-rzd).

## Clear time

Per tracked chest level, set **Clear time (s)** on the Chests tab:

```
effective cooldown = base cooldown − clear time
```

Example: 13 min (780s) base and 200s clear → **9m 40s** until ready.

## Run

```bash
cd app
npm install
npm run dev
```
