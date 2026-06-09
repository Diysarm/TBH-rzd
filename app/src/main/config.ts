// Loads companion settings, reusing the existing config.json shape.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
