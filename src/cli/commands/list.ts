import type { Command } from "commander";
import { scanAddons } from "../../addons/manager.js";
import type { WowFlavor } from "../../addons/types.js";
import { loadConfig, validateConfig } from "../../config/index.js";
import { detectFlavors } from "../../utils/paths.js";
import { parseFlavor } from "../flavor.js";
import { error, heading, pc, table, warn } from "../ui.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List installed addons with version and source")
    .option(
      "-f, --flavor <flavor>",
      "Filter by flavor (retail or classic)",
      parseFlavor,
    )
    .action(async (opts: { flavor?: WowFlavor }) => {
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
        const scanned = scanAddons(config, flavor);
        heading(`${flavor} (${scanned.length} addons)`);

        if (scanned.length === 0) {
          console.log("  No addons installed.");
          continue;
        }

        const rows: string[][] = [
          [
            pc.bold("Name"),
            pc.bold("Version"),
            pc.bold("Source"),
            pc.bold("Status"),
          ],
        ];

        for (const addon of scanned) {
          const name = addon.installed.toc.title || addon.installed.folderName;
          const version = addon.installed.toc.version || "unknown";
          let source = "";
          let status = "";

          if (addon.tracked) {
            source = addon.tracked.source;
            status = pc.green("tracked");
          } else if (addon.autoMatchSource) {
            source = `${addon.autoMatchSource} (auto)`;
            status = pc.yellow("untracked");
          } else {
            source = "—";
            status = pc.dim("untracked");
          }

          rows.push([name, version, source, status]);
        }

        table(rows);
      }
    });
}
