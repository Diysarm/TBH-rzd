#!/usr/bin/env node
/** Rasterize TBH Rzd icon assets from rzd-icon-512.png (run after updating the master PNG). */
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "docs", "design", "icons");
const master = join(iconsDir, "rzd-icon-512.png");

if (!existsSync(master)) {
  console.error(`Missing ${master}`);
  process.exit(1);
}

mkdirSync(iconsDir, { recursive: true });

const sharp = (await import("sharp")).default;
const toIco = (await import("to-ico")).default;

const pngOutputs = [
  { name: "rzd-icon-256.png", size: 256 },
  { name: "tray-icon-32.png", size: 32 },
];

/** Windows needs multiple embedded sizes — a single 256px entry glitches on taskbar/shortcuts. */
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

for (const { name, size } of pngOutputs) {
  const out = join(iconsDir, name);
  await sharp(master).resize(size, size).png().toFile(out);
  console.log(`Wrote ${out}`);
}

const icoBuffers = await Promise.all(
  ICO_SIZES.map((size) => sharp(master).resize(size, size).png().toBuffer()),
);
const ico = await toIco(icoBuffers);
writeFileSync(join(iconsDir, "rzd-icon.ico"), ico);
console.log(`Wrote ${join(iconsDir, "rzd-icon.ico")} (${ICO_SIZES.length} sizes)`);
