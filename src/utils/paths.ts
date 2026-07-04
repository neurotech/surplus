import * as fs from "node:fs";
import * as path from "node:path";
import type { WowFlavor } from "../addons/types.js";

const CONFIG_DIR =
  process.env.SURPLUS_CONFIG_DIR ||
  path.join(
    process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"),
    "surplus",
  );

function homedir(): string {
  return process.env.HOME || `/home/${process.env.USER || "user"}`;
}

export function configDir(): string {
  return CONFIG_DIR;
}

export function configPath(): string {
  return path.join(CONFIG_DIR, "config.toml");
}

export function addonsPath(): string {
  return path.join(CONFIG_DIR, "addons.toml");
}

export function ensureConfigDir(): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

const FLAVOR_DIRS: Record<WowFlavor, string> = {
  retail: "_retail_",
  classic: "_classic_",
};

export function addonsDir(wowPath: string, flavor: WowFlavor): string {
  return path.join(wowPath, FLAVOR_DIRS[flavor], "Interface", "AddOns");
}

export function detectFlavors(wowPath: string): WowFlavor[] {
  const flavors: WowFlavor[] = [];
  for (const [flavor, dir] of Object.entries(FLAVOR_DIRS)) {
    const addonsPath = path.join(wowPath, dir, "Interface", "AddOns");
    if (fs.existsSync(addonsPath)) {
      flavors.push(flavor as WowFlavor);
    }
  }
  return flavors;
}
