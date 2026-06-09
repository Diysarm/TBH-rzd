/** One-off save probe for BoxData + rune fields. Run: npx tsx scripts/probe-boxes.ts */
import { readAndDecrypt } from "../src/main/io/saveFile";
import { join } from "node:path";
import { existsSync } from "node:fs";

const savePath = join(
  process.env.USERPROFILE ?? "",
  "AppData",
  "LocalLow",
  "TesseractStudio",
  "TaskbarHero",
  "SaveFile_Live.es3",
);

if (!existsSync(savePath)) {
  console.log("Save not found:", savePath);
  process.exit(0);
}

const { text } = readAndDecrypt(savePath);

// ES3 keys often appear as "Key\\" in decrypted JSON
const runeKeys = new Set<string>();
for (const m of text.matchAll(/"([^"]*[Rr]une[^"]*)"\s*:/g)) runeKeys.add(m[1]);
console.log("Rune-related keys:", [...runeKeys].sort());

for (const pat of ["BoxData", "RuneSaveData", "RuneKey", "IsUnlockedByRune"]) {
  const idx = text.indexOf(`"${pat}\\"`);
  const idx2 = text.indexOf(`"${pat}"`);
  const at = idx >= 0 ? idx : idx2;
  console.log(`\n${pat}:`, at >= 0 ? `FOUND at ${at}` : "not found");
  if (at >= 0) {
    const slice = text.slice(at, at + 1200);
    console.log(slice);
  }
}

// Distinct BoxTypes from save
const typesMatch = text.match(/"BoxTypes\\"\s*:\s*\[([\d,\s]+)\]/);
const qtyMatch = text.match(/"BoxQuantity\\"\s*:\s*\[([\d,\s]+)\]/);
if (typesMatch && qtyMatch) {
  const types = typesMatch[1].split(",").map((s) => Number(s.trim()));
  const qtys = qtyMatch[1].split(",").map((s) => Number(s.trim()));
  console.log("\nBoxTypes + quantities:");
  for (let i = 0; i < types.length; i++) {
    if (qtys[i] > 0) console.log(`  type ${types[i]}: ${qtys[i]}`);
  }
}

// RuneSaveData structure sample
const runeIdx = text.indexOf('"RuneSaveData\\"');
if (runeIdx >= 0) {
  const open = text.indexOf("{", runeIdx);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = open; i < Math.min(text.length, open + 50000); i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        console.log("\nRuneSaveData object (truncated):");
        console.log(text.slice(open, i + 1).slice(0, 3000));
        break;
      }
    }
  }
}
