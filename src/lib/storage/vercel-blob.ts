/**
 * Vercel Blob ストレージ Provider
 *
 * 必要な環境変数:
 *   BLOB_READ_WRITE_TOKEN  Vercel ダッシュボードで自動生成されるトークン
 *
 * 有効化手順:
 *   1. Vercel ダッシュボード → Storage → Create Blob Store
 *   2. vercel env pull .env.local（BLOB_READ_WRITE_TOKEN が自動追加）
 *   3. src/lib/storage/index.ts の export 行を変更:
 *      export { vercelBlobProvider as storageProvider } from "./vercel-blob";
 */
import { put, del } from "@vercel/blob";
import type { StorageProvider, SaveResult } from "./types";

const BLOB_PREFIX = "dispatch-images";

export const vercelBlobProvider: StorageProvider = {
  async save(buffer: Buffer, filename: string): Promise<SaveResult> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN が設定されていません");

    // sharp の .toBuffer() 等は SharedArrayBuffer 裏付けの Buffer を返すことがあり、
    // put() 内部の fetch が「SharedArrayBuffer is not allowed」で失敗する。
    // Buffer.from でデータを通常の ArrayBuffer 裏付けにコピーしてから送信する。
    const body = Buffer.from(buffer);

    const blob = await put(`${BLOB_PREFIX}/${filename}`, body, {
      access: "public",
      token,
    });

    return {
      url: blob.url,
      storagePath: blob.url, // Vercel Blob では URL が storagePath を兼ねる
    };
  },

  async read(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Vercel Blob の読み取りに失敗しました: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },

  async delete(storagePath: string): Promise<void> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN が設定されていません");
    // storagePath は Vercel Blob では URL そのもの
    await del(storagePath, { token });
  },
};
