#!/usr/bin/env node
/** Zip release/win-unpacked into a portable archive for sharing (no installer). */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"));
const version = pkg.version;
const productName = pkg.build?.productName ?? "TBH Rzd";
const folderName = `TBH-Rzd-${version}-portable`;
const unpacked = join(appDir, "release", "win-unpacked");
const staging = join(appDir, "release", folderName);
const zipPath = join(appDir, "release", `${folderName}.zip`);

if (!existsSync(unpacked)) {
  console.error(
    "Missing release/win-unpacked — run npm run pack first (or npm run pack:portable).",
  );
  process.exit(1);
}

const exeName = `${productName}.exe`;
if (!existsSync(join(unpacked, exeName))) {
  console.error(`Expected ${exeName} in release/win-unpacked`);
  process.exit(1);
}

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
cpSync(unpacked, staging, { recursive: true });

writeFileSync(
  join(staging, "CARA-PAKAI.txt"),
  `${productName} v${version} — portable (tanpa install)

1. Extract folder ini (jangan pindah file .exe saja).
2. Double-click "${exeName}".
3. Windows SmartScreen? Klik "More info" → "Run anyway" (app belum di-sign).

Syarat: Windows 64-bit, game TBH sudah pernah jalan (ada save file).
Data app disimpan di %APPDATA%\\tbh-companion\\
`,
  "utf8",
);

rmSync(zipPath, { force: true });

if (process.platform === "win32") {
  const psStaging = staging.replace(/'/g, "''");
  const psZip = zipPath.replace(/'/g, "''");
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -LiteralPath '${psStaging}' -DestinationPath '${psZip}' -Force"`,
    { stdio: "inherit" },
  );
} else {
  execSync(`cd "${join(appDir, "release")}" && zip -r "${folderName}.zip" "${folderName}"`, {
    stdio: "inherit",
  });
}

rmSync(staging, { recursive: true, force: true });

console.log("");
console.log(`Portable zip ready: ${zipPath}`);
console.log(`Share this file — temen extract lalu jalankan ${exeName}`);
