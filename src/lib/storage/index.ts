/**
 * アクティブなストレージ Provider を切り替えるポイント。
 * この1行を変更するだけで全体のストレージ先が変わる。
 *
 * 開発（ローカル）:     localStorageProvider  → public/uploads/ に保存
 * 本番（Vercel Blob）: vercelBlobProvider    → BLOB_READ_WRITE_TOKEN が必要
 * 本番（S3）:          s3Provider            → AWS_* 環境変数が必要
 */

// ─── 本番（Vercel Blob） ───────────────────────────────────
export { vercelBlobProvider as storageProvider } from "./vercel-blob";

// ─── 開発（ローカル）※本番ではコメントアウト ──────────────
// export { localStorageProvider as storageProvider } from "./local";

// ─── 本番（S3）※S3 利用時はこちらに切り替え ──────────────
// export { s3Provider as storageProvider } from "./s3";

export type { StorageProvider, SaveResult } from "./types";
