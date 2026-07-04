import type { WowFlavor } from "../addons/types.js";
import { downloadAndExtract } from "../utils/archive.js";
import { fetchJson } from "../utils/http.js";
import type { AddonRelease, AddonSearchResult, AddonSource } from "./types.js";

interface GhRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: GhAsset[];
}

interface GhAsset {
  name: string;
  browser_download_url: string;
  content_type: string;
  size: number;
}

export function parseGitHubUrl(
  url: string,
): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match?.[1] || !match[2]) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

function selectZipAsset(assets: GhAsset[], flavor: WowFlavor): GhAsset | null {
  const zips = assets.filter(
    (a) =>
      a.name.endsWith(".zip") &&
      !a.name.includes("Source") &&
      !a.name.includes("source"),
  );

  if (zips.length === 0) return null;

  // Try flavor-specific
  const flavorHints =
    flavor === "retail" ? ["retail", "mainline"] : ["classic"];

  const flavorMatch = zips.find((a) =>
    flavorHints.some((h) => a.name.toLowerCase().includes(h)),
  );
  if (flavorMatch) return flavorMatch;

  // Return first non-source zip
  return zips[0] ?? null;
}

export class GitHubSource implements AddonSource {
  async search(
    _query: string,
    _flavor?: WowFlavor,
  ): Promise<AddonSearchResult[]> {
    throw new Error(
      "GitHub source does not support search. Provide a full GitHub repository URL instead.",
    );
  }

  async getLatestRelease(
    repoPath: string,
    flavor: WowFlavor,
  ): Promise<AddonRelease | null> {
    const release = await fetchJson<GhRelease>(
      `https://api.github.com/repos/${repoPath}/releases/latest`,
    );

    const asset = selectZipAsset(release.assets, flavor);
    if (!asset) return null;

    return {
      id: release.tag_name,
      version: release.tag_name,
      downloadUrl: asset.browser_download_url,
      fileName: asset.name,
      gameVersions: [],
      releaseDate: release.published_at,
    };
  }

  async download(release: AddonRelease, destDir: string): Promise<string[]> {
    return downloadAndExtract(release.downloadUrl, destDir);
  }
}
