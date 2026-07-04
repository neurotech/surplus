import * as readline from "node:readline/promises";
import type { Command } from "commander";
import { scanAddons } from "../../addons/manager.js";
import { setTrackedAddon } from "../../addons/tracker.js";
import type { WowFlavor } from "../../addons/types.js";
import { loadConfig, validateConfig } from "../../config/index.js";
import { CurseForgeSource } from "../../sources/curseforge.js";
import { detectFlavors } from "../../utils/paths.js";
import { parseFlavor } from "../flavor.js";
import { error, info, pc, spinner, success, table, warn } from "../ui.js";

interface AdoptableGroup {
  projectId: string;
  cfName: string;
  folders: string[];
  version: string;
}

export function registerAdoptCommand(program: Command): void {
  program
    .command("adopt")
    .description(
      "Adopt untracked addons with CurseForge project IDs into surplus tracking",
    )
    .option(
      "-f, --flavor <flavor>",
      "WoW flavor (retail or classic)",
      parseFlavor,
    )
    .option("-a, --all", "Adopt all without prompting")
    .option("-n, --dry-run", "Show adoptable addons without making changes")
    .action(
      async (opts: { flavor?: WowFlavor; all?: boolean; dryRun?: boolean }) => {
        const config = loadConfig();
        const errors = validateConfig(config);
        if (errors.length > 0) {
          for (const e of errors) error(e);
          process.exitCode = 1;
          return;
        }

        const flavors: WowFlavor[] = opts.flavor
          ? [opts.flavor]
          : detectFlavors(config.wow_path);

        if (flavors.length === 0) {
          warn("No WoW installations found.");
          return;
        }

        for (const flavor of flavors) {
          await adoptFlavor(config, flavor, opts);
        }
      },
    );
}

async function adoptFlavor(
  config: ReturnType<typeof loadConfig>,
  flavor: WowFlavor,
  opts: { all?: boolean; dryRun?: boolean },
): Promise<void> {
  const scanned = scanAddons(config, flavor);
  const untracked = scanned.filter(
    (a) => a.autoMatchSource === "curseforge" && a.autoMatchId,
  );

  if (untracked.length === 0) {
    info(`No adoptable addons found for ${flavor}.`);
    return;
  }

  // Group by CurseForge project ID
  const groups = new Map<string, { folders: string[]; version: string }>();
  for (const addon of untracked) {
    const id = addon.autoMatchId;
    if (!id) continue;
    const existing = groups.get(id);
    if (existing) {
      existing.folders.push(addon.installed.folderName);
    } else {
      groups.set(id, {
        folders: [addon.installed.folderName],
        version: addon.installed.toc.version || "unknown",
      });
    }
  }

  // Batch-validate against CurseForge
  const cf = new CurseForgeSource(config.curseforge_api_key);
  const ids = [...groups.keys()].map(Number);

  const s = spinner(
    `Validating ${ids.length} addon(s) against CurseForge...`,
  ).start();

  let adoptable: AdoptableGroup[];
  try {
    const mods = await cf.getModsByIds(ids);
    const modMap = new Map(mods.map((m) => [String(m.id), m.name]));

    adoptable = [];
    for (const [projectId, group] of groups) {
      const cfName = modMap.get(projectId);
      if (cfName) {
        adoptable.push({
          projectId,
          cfName,
          folders: group.folders,
          version: group.version,
        });
      }
    }

    s.success({
      text: `Found ${adoptable.length} adoptable addon(s) for ${flavor}`,
    });
  } catch (err) {
    s.error({ text: "Failed to validate addons" });
    error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  if (adoptable.length === 0) {
    info("No addons could be validated against CurseForge.");
    return;
  }

  // Display table
  const rows: string[][] = [
    [
      pc.bold("#"),
      pc.bold("Name"),
      pc.bold("Folders"),
      pc.bold("Version"),
      pc.bold("Project ID"),
    ],
  ];
  for (const [i, group] of adoptable.entries()) {
    rows.push([
      String(i + 1),
      group.cfName,
      String(group.folders.length),
      group.version,
      group.projectId,
    ]);
  }
  table(rows);

  if (opts.dryRun) {
    info("Dry run — no changes made.");
    return;
  }

  // Select addons to adopt
  let selected: AdoptableGroup[];
  if (opts.all) {
    selected = adoptable;
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      const answer = await rl.question(
        `\n${pc.bold("Select addons to adopt")} (e.g. 1,3-5, "all", or 0 to cancel): `,
      );
      const input = answer.trim().toLowerCase();
      if (input === "0" || input === "") {
        info("Adoption cancelled.");
        return;
      }
      if (input === "all") {
        selected = adoptable;
      } else {
        const indices = parseSelection(input, adoptable.length);
        if (indices.length === 0) {
          error("Invalid selection.");
          return;
        }
        selected = indices.flatMap((i) => {
          const group = adoptable[i];
          return group ? [group] : [];
        });
      }
    } finally {
      rl.close();
    }
  }

  if (selected.length === 0) {
    info("No addons selected.");
    return;
  }

  // Adopt selected groups
  const now = new Date().toISOString();
  for (const group of selected) {
    setTrackedAddon(flavor, group.cfName, {
      source: "curseforge",
      id: group.projectId,
      version: group.version,
      installed_at: now,
      updated_at: now,
      folders: group.folders,
    });
    success(`Adopted ${group.cfName} (${group.folders.join(", ")})`);
  }

  success(`Adopted ${selected.length} addon(s) for ${flavor}.`);
}

/** Parse a selection string like "1,3-5,7" into 0-based indices. */
function parseSelection(input: string, max: number): number[] {
  const indices = new Set<number>();
  const parts = input.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number.parseInt(range[1] ?? "", 10);
      const end = Number.parseInt(range[2] ?? "", 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      for (let n = start; n <= end; n++) {
        if (n >= 1 && n <= max) indices.add(n - 1);
      }
    } else {
      const n = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= max) {
        indices.add(n - 1);
      }
    }
  }
  return [...indices].sort((a, b) => a - b);
}
