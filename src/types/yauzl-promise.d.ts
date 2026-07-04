declare module "yauzl-promise" {
  import type { Readable } from "node:stream";

  interface Entry {
    filename: string;
    compressedSize: number;
    uncompressedSize: number;
    openReadStream(): Promise<Readable>;
  }

  interface ZipFile {
    entryCount: number;
    [Symbol.asyncIterator](): AsyncIterableIterator<Entry>;
  }

  export function fromBuffer(buffer: Buffer): Promise<ZipFile>;
}
