/**
 * OCR エントリポイント
 * OCR_PROVIDER=ocrspace のみ。Gemini/AI fallback なし。
 */
import { runOcrSpace } from "./ocrspace";

export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const result = await runOcrSpace(imageBuffer);
  return result.parsedText;
}
// 将来の拡張ポイント: OCR_PROVIDER=gemini への切り替え（現在未実装・実行されない）
