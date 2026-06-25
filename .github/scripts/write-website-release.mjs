#!/usr/bin/env node
/**
 * Writes website/data/release.json from built release artifacts in app/release/.
 * Prefers the portable zip (extract & run) over the NSIS installer when present.
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

const portableZip = readdirSync(releaseDir).find((name) => name.endsWith("-portable.zip"));
const installerExe = readdirSync(releaseDir).find(
  (name) => name.endsWith(".exe") && !name.endsWith(".blockmap"),
);

if (!portableZip && !installerExe) {
  console.error("No portable zip or installer .exe found in app/release");
  process.exit(1);
}

const primary = portableZip ?? installerExe;
const sizeBytes = statSync(join(releaseDir, primary)).size;
const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${primary}`;

const manifest = {
  version: tag,
  downloadUrl,
  fileName: primary,
  sizeBytes,
  kind: portableZip ? "portable" : "installer",
};

if (installerExe && installerExe !== primary) {
  manifest.installerUrl = `https://github.com/${repo}/releases/download/${tag}/${installerExe}`;
  manifest.installerFileName = installerExe;
  manifest.installerSizeBytes = statSync(join(releaseDir, installerExe)).size;
}

writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("Wrote", outPath);
