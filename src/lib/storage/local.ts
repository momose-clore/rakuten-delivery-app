import fs from "fs/promises";
import path from "path";
import type { StorageProvider, SaveResult } from "./types";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "dispatch-images");
const PUBLIC_PREFIX = "/uploads/dispatch-images";

export const localStorageProvider: StorageProvider = {
  async save(buffer: Buffer, filename: string): Promise<SaveResult> {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(filepath, buffer);
    return {
      url: `${PUBLIC_PREFIX}/${filename}`,
      storagePath: filepath,
    };
  },

  async read(url: string): Promise<Buffer> {
    // /uploads/dispatch-images/filename.jpg → public/uploads/dispatch-images/filename.jpg
    const relativePath = url.startsWith("/") ? url.slice(1) : url;
    const filepath = path.join(process.cwd(), "public", relativePath);
    return fs.readFile(filepath);
  },

  async delete(storagePath: string): Promise<void> {
    await fs.unlink(storagePath).catch(() => {
      // ファイルが存在しない場合は無視
    });
  },
};
