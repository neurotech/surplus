import * as fs from "node:fs";
import * as TOML from "smol-toml";
import { configPath, ensureConfigDir } from "../utils/paths.js";
import type { SurplusConfig } from "./schema.js";
import { DEFAULT_CONFIG } from "./schema.js";

export function loadConfig(): SurplusConfig {
  const file = configPath();
  if (!fs.existsSync(file)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = TOML.parse(raw);
  return {
    wow_path: String(parsed.wow_path ?? ""),
    curseforge_api_key: String(parsed.curseforge_api_key ?? ""),
  };
}

export function saveConfig(config: SurplusConfig): void {
  ensureConfigDir();
  const content = TOML.stringify(config as unknown as Record<string, unknown>);
  fs.writeFileSync(configPath(), content, "utf-8");
}

export function validateConfig(config: SurplusConfig): string[] {
  const errors: string[] = [];
  if (!config.wow_path) {
    errors.push("wow_path is not set. Run `surplus init` to configure.");
  } else if (!fs.existsSync(config.wow_path)) {
    errors.push(`wow_path "${config.wow_path}" does not exist.`);
  }
  if (!config.curseforge_api_key) {
    errors.push(
      "curseforge_api_key is not set. Run `surplus init` to configure.",
    );
  }
  return errors;
}

export type { SurplusConfig } from "./schema.js";
