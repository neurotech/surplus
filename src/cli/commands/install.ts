import * as readline from "node:readline/promises";
import type { Command } from "commander";
import { installAddon } from "../../addons/manager.js";
import type { WowFlavor } from "../../addons/types.js";
import { loadConfig, validateConfig } from "../../config/index.js";
import { CurseForgeSource } from "../../sources/curseforge.js";
import { GitHubSource, parseGitHubUrl } from "../../sources/github.js";
import { detectFlavors } from "../../utils/paths.js";
import { error, info, pc, spinner, success, table, warn } from "../ui.js";

export function registerInstallCommand(program: Command): void {
  program
    .command("install <query>")
    .description(
      "Install an addon from CurseForge (search query) or GitHub (URL)",
    )
    .option("-f, --flavor <flavor>", "WoW flavor (retail or classic)")
    .action(async (query: string, opts: { flavor?: string }) => {
      const config = loadConfig();
      const errors = validateConfig(config);
      if (errors.length > 0) {
        for (const e of errors) error(e);
        process.exitCode = 1;
        return;
      }

      const flavor: WowFlavor =
        (opts.flavor as WowFlavor) ||
        detectFlavors(config.wow_path)[0] ||
        "retail";

      const ghParsed = parseGitHubUrl(query);

      if (ghParsed) {
        await installFromGitHub(config, flavor, ghParsed.owner, ghParsed.repo);
      } else {
        await installFromCurseForge(config, flavor, query);
      }
    });
}

async function installFromGitHub(
  config: ReturnType<typeof loadConfig>,
  flavor: WowFlavor,
  owner: string,
  repo: string,
): Promise<void> {
  const gh = new GitHubSource();
  const repoPath = `${owner}/${repo}`;

  const s = spinner(`Fetching latest release for ${repoPath}...`).start();

  try {
    const release = await gh.getLatestRelease(repoPath, flavor);

    if (!release) {
      s.error({ text: "No suitable release found" });
      error("Could not find a zip release for this addon.");
      process.exitCode = 1;
      return;
    }

    s.update({ text: `Downloading ${release.fileName}...` });

    await installAddon(config, flavor, repo, gh, release, "github", repoPath);

    s.success({ text: `Installed ${repo} ${release.version}` });
  } catch (err) {
    s.error({ text: "Installation failed" });
    error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

async function installFromCurseForge(
  config: ReturnType<typeof loadConfig>,
  flavor: WowFlavor,
  query: string,
): Promise<void> {
  const cf = new CurseForgeSource(config.curseforge_api_key);

  const s = spinner(`Searching for "${query}"...`).start();

  try {
    const results = await cf.search(query, flavor);

    if (results.length === 0) {
      s.error({ text: "No results found" });
      return;
    }

    s.success({ text: `Found ${results.length} results` });

    // Show results
    const rows: string[][] = [
      [pc.bold("#"), pc.bold("Name"), pc.bold("Authors")],
    ];
    const shown = results.slice(0, 10);
    for (const [i, r] of shown.entries()) {
      rows.push([String(i + 1), r.name, r.authors.join(", ")]);
    }
    table(rows);

    // Prompt for selection
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const answer = await rl.question(
        `\n${pc.bold("Select addon to install")} (1-${shown.length}, or 0 to cancel): `,
      );
      const choice = Number.parseInt(answer.trim(), 10);

      if (!choice || choice < 1 || choice > shown.length) {
        info("Installation cancelled.");
        return;
      }

      const selected = shown[choice - 1];
      if (!selected) {
        info("Installation cancelled.");
        return;
      }

      const s2 = spinner(
        `Installing ${selected.name} for ${flavor}...`,
      ).start();

      const release = await cf.getLatestRelease(selected.id, flavor);

      if (!release) {
        s2.error({ text: "No release found" });
        warn(`No ${flavor} release found for ${selected.name}.`);
        process.exitCode = 1;
        return;
      }

      s2.update({ text: `Downloading ${release.fileName}...` });

      await installAddon(
        config,
        flavor,
        selected.name,
        cf,
        release,
        "curseforge",
        selected.id,
      );

      s2.success({
        text: `Installed ${selected.name} ${release.version}`,
      });
    } finally {
      rl.close();
    }
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
