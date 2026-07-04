import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractZip } from "./archive.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("extractZip", () => {
  it("extracts valid addon folders and skips metadata entries", async () => {
    const destDir = makeTempDir();
    const zip = createZip([
      { name: "GoodAddon/GoodAddon.toc", content: "## Title: GoodAddon\n" },
      { name: "GoodAddon/file.txt", content: "installed" },
      { name: "__MACOSX/GoodAddon/._file.txt", content: "metadata" },
      { name: "GoodAddon/.DS_Store", content: "metadata" },
    ]);

    const folders = await extractZip(zip, destDir);

    expect(folders).toEqual(["GoodAddon"]);
    expect(
      fs.readFileSync(path.join(destDir, "GoodAddon/file.txt"), "utf-8"),
    ).toBe("installed");
    expect(fs.existsSync(path.join(destDir, "__MACOSX"))).toBe(false);
    expect(fs.existsSync(path.join(destDir, "GoodAddon/.DS_Store"))).toBe(
      false,
    );
  });

  it("rejects traversal entries", async () => {
    const destDir = makeTempDir();
    const zip = createZip([{ name: "../escape.txt", content: "bad" }]);

    await expect(extractZip(zip, destDir)).rejects.toThrow(
      "Unsafe zip entry path",
    );
    expect(fs.existsSync(path.join(destDir, "escape.txt"))).toBe(false);
  });

  it("rejects Windows-style traversal entries", async () => {
    const destDir = makeTempDir();
    const zip = createZip([{ name: "Addon\\..\\escape.txt", content: "bad" }]);

    await expect(extractZip(zip, destDir)).rejects.toThrow(
      "Unsafe zip entry path",
    );
  });
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "surplus-test-"));
  tempDirs.push(dir);
  return dir;
}

interface ZipEntry {
  name: string;
  content: string;
}

function createZip(entries: ZipEntry[]): Buffer {
  const fileRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.from(entry.content);
    const crc = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([local, name, content]);
    fileRecords.push(localRecord);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralRecords.push(Buffer.concat([central, name]));

    offset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...fileRecords, centralDirectory, end]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
