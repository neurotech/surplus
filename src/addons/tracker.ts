import * as fs from "node:fs";
import * as TOML from "smol-toml";
import { addonsPath, ensureConfigDir } from "../utils/paths.js";
import type { TrackedAddon, TrackedAddons, WowFlavor } from "./types.js";

export function loadTrackedAddons(): TrackedAddons {
  const file = addonsPath();
  if (!fs.existsSync(file)) {
    return {};
  }
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = TOML.parse(raw);
  const result: TrackedAddons = {};

  for (const [flavor, addons] of Object.entries(parsed)) {
    if (typeof addons !== "object" || addons === null) continue;
    result[flavor] = {};
    for (const [name, data] of Object.entries(
      addons as Record<string, unknown>,
    )) {
      if (typeof data !== "object" || data === null) continue;
      const d = data as Record<string, unknown>;
      const flavorObj = result[flavor];
      if (!flavorObj) continue;
      flavorObj[name] = {
        source: String(d.source ?? "curseforge") as "curseforge" | "github",
        id: String(d.id ?? ""),
        version: String(d.version ?? ""),
        installed_at: String(d.installed_at ?? ""),
        updated_at: String(d.updated_at ?? ""),
        folders: Array.isArray(d.folders) ? d.folders.map(String) : [name],
      };
    }
  }

  return result;
}

export function saveTrackedAddons(addons: TrackedAddons): void {
  ensureConfigDir();
  const content = TOML.stringify(addons as unknown as Record<string, unknown>);
  fs.writeFileSync(addonsPath(), content, "utf-8");
}

export function getTrackedAddon(
  flavor: WowFlavor,
  name: string,
): TrackedAddon | null {
  const all = loadTrackedAddons();
  return all[flavor]?.[name] ?? null;
}

export function setTrackedAddon(
  flavor: WowFlavor,
  name: string,
  addon: TrackedAddon,
): void {
  const all = loadTrackedAddons();
  if (!all[flavor]) {
    all[flavor] = {};
  }
  const flavorObj = all[flavor];
  if (flavorObj) {
    flavorObj[name] = addon;
  }
  saveTrackedAddons(all);
}

export function removeTrackedAddon(flavor: WowFlavor, name: string): boolean {
  const all = loadTrackedAddons();
  const flavorAddons = all[flavor];
  if (!flavorAddons?.[name]) return false;
  delete flavorAddons[name];
  if (Object.keys(flavorAddons).length === 0) {
    delete all[flavor];
  }
  saveTrackedAddons(all);
  return true;
}

export function buildFolderIndex(flavor: WowFlavor): Map<string, string> {
  const tracked = loadTrackedAddons();
  const index = new Map<string, string>();
  const flavorAddons = tracked[flavor];
  if (!flavorAddons) return index;

  for (const [name, addon] of Object.entries(flavorAddons)) {
    for (const folder of addon.folders) {
      index.set(folder, name);
    }
  }
  return index;
}
