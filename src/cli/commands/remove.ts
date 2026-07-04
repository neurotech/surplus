import * as readline from "node:readline/promises";
import type { Command } from "commander";
import { removeAddon } from "../../addons/manager.js";
import { loadTrackedAddons } from "../../addons/tracker.js";
import type { WowFlavor } from "../../addons/types.js";
import { loadConfig, validateConfig } from "../../config/index.js";
import { detectFlavors } from "../../utils/paths.js";
import { error, info, pc, success, warn } from "../ui.js";

export function registerRemoveCommand(program: Command): void {
  program
    .command("remove <addon>")
    .description("Remove an addon and its tracking entry")
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

      const tracked = loadTrackedAddons();
      let found = false;

      for (const flavor of flavors) {
        const flavorAddons = tracked[flavor];
        if (!flavorAddons?.[addon]) continue;
        found = true;

        const entry = flavorAddons[addon];
        if (!entry) continue;
        info(`${addon} (${flavor}) — folders: ${entry.folders.join(", ")}`);

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        try {
          const answer = await rl.question(
            `${pc.bold("Remove this addon?")} (y/N): `,
          );
          if (answer.trim().toLowerCase() !== "y") {
            info("Removal cancelled.");
            continue;
          }
        } finally {
          rl.close();
        }

        const removed = removeAddon(config, flavor, addon);
        if (removed) {
          success(`Removed ${addon} from ${flavor}.`);
        } else {
          warn(`Could not remove ${addon} from ${flavor}.`);
        }
      }

      if (!found) {
        error(
          `Addon "${addon}" is not tracked. Use \`surplus list\` to see tracked addons.`,
        );
        process.exitCode = 1;
      }
    });
}
