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

    for await (const entry of zip) {
      const entryName = entry.filename;

      // Skip macOS metadata
      if (
        entryName.startsWith("__MACOSX/") ||
        entryName.endsWith(".DS_Store")
      ) {
        continue;
      }

      // Track top-level folders
      const topFolder = entryName.split("/")[0];
      if (topFolder) {
        folders.add(topFolder);
      }

      const fullPath = path.join(tmpDir, entryName);

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

    // Move extracted folders to destination
    const extractedFolders: string[] = [];
    for (const folder of folders) {
      const src = path.join(tmpDir, folder);
      const dest = path.join(destDir, folder);

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
