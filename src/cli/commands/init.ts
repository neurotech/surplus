import * as fs from "node:fs";
import * as readline from "node:readline/promises";
import type { Command } from "commander";
import { loadConfig, saveConfig } from "../../config/index.js";
import { detectFlavors } from "../../utils/paths.js";
import { error, info, pc, success } from "../ui.js";

async function prompt(
  rl: readline.Interface,
  question: string,
  defaultValue?: string,
): Promise<string> {
  const suffix = defaultValue ? ` ${pc.dim(`(${defaultValue})`)}` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || "";
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description(
      "Interactive setup — configure WoW path and CurseForge API key",
    )
    .action(async () => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      try {
        const existing = loadConfig();
        info("Surplus configuration setup\n");

        const wowPath = await prompt(
          rl,
          "Path to World of Warcraft installation",
          existing.wow_path || undefined,
        );

        if (!wowPath) {
          error("WoW path is required.");
          process.exitCode = 1;
          return;
        }

        if (!fs.existsSync(wowPath)) {
          error(`Path "${wowPath}" does not exist.`);
          process.exitCode = 1;
          return;
        }

        const flavors = detectFlavors(wowPath);
        if (flavors.length === 0) {
          error(
            "No WoW installations found at that path (expected _retail_ or _classic_ directories).",
          );
          process.exitCode = 1;
          return;
        }

        success(`Found flavors: ${flavors.join(", ")}`);

        const apiKey = await prompt(
          rl,
          "CurseForge API key (https://console.curseforge.com)",
          existing.curseforge_api_key || undefined,
        );

        if (!apiKey) {
          error("CurseForge API key is required.");
          process.exitCode = 1;
          return;
        }

        saveConfig({
          wow_path: wowPath,
          curseforge_api_key: apiKey,
        });

        success("Configuration saved!");
      } finally {
        rl.close();
      }
    });
}
