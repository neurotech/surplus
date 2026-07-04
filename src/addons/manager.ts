import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { SurplusConfig } from "../config/index.js";
import type { AddonRelease, AddonSource } from "../sources/types.js";
import { addonsDir } from "../utils/paths.js";
import { scanAddonsDir } from "./toc-parser.js";
import {
  buildFolderIndex,
  loadTrackedAddons,
  removeTrackedAddon,
  setTrackedAddon,
} from "./tracker.js";
import type { InstalledAddon, TrackedAddon, WowFlavor } from "./types.js";

export interface ScannedAddon {
  installed: InstalledAddon;
  tracked: TrackedAddon | null;
  trackedName: string | null;
  autoMatchSource: "curseforge" | null;
  autoMatchId: string | null;
}

export interface UpdateInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  release: AddonRelease;
  source: AddonSource;
  tracked: TrackedAddon;
}

export interface UpdateCheckFailure {
  name: string;
  source: TrackedAddon["source"];
  error: Error;
}

export interface UpdateCheckResult {
  updates: UpdateInfo[];
  failures: UpdateCheckFailure[];
}

export function scanAddons(
  config: SurplusConfig,
  flavor: WowFlavor,
): ScannedAddon[] {
  const dir = addonsDir(config.wow_path, flavor);
  const installed = scanAddonsDir(dir, flavor);
  const folderIndex = buildFolderIndex(flavor);
  const results: ScannedAddon[] = [];

  for (const addon of installed) {
    const trackedName = folderIndex.get(addon.folderName) ?? null;
    let tracked: TrackedAddon | null = null;

    if (trackedName) {
      const all = loadTrackedAddons();
      tracked = all[flavor]?.[trackedName] ?? null;
    }

    let autoMatchSource: "curseforge" | null = null;
    let autoMatchId: string | null = null;

    if (!tracked && addon.toc.curseProjectId) {
      autoMatchSource = "curseforge";
      autoMatchId = addon.toc.curseProjectId;
    }

    results.push({
      installed: addon,
      tracked,
      trackedName,
      autoMatchSource,
      autoMatchId,
    });
  }

  return results;
}

export async function checkUpdates(
  config: SurplusConfig,
  flavor: WowFlavor,
  sources: { curseforge: AddonSource; github: AddonSource },
): Promise<UpdateCheckResult> {
  const allTracked = loadTrackedAddons();
  const flavorAddons = allTracked[flavor];
  if (!flavorAddons) return { updates: [], failures: [] };

  const updates: UpdateInfo[] = [];
  const failures: UpdateCheckFailure[] = [];

  for (const [name, tracked] of Object.entries(flavorAddons)) {
    const source =
      tracked.source === "github" ? sources.github : sources.curseforge;
    let release: AddonRelease | null;
    try {
      release = await source.getLatestRelease(tracked.id, flavor);
    } catch (err) {
      failures.push({
        name,
        source: tracked.source,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      continue;
    }

    if (!release) {
      continue;
    }

    if (release.version !== tracked.version) {
      updates.push({
        name,
        currentVersion: tracked.version,
        latestVersion: release.version,
        release,
        source,
        tracked,
      });
    }
  }

  return { updates, failures };
}

export async function installAddon(
  config: SurplusConfig,
  flavor: WowFlavor,
  name: string,
  source: AddonSource,
  release: AddonRelease,
  sourceType: "curseforge" | "github",
  sourceId: string,
): Promise<void> {
  const dir = addonsDir(config.wow_path, flavor);
  const folders = await source.download(release, dir);

  setTrackedAddon(flavor, name, {
    source: sourceType,
    id: sourceId,
    version: release.version,
    installed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    folders,
  });
}

export async function updateAddon(
  config: SurplusConfig,
  flavor: WowFlavor,
  updateInfo: UpdateInfo,
): Promise<void> {
  const dir = addonsDir(config.wow_path, flavor);
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "surplus-update-"));

  try {
    const folders = await updateInfo.source.download(
      updateInfo.release,
      stagingDir,
    );

    for (const folder of folders) {
      const folderPath = path.join(stagingDir, folder);
      if (!isInside(stagingDir, folderPath) || !fs.existsSync(folderPath)) {
        throw new Error(`Downloaded addon folder was not found: ${folder}`);
      }
      if (!fs.statSync(folderPath).isDirectory()) {
        throw new Error(`Downloaded addon path is not a folder: ${folder}`);
      }
    }

    fs.mkdirSync(dir, { recursive: true });

    for (const folder of updateInfo.tracked.folders) {
      const folderPath = path.join(dir, folder);
      if (!isInside(dir, folderPath)) {
        throw new Error(`Unsafe tracked addon folder path: ${folder}`);
      }
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true });
      }
    }

    for (const folder of folders) {
      const src = path.join(stagingDir, folder);
      const dest = path.join(dir, folder);
      if (!isInside(dir, dest)) {
        throw new Error(`Unsafe downloaded addon folder path: ${folder}`);
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
    }

    setTrackedAddon(flavor, updateInfo.name, {
      ...updateInfo.tracked,
      version: updateInfo.release.version,
      updated_at: new Date().toISOString(),
      folders,
    });
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

export function removeAddon(
  config: SurplusConfig,
  flavor: WowFlavor,
  name: string,
): boolean {
  const all = loadTrackedAddons();
  const tracked = all[flavor]?.[name];
  if (!tracked) return false;

  const dir = addonsDir(config.wow_path, flavor);
  for (const folder of tracked.folders) {
    const folderPath = path.join(dir, folder);
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true });
    }
  }

  removeTrackedAddon(flavor, name);
  return true;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}
