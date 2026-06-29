import { createWorker } from "tesseract.js";

/**
 * Tesseract.js で画像からテキストを抽出する（無料・APIキー不要）
 * 日本語と英語の混在に対応
 */
export async function extractTextWithTesseract(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker("jpn+eng", 1, {
    // Vercel のサーバーレス環境向け設定
    logger: () => {}, // ログ無効化（個人情報保護）
  });

  try {
    const { data } = await worker.recognize(imageBuffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
