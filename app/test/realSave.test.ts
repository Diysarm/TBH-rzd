import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSnapshot } from "../src/core/saveReader";

// Integration test against the actual local save. Skipped automatically when
// the file isn't present (e.g. CI), so the suite stays deterministic.
const savePath = join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  "AppData",
  "LocalLow",
  "TesseractStudio",
  "TaskbarHero",
  "SaveFile_Live.es3",
);

const run = existsSync(savePath) ? describe : describe.skip;

run("real save (local only)", () => {
  it("decrypts and parses the live save", () => {
    const snap = readSnapshot(savePath);
    expect(snap.heroes.length).toBeGreaterThan(0);
    expect(snap.saveMtime).toBeGreaterThan(0);
    // Gold is the only currency; total hero XP should be non-negative.
    expect(snap.totalHeroExp).toBeGreaterThanOrEqual(0);
    expect(snap.gold).toBeGreaterThanOrEqual(0);
  });
});
