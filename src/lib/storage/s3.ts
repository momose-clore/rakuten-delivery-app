/**
 * AWS S3（または S3互換）ストレージ Provider
 *
 * 使用するには以下が必要:
 *   1. npm install @aws-sdk/client-s3
 *   2. 環境変数を設定（下記参照）
 *
 * src/lib/storage/index.ts を以下に変更して有効化:
 *   export { s3Provider as storageProvider } from "./s3";
 */
import type { StorageProvider, SaveResult } from "./types";

// @aws-sdk/client-s3 は npm install 後に有効になる
// import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BUCKET = process.env.S3_BUCKET_NAME ?? "";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PREFIX = "dispatch-images";

export const s3Provider: StorageProvider = {
  async save(buffer: Buffer, filename: string): Promise<SaveResult> {
    // TODO: npm install @aws-sdk/client-s3 後にコメントを外す
    // const client = new S3Client({ region: process.env.AWS_REGION });
    // const key = `${PREFIX}/${filename}`;
    // await client.send(new PutObjectCommand({
    //   Bucket: BUCKET,
    //   Key: key,
    //   Body: buffer,
    //   ContentType: "image/jpeg",
    // }));
    // const url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    // return { url, storagePath: key };

    void buffer; void filename;
    throw new Error(
      "S3 Provider は未設定です。" +
      "npm install @aws-sdk/client-s3 を実行し、環境変数を設定してください。"
    );
  },

  async read(url: string): Promise<Buffer> {
    // TODO: 有効化後は以下を使用（署名付き URL または直接取得）
    // const res = await fetch(url);
    // return Buffer.from(await res.arrayBuffer());

    void url;
    throw new Error("S3 Provider は未設定です。");
  },

  async delete(storagePath: string): Promise<void> {
    // TODO: 有効化後は以下を使用
    // const client = new S3Client({ region: process.env.AWS_REGION });
    // await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storagePath }));

    void storagePath;
    throw new Error("S3 Provider は未設定です。");
  },
};

/**
 * 必要な環境変数:
 *   AWS_ACCESS_KEY_ID      IAM アクセスキー
 *   AWS_SECRET_ACCESS_KEY  IAM シークレットキー
 *   AWS_REGION             S3 バケットのリージョン（例: ap-northeast-1）
 *   S3_BUCKET_NAME         バケット名
 *
 * 有効化手順:
 *   1. npm install @aws-sdk/client-s3
 *   2. AWS IAM でバケットへのアクセス権限を持つユーザーを作成
 *   3. 環境変数を設定
 *   4. src/lib/storage/index.ts の export 行を変更
 *   5. このファイルの TODO コメントを外す
 */
