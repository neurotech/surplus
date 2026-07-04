import type { WowFlavor } from "../addons/types.js";
import { downloadAndExtract } from "../utils/archive.js";
import { fetchJson, fetchJsonPost } from "../utils/http.js";
import type { AddonRelease, AddonSearchResult, AddonSource } from "./types.js";

const BASE_URL = "https://api.curseforge.com";
const GAME_ID = 1; // World of Warcraft

// CurseForge game version type IDs
const FLAVOR_TYPE_ID: Record<WowFlavor, number> = {
  retail: 517, // Retail/Mainline
  classic: 67408, // Classic
};

interface CfMod {
  id: number;
  name: string;
  slug: string;
  summary: string;
  downloadCount: number;
  authors: { name: string }[];
  logo?: { thumbnailUrl: string };
  latestFilesIndexes: CfFileIndex[];
}

interface CfFileIndex {
  gameVersionTypeId: number;
  fileId: number;
  filename: string;
  releaseType: number;
}

interface CfFile {
  id: number;
  displayName: string;
  fileName: string;
  downloadUrl: string | null;
  gameVersions: string[];
  fileDate: string;
}

/**
 * Build a direct CDN URL for files where the API returns null downloadUrl
 * (author has disabled third-party downloads). The edge CDN still serves
 * the file at a predictable path derived from the file ID.
 */
function buildEdgeUrl(fileId: number, fileName: string): string {
  const idStr = String(fileId);
  const prefix = idStr.slice(0, 4);
  const suffix = idStr.slice(4);
  return `https://edge.forgecdn.net/files/${prefix}/${suffix}/${encodeURIComponent(fileName)}`;
}

export class CurseForgeSource implements AddonSource {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return { "x-api-key": this.apiKey };
  }

  async search(
    query: string,
    flavor?: WowFlavor,
  ): Promise<AddonSearchResult[]> {
    const params = new URLSearchParams({
      gameId: String(GAME_ID),
      searchFilter: query,
      sortField: "2", // Popularity
      sortOrder: "desc",
      pageSize: "20",
    });

    if (flavor) {
      params.set("gameVersionTypeId", String(FLAVOR_TYPE_ID[flavor]));
    }

    const data = await fetchJson<{ data: CfMod[] }>(
      `${BASE_URL}/v1/mods/search?${params}`,
      { headers: this.headers() },
    );

    return data.data.map((mod) => ({
      id: String(mod.id),
      name: mod.name,
      slug: mod.slug,
      summary: mod.summary,
      downloadCount: mod.downloadCount,
      authors: mod.authors.map((a) => a.name),
      thumbnailUrl: mod.logo?.thumbnailUrl ?? "",
    }));
  }

  async getLatestRelease(
    addonId: string,
    flavor: WowFlavor,
  ): Promise<AddonRelease | null> {
    const data = await fetchJson<{ data: CfMod }>(
      `${BASE_URL}/v1/mods/${addonId}`,
      { headers: this.headers() },
    );

    const typeId = FLAVOR_TYPE_ID[flavor];
    const fileIndex =
      data.data.latestFilesIndexes.find(
        (f) => f.gameVersionTypeId === typeId && f.releaseType === 1,
      ) ??
      data.data.latestFilesIndexes.find((f) => f.gameVersionTypeId === typeId);

    if (!fileIndex) return null;

    const fileData = await fetchJson<{ data: CfFile }>(
      `${BASE_URL}/v1/mods/${addonId}/files/${fileIndex.fileId}`,
      { headers: this.headers() },
    );

    const file = fileData.data;

    const downloadUrl =
      file.downloadUrl ?? buildEdgeUrl(file.id, file.fileName);

    return {
      id: String(file.id),
      version: file.displayName,
      downloadUrl,
      fileName: file.fileName,
      gameVersions: file.gameVersions,
      releaseDate: file.fileDate,
    };
  }

  async getModsByIds(ids: number[]): Promise<CfMod[]> {
    const data = await fetchJsonPost<{ data: CfMod[] }>(
      `${BASE_URL}/v1/mods`,
      { modIds: ids },
      this.headers(),
    );
    return data.data;
  }

  async download(release: AddonRelease, destDir: string): Promise<string[]> {
    return downloadAndExtract(release.downloadUrl, destDir);
  }
}
