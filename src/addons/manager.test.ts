import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AddonRelease,
  AddonSearchResult,
  AddonSource,
} from "../sources/types.js";

let rootDir: string;
let configDir: string;
let wowPath: string;

beforeEach(() => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "surplus-test-"));
  configDir = path.join(rootDir, "config");
  wowPath = path.join(rootDir, "wow");
  fs.mkdirSync(addonsDir(), { recursive: true });
  process.env.SURPLUS_CONFIG_DIR = configDir;
  vi.resetModules();
});

afterEach(() => {
  process.env.SURPLUS_CONFIG_DIR = undefined;
  fs.rmSync(rootDir, { recursive: true, force: true });
  vi.resetModules();
});

describe("updateAddon", () => {
  it("keeps existing folders and tracking when download fails", async () => {
    const { updateAddon } = await import("./manager.js");
    const { getTrackedAddon, setTrackedAddon } = await import("./tracker.js");
    const oldFolder = path.join(addonsDir(), "OldAddon");
    fs.mkdirSync(oldFolder, { recursive: true });
    fs.writeFileSync(path.join(oldFolder, "file.txt"), "old");

    setTrackedAddon("retail", "Example", {
      source: "github",
      id: "owner/repo",
      version: "1.0.0",
      installed_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      folders: ["OldAddon"],
    });

    const tracked = getTrackedAddon("retail", "Example");
    expect(tracked).not.toBeNull();

    await expect(
      updateAddon({ wow_path: wowPath, curseforge_api_key: "key" }, "retail", {
        name: "Example",
        currentVersion: "1.0.0",
        latestVersion: "2.0.0",
        release: release("2.0.0"),
        source: sourceThatFails("download failed"),
        tracked: tracked ?? raise("Expected tracked addon"),
      }),
    ).rejects.toThrow("download failed");

    expect(fs.readFileSync(path.join(oldFolder, "file.txt"), "utf-8")).toBe(
      "old",
    );
    expect(getTrackedAddon("retail", "Example")).toMatchObject({
      version: "1.0.0",
      folders: ["OldAddon"],
    });
  });

  it("replaces old folders and updates tracking after a successful download", async () => {
    const { updateAddon } = await import("./manager.js");
    const { getTrackedAddon, setTrackedAddon } = await import("./tracker.js");
    const oldFolder = path.join(addonsDir(), "OldAddon");
    fs.mkdirSync(oldFolder, { recursive: true });
    fs.writeFileSync(path.join(oldFolder, "file.txt"), "old");

    setTrackedAddon("retail", "Example", {
      source: "github",
      id: "owner/repo",
      version: "1.0.0",
      installed_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      folders: ["OldAddon"],
    });

    const tracked = getTrackedAddon("retail", "Example");
    expect(tracked).not.toBeNull();

    await updateAddon(
      { wow_path: wowPath, curseforge_api_key: "key" },
      "retail",
      {
        name: "Example",
        currentVersion: "1.0.0",
        latestVersion: "2.0.0",
        release: release("2.0.0"),
        source: sourceThatDownloads("NewAddon"),
        tracked: tracked ?? raise("Expected tracked addon"),
      },
    );

    expect(fs.existsSync(oldFolder)).toBe(false);
    expect(
      fs.readFileSync(path.join(addonsDir(), "NewAddon/file.txt"), "utf-8"),
    ).toBe("new");
    expect(getTrackedAddon("retail", "Example")).toMatchObject({
      version: "2.0.0",
      folders: ["NewAddon"],
    });
  });
});

describe("checkUpdates", () => {
  it("continues checking when one tracked addon source throws", async () => {
    const { checkUpdates } = await import("./manager.js");
    const { setTrackedAddon } = await import("./tracker.js");

    setTrackedAddon("retail", "Broken", {
      source: "curseforge",
      id: "broken",
      version: "1.0.0",
      installed_at: "",
      updated_at: "",
      folders: ["Broken"],
    });
    setTrackedAddon("retail", "Working", {
      source: "curseforge",
      id: "working",
      version: "1.0.0",
      installed_at: "",
      updated_at: "",
      folders: ["Working"],
    });

    const result = await checkUpdates(
      { wow_path: wowPath, curseforge_api_key: "key" },
      "retail",
      {
        curseforge: sourceThatChecks(),
        github: sourceThatChecks(),
      },
    );

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]?.name).toBe("Working");
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      name: "Broken",
      source: "curseforge",
    });
    expect(result.failures[0]?.error.message).toBe("source unavailable");
  });
});

function addonsDir(): string {
  return path.join(wowPath, "_retail_", "Interface", "AddOns");
}

function release(version: string): AddonRelease {
  return {
    id: version,
    version,
    downloadUrl: "https://example.test/addon.zip",
    fileName: "addon.zip",
    gameVersions: [],
    releaseDate: "2026-01-01T00:00:00.000Z",
  };
}

function sourceThatFails(message: string): AddonSource {
  return {
    search: async () => [],
    getLatestRelease: async () => null,
    download: async () => {
      throw new Error(message);
    },
  };
}

function sourceThatDownloads(folder: string): AddonSource {
  return {
    search: async () => [],
    getLatestRelease: async () => null,
    download: async (_release: AddonRelease, destDir: string) => {
      const addonDir = path.join(destDir, folder);
      fs.mkdirSync(addonDir, { recursive: true });
      fs.writeFileSync(path.join(addonDir, "file.txt"), "new");
      return [folder];
    },
  };
}

function sourceThatChecks(): AddonSource {
  return {
    search: async (): Promise<AddonSearchResult[]> => [],
    getLatestRelease: async (addonId: string) => {
      if (addonId === "broken") {
        throw new Error("source unavailable");
      }
      return release("2.0.0");
    },
    download: async () => [],
  };
}

function raise(message: string): never {
  throw new Error(message);
}
