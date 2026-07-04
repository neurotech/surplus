import * as fs from "node:fs";
import * as path from "node:path";
import type { InstalledAddon, TocMetadata, WowFlavor } from "./types.js";

const TOC_KEY_MAP: Record<string, keyof TocMetadata> = {
  title: "title",
  version: "version",
  author: "author",
  notes: "notes",
  "x-curse-project-id": "curseProjectId",
  "x-wago-id": "wagoId",
  interface: "interface",
  dependencies: "dependencies",
  deps: "dependencies",
};

function parseTocContent(content: string): TocMetadata {
  const meta: TocMetadata = {
    title: "",
    version: "",
    author: "",
    notes: "",
    curseProjectId: "",
    wagoId: "",
    interface: "",
    dependencies: "",
  };

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("##")) continue;
    const rest = trimmed.slice(2).trim();
    const colonIdx = rest.indexOf(":");
    if (colonIdx === -1) continue;
    const rawKey = rest.slice(0, colonIdx).trim().toLowerCase();
    const value = rest.slice(colonIdx + 1).trim();
    const mappedKey = TOC_KEY_MAP[rawKey];
    if (mappedKey) {
      meta[mappedKey] = value;
    } else {
      meta[rawKey] = value;
    }
  }

  return meta;
}

function selectTocFile(tocFiles: string[], flavor: WowFlavor): string | null {
  if (tocFiles.length === 0) return null;

  const flavorSuffix = flavor === "retail" ? "_Mainline" : "_Classic";

  const flavorSpecific = tocFiles.find((f) => {
    const base = path.basename(f, ".toc");
    return base.endsWith(flavorSuffix);
  });
  if (flavorSpecific) return flavorSpecific;

  const generic = tocFiles.find((f) => {
    const base = path.basename(f, ".toc");
    return (
      !base.endsWith("_Mainline") &&
      !base.endsWith("_Classic") &&
      !base.endsWith("_Cata") &&
      !base.endsWith("_Vanilla")
    );
  });
  if (generic) return generic;

  return tocFiles[0] ?? null;
}

export function parseAddonFolder(
  addonDir: string,
  folderName: string,
  flavor: WowFlavor,
): InstalledAddon | null {
  const folderPath = path.join(addonDir, folderName);
  if (!fs.statSync(folderPath).isDirectory()) return null;

  const entries = fs.readdirSync(folderPath);
  const tocFiles = entries
    .filter((e) => e.endsWith(".toc"))
    .map((e) => path.join(folderPath, e));

  const tocFile = selectTocFile(tocFiles, flavor);
  if (!tocFile) return null;

  const content = fs.readFileSync(tocFile, "utf-8");
  const toc = parseTocContent(content);

  if (!toc.title) {
    toc.title = folderName;
  }

  return {
    folderName,
    toc,
    tocFile,
  };
}

export function scanAddonsDir(
  addonDir: string,
  flavor: WowFlavor,
): InstalledAddon[] {
  if (!fs.existsSync(addonDir)) return [];

  const entries = fs.readdirSync(addonDir, { withFileTypes: true });
  const addons: InstalledAddon[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const addon = parseAddonFolder(addonDir, entry.name, flavor);
    if (addon) {
      addons.push(addon);
    }
  }

  return addons.sort((a, b) => a.folderName.localeCompare(b.folderName));
}
