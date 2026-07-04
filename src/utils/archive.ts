import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fromBuffer } from "yauzl-promise";
import { downloadToBuffer } from "./http.js";

export async function downloadAndExtract(
  url: string,
  destDir: string,
): Promise<string[]> {
  const buffer = await downloadToBuffer(url);
  return extractZip(buffer, destDir);
}

export async function extractZip(
  buffer: Buffer,
  destDir: string,
): Promise<string[]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "surplus-"));
  const folders = new Set<string>();

  try {
    const zip = await fromBuffer(buffer);

    try {
      for await (const entry of zip) {
        const entryName = normalizeZipEntryName(entry.filename);

        // Skip macOS metadata
        if (isMetadataEntry(entryName)) {
          continue;
        }

        // Track top-level folders
        const topFolder = entryName.split("/")[0];
        if (topFolder) {
          folders.add(topFolder);
        }

        const fullPath = path.join(tmpDir, entryName);
        if (!isInside(tmpDir, fullPath)) {
          throw new Error(`Unsafe zip entry path: ${entry.filename}`);
        }

        if (entryName.endsWith("/")) {
          fs.mkdirSync(fullPath, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          const readStream = await entry.openReadStream();
          const writeStream = fs.createWriteStream(fullPath);
          await new Promise<void>((resolve, reject) => {
            readStream.pipe(writeStream);
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
            readStream.on("error", reject);
          });
        }
      }
    } catch (err) {
      if (isUnsafeZipPathError(err)) {
        throw new Error(
          `Unsafe zip entry path: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      throw err;
    }

    // Move extracted folders to destination
    const extractedFolders: string[] = [];
    for (const folder of folders) {
      const src = path.join(tmpDir, folder);
      const dest = path.join(destDir, folder);

      if (!isInside(tmpDir, src) || !isInside(destDir, dest)) {
        throw new Error(`Unsafe addon folder path: ${folder}`);
      }

      if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) continue;

      // Remove existing folder at destination
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true });
      }

      fs.cpSync(src, dest, { recursive: true });
      extractedFolders.push(folder);
    }

    return extractedFolders.sort();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function normalizeZipEntryName(entryName: string): string {
  if (entryName.includes("\\")) {
    throw new Error(`Unsafe zip entry path: ${entryName}`);
  }

  if (entryName.trim() === "" || path.posix.isAbsolute(entryName)) {
    throw new Error(`Unsafe zip entry path: ${entryName}`);
  }

  const isDirectory = entryName.endsWith("/");
  const normalized = path.posix.normalize(entryName);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new Error(`Unsafe zip entry path: ${entryName}`);
  }

  return isDirectory ? `${normalized}/` : normalized;
}

function isMetadataEntry(entryName: string): boolean {
  const parts = entryName.split("/").filter(Boolean);
  return parts.includes("__MACOSX") || parts.includes(".DS_Store");
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function isUnsafeZipPathError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  return err.message.startsWith("Relative path:");
}
