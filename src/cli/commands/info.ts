import type { Command } from "commander";
import { scanAddons } from "../../addons/manager.js";
import type { WowFlavor } from "../../addons/types.js";
import { loadConfig, validateConfig } from "../../config/index.js";
import { detectFlavors } from "../../utils/paths.js";
import { error, heading, pc, warn } from "../ui.js";

export function registerInfoCommand(program: Command): void {
  program
    .command("info <addon>")
    .description("Show detailed metadata for an installed addon")
    .option("-f, --flavor <flavor>", "WoW flavor (retail or classic)")
    .action(async (addon: string, opts: { flavor?: string }) => {
      const config = loadConfig();
      const errors = validateConfig(config);
      if (errors.length > 0) {
        for (const e of errors) error(e);
        process.exitCode = 1;
        return;
      }

      const flavors: WowFlavor[] = opts.flavor
        ? [opts.flavor as WowFlavor]
        : detectFlavors(config.wow_path);

      let found = false;
      const lowerAddon = addon.toLowerCase();

      for (const flavor of flavors) {
        const scanned = scanAddons(config, flavor);
        const match = scanned.find(
          (s) =>
            s.installed.folderName.toLowerCase() === lowerAddon ||
            s.installed.toc.title.toLowerCase() === lowerAddon ||
            s.trackedName?.toLowerCase() === lowerAddon,
        );

        if (!match) continue;
        found = true;

        heading(
          `${match.installed.toc.title || match.installed.folderName} (${flavor})`,
        );

        const { toc } = match.installed;

        const fields: [string, string][] = [
          ["Folder", match.installed.folderName],
          ["TOC File", match.installed.tocFile],
          ["Title", toc.title],
          ["Version", toc.version],
          ["Author", toc.author],
          ["Notes", toc.notes],
          ["Interface", toc.interface],
          ["CurseForge ID", toc.curseProjectId],
          ["Wago ID", toc.wagoId],
          ["Dependencies", toc.dependencies],
        ];

        for (const [key, value] of fields) {
          if (value) {
            console.log(`  ${pc.bold(key.padEnd(16))} ${value}`);
          }
        }

        if (match.tracked) {
          console.log("");
          console.log(
            `  ${pc.bold("Source".padEnd(16))} ${match.tracked.source}`,
          );
          console.log(
            `  ${pc.bold("Source ID".padEnd(16))} ${match.tracked.id}`,
          );
          console.log(
            `  ${pc.bold("Tracked Ver".padEnd(16))} ${match.tracked.version}`,
          );
          console.log(
            `  ${pc.bold("Installed".padEnd(16))} ${match.tracked.installed_at}`,
          );
          console.log(
            `  ${pc.bold("Updated".padEnd(16))} ${match.tracked.updated_at}`,
          );
          console.log(
            `  ${pc.bold("Folders".padEnd(16))} ${match.tracked.folders.join(", ")}`,
          );
        } else if (match.autoMatchSource) {
          console.log("");
          console.log(
            `  ${pc.yellow("Auto-matched")} to ${match.autoMatchSource} (ID: ${match.autoMatchId})`,
          );
          console.log(
            `  ${pc.dim("Run")} surplus update ${pc.dim("to start tracking.")}`,
          );
        }
      }

      if (!found) {
        warn(
          `Addon "${addon}" not found. Use \`surplus list\` to see installed addons.`,
        );
      }
    });
}
