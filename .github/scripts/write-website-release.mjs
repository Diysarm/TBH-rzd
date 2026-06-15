#!/usr/bin/env node
/**
 * Writes website/data/release.json from a built NSIS installer in app/release/.
 * Used by the Release workflow so the landing page has a direct .exe link without
 * relying on the GitHub API in the browser.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.env.GITHUB_REPOSITORY || "Diysarm/TBH-rzd";
const tag = process.env.RELEASE_TAG;
const version = process.env.RELEASE_VERSION;
const releaseDir = join(process.cwd(), "app", "release");
const outPath = join(process.cwd(), "website", "data", "release.json");

if (!tag || !version) {
  console.error("RELEASE_TAG and RELEASE_VERSION env vars are required");
  process.exit(1);
}

const exe = readdirSync(releaseDir).find((name) => name.endsWith(".exe") && !name.endsWith(".blockmap"));
if (!exe) {
  console.error("No installer .exe found in app/release");
  process.exit(1);
}

const sizeBytes = statSync(join(releaseDir, exe)).size;
const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${exe}`;

const manifest = {
  version: tag,
  downloadUrl,
  fileName: exe,
  sizeBytes,
};

writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("Wrote", outPath);
