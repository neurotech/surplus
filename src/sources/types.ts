import type { WowFlavor } from "../addons/types.js";

export interface AddonSearchResult {
  id: string;
  name: string;
  slug: string;
  summary: string;
  downloadCount: number;
  authors: string[];
  thumbnailUrl: string;
}

export interface AddonRelease {
  id: string;
  version: string;
  downloadUrl: string;
  fileName: string;
  gameVersions: string[];
  releaseDate: string;
}

export interface AddonSource {
  search(query: string, flavor?: WowFlavor): Promise<AddonSearchResult[]>;
  getLatestRelease(
    addonId: string,
    flavor: WowFlavor,
  ): Promise<AddonRelease | null>;
  download(release: AddonRelease, destDir: string): Promise<string[]>;
}
