import * as readline from "node:readline/promises";
import type { Command } from "commander";
import { checkUpdates, updateAddon } from "../../addons/manager.js";
import type { WowFlavor } from "../../addons/types.js";
import { loadConfig, validateConfig } from "../../config/index.js";
import { CurseForgeSource } from "../../sources/curseforge.js";
import { GitHubSource } from "../../sources/github.js";
import { detectFlavors } from "../../utils/paths.js";
import { parseFlavor } from "../flavor.js";
import {
  error,
  heading,
  info,
  pc,
  spinner,
  success,
  table,
  warn,
} from "../ui.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Check and apply addon updates")
    .option("-a, --all", "Update all addons without prompting")
    .option(
      "-f, --flavor <flavor>",
      "Filter by flavor (retail or classic)",
      parseFlavor,
    )
    .option("-d, --dry-run", "Check for updates without installing")
    .action(
      async (opts: { all?: boolean; flavor?: WowFlavor; dryRun?: boolean }) => {
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

        const sources = {
          curseforge: new CurseForgeSource(config.curseforge_api_key),
          github: new GitHubSource(),
        };

        for (const flavor of flavors) {
          heading(`Checking updates for ${flavor}`);

          const s = spinner("Checking for updates...").start();

          try {
            const { updates, failures } = await checkUpdates(
              config,
              flavor,
              sources,
            );

            if (updates.length === 0 && failures.length === 0) {
              s.success({ text: "All addons are up to date!" });
              continue;
            }

            if (updates.length > 0) {
              s.success({
                text: `Found ${updates.length} update${updates.length > 1 ? "s" : ""}`,
              });
            } else {
              s.success({
                text: "No updates found for successfully checked addons",
              });
            }

            if (updates.length > 0) {
              const rows: string[][] = [
                [
                  pc.bold("Name"),
                  pc.bold("Current"),
                  pc.bold("Latest"),
                  pc.bold("Source"),
                ],
              ];

              for (const u of updates) {
                rows.push([
                  u.name,
                  u.currentVersion,
                  pc.green(u.latestVersion),
                  u.tracked.source,
                ]);
              }

              table(rows);
            }

            if (failures.length > 0) {
              process.exitCode = 1;
              warn(
                `Skipped ${failures.length} addon${failures.length > 1 ? "s" : ""} due to update-check errors:`,
              );
              const rows: string[][] = [
                [pc.bold("Name"), pc.bold("Source"), pc.bold("Error")],
              ];
              for (const failure of failures) {
                rows.push([
                  failure.name,
                  failure.source,
                  failure.error.message,
                ]);
              }
              table(rows);
            }

            if (opts.dryRun) {
              info("Dry run — no changes applied.");
              continue;
            }

            if (updates.length === 0) {
              continue;
            }

            let proceed = opts.all;
            if (!proceed) {
              const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
              });
              try {
                const answer = await rl.question(
                  `\n${pc.bold("Apply updates?")} (y/N): `,
                );
                proceed = answer.trim().toLowerCase() === "y";
              } finally {
                rl.close();
              }
            }

            if (!proceed) {
              info("Update cancelled.");
              continue;
            }

            for (const u of updates) {
              const us = spinner(`Updating ${u.name}...`).start();
              try {
                await updateAddon(config, flavor, u);
                us.success({
                  text: `Updated ${u.name}: ${u.currentVersion} → ${u.latestVersion}`,
                });
              } catch (err) {
                us.error({ text: `Failed to update ${u.name}` });
                error(err instanceof Error ? err.message : String(err));
                process.exitCode = 1;
              }
            }

            if (process.exitCode) {
              warn("Update completed with errors.");
            } else {
              success("Update complete!");
            }
          } catch (err) {
            s.error({ text: "Update check failed" });
            error(err instanceof Error ? err.message : String(err));
            process.exitCode = 1;
          }
        }
      },
    );
}
