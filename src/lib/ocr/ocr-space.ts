/**
 * OCR.space API による OCR（無料・APIキー不要でテスト可能）
 *
 * 無料プラン: 月25,000リクエスト、登録不要のデモキーあり
 * 本番用APIキー取得: https://ocr.space/ocrapi/freekey
 *
 * 環境変数 OCR_SPACE_API_KEY を設定すると本番用キーを使用
 * 未設定の場合はデモキー "helloworld" を使用（1MB以下・1日500回制限）
 */

interface OcrSpaceResponse {
  ParsedResults?: Array<{
    ParsedText?: string;
    ErrorMessage?: string;
  }>;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
}

export async function extractTextWithOcrSpace(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY ?? "helloworld";

  // base64 に変換
  const base64 = imageBuffer.toString("base64");
  const mimeType = "image/jpeg";

  const formData = new FormData();
  formData.append("base64Image", `data:${mimeType};base64,${base64}`);
  formData.append("language", "jpn");
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("OCREngine", "2"); // Engine2: 高精度モード

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: apiKey },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`OCR.space API エラー: HTTP ${res.status}`);
  }

  const data = (await res.json()) as OcrSpaceResponse;

  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(", ")
      : (data.ErrorMessage ?? "不明なエラー");
    throw new Error(`OCR.space エラー: ${msg}`);
  }

  return data.ParsedResults?.map((r) => r.ParsedText ?? "").join("\n") ?? "";
}
