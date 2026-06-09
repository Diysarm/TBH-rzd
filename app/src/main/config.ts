// Loads companion settings, reusing the existing config.json shape.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import { DEFAULT_PASSWORD } from "../core/es3";

export interface Config {
  savePath: string;
  es3Password: string;
  pollIntervalSeconds: number;
  rollingWindowMinutes: number;
  trackCubeExp: boolean;
  startTopmost: boolean;
  logHistoryCsv: boolean;
  currency: string; // ISO code for Steam Market prices (see core/steamPrice)
}

const DEFAULT_SAVE = join(
  "%USERPROFILE%",
  "AppData",
  "LocalLow",
  "TesseractStudio",
  "TaskbarHero",
  "SaveFile_Live.es3",
);

const DEFAULTS: Config = {
  savePath: DEFAULT_SAVE,
  es3Password: DEFAULT_PASSWORD,
  pollIntervalSeconds: 5,
  rollingWindowMinutes: 5,
  trackCubeExp: false,
  startTopmost: true,
  logHistoryCsv: true,
  currency: "USD",
};

// Expand %VAR% (Windows) and ~ in a path.
export function expandPath(p: string): string {
  let out = p.replace(/%([^%]+)%/g, (_m, name: string) => process.env[name] ?? `%${name}%`);
  if (out.startsWith("~")) {
    const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
    out = join(home, out.slice(1));
  }
  return out;
}

// Search order: packaged userData, then dev locations (cwd, repo root).
function candidatePaths(): string[] {
  const paths: string[] = [];
  try {
    paths.push(join(app.getPath("userData"), "config.json"));
  } catch {
    // app not ready / non-electron context
  }
  paths.push(join(process.cwd(), "config.json"));
  paths.push(join(process.cwd(), "..", "config.json"));
  return paths;
}

export function loadConfig(): Config {
  for (const p of candidatePaths()) {
    if (!existsSync(p)) continue;
    try {
      const raw = JSON.parse(readFileSync(p, "utf-8")) as Partial<Config>;
      return { ...DEFAULTS, ...raw };
    } catch {
      // fall through to defaults on malformed config
    }
  }
  return { ...DEFAULTS };
}

// Persist the live config to the user-writable location (userData/config.json),
// merging over whatever is on disk. Used by runtime settings like currency.
export function saveConfig(config: Config): void {
  let target: string;
  try {
    target = join(app.getPath("userData"), "config.json");
  } catch {
    target = join(process.cwd(), "config.json");
  }
  let existing: Partial<Config> = {};
  if (existsSync(target)) {
    try {
      existing = JSON.parse(readFileSync(target, "utf-8")) as Partial<Config>;
    } catch {
      existing = {};
    }
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify({ ...existing, ...config }, null, 2));
}
