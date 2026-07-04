import type { Command } from "commander";
import type { WowFlavor } from "../../addons/types.js";
import { loadConfig, validateConfig } from "../../config/index.js";
import { CurseForgeSource } from "../../sources/curseforge.js";
import { error, heading, pc, spinner, table } from "../ui.js";

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search CurseForge for addons")
    .option("-f, --flavor <flavor>", "Filter by flavor (retail or classic)")
    .action(async (query: string, opts: { flavor?: string }) => {
      const config = loadConfig();
      const errors = validateConfig(config);
      if (errors.length > 0) {
        for (const e of errors) error(e);
        process.exitCode = 1;
        return;
      }

      const s = spinner(`Searching for "${query}"...`).start();

      try {
        const cf = new CurseForgeSource(config.curseforge_api_key);
        const results = await cf.search(
          query,
          opts.flavor as WowFlavor | undefined,
        );

        s.success({ text: `Found ${results.length} results` });

        if (results.length === 0) return;

        heading("Search Results");

        const rows: string[][] = [
          [
            pc.bold("#"),
            pc.bold("Name"),
            pc.bold("Authors"),
            pc.bold("Downloads"),
            pc.bold("ID"),
          ],
        ];

        for (const [i, r] of results.entries()) {
          rows.push([
            String(i + 1),
            r.name,
            r.authors.join(", "),
            formatDownloads(r.downloadCount),
            r.id,
          ]);
        }

        table(rows);

        console.log(
          `\n${pc.dim("Install with:")} surplus install <name> --flavor <retail|classic>`,
        );
      } catch (err) {
        s.error({ text: "Search failed" });
        error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
