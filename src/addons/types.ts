export type WowFlavor = "retail" | "classic";

export interface TocMetadata {
  title: string;
  version: string;
  author: string;
  notes: string;
  curseProjectId: string;
  wagoId: string;
  interface: string;
  dependencies: string;
  [key: string]: string;
}

export interface InstalledAddon {
  folderName: string;
  toc: TocMetadata;
  tocFile: string;
}

export interface TrackedAddon {
  source: "curseforge" | "github";
  id: string;
  version: string;
  installed_at: string;
  updated_at: string;
  folders: string[];
}

export interface TrackedAddons {
  [flavor: string]: {
    [addonName: string]: TrackedAddon;
  };
}
