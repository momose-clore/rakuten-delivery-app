/**
 * OCR.space API クライアント（座標付き）
 *
 * OCR_PROVIDER=ocrspace のみ使用。Gemini/AI fallback なし。
 * isOverlayRequired=true で単語座標を取得する。
 */

export interface OcrWord {
  text: string;
  left: number;    // pixel
  top: number;     // pixel
  width: number;
  height: number;
}

export interface OcrSpaceResult {
  parsedText: string;
  words: OcrWord[];
  imageWidth: number;
  imageHeight: number;
  provider: "ocrspace";
}

interface RawWord {
  WordText: string;
  Left: number;
  Top: number;
  Height: number;
  Width: number;
}

interface RawResponse {
  ParsedResults?: Array<{
    ParsedText?: string;
    ErrorMessage?: string;
    TextOverlay?: {
      Lines?: Array<{
        Words?: RawWord[];
      }>;
      HasOverlay?: boolean;
      Message?: string;
    };
  }>;
  OCRExitCode?: number;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  SearchablePDFURL?: string;
}

export async function runOcrSpace(imageBuffer: Buffer, mime: string = "image/jpeg"): Promise<OcrSpaceResult> {
  const configuredKey = process.env.OCR_SPACE_API_KEY;
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  // 本番環境ではデモキー fallback を禁止
  if (isProd && !configuredKey) {
    throw new Error(
      "本番環境では OCR_SPACE_API_KEY の設定が必須です。" +
      "Vercel ダッシュボードの Environment Variables に OCR_SPACE_API_KEY を設定してください。"
    );
  }

  // 開発環境のみデモキー fallback（1日500回・1MB以下制限あり）
  const apiKey = configuredKey ?? "helloworld";

  const formData = new FormData();
  const base64 = imageBuffer.toString("base64");
  formData.append("base64Image", `data:${mime};base64,${base64}`);
  if (mime === "application/pdf") formData.append("filetype", "PDF");
  formData.append("language", "jpn");
  formData.append("isOverlayRequired", "true");   // 座標情報を取得
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("OCREngine", "2");
  formData.append("isTable", "true");             // テーブルモード

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: apiKey },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`OCR.space HTTP ${res.status}`);
  }

  const data = (await res.json()) as RawResponse;

  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(", ")
      : (data.ErrorMessage ?? "OCR.space エラー");
    throw new Error(`OCR.space: ${msg}`);
  }

  const result = data.ParsedResults?.[0];
  if (!result) throw new Error("OCR.space: 結果が空です");

  if (result.ErrorMessage) {
    throw new Error(`OCR.space: ${result.ErrorMessage}`);
  }

  // 単語座標をフラットに収集
  const words: OcrWord[] = [];
  let maxRight = 0;
  let maxBottom = 0;

  for (const line of result.TextOverlay?.Lines ?? []) {
    for (const w of line.Words ?? []) {
      if (w.WordText.trim()) {
        words.push({
          text: w.WordText.trim(),
          left: w.Left,
          top: w.Top,
          width: w.Width,
          height: w.Height,
        });
        maxRight = Math.max(maxRight, w.Left + w.Width);
        maxBottom = Math.max(maxBottom, w.Top + w.Height);
      }
    }
  }

  return {
    parsedText: result.ParsedText ?? "",
    words,
    imageWidth: maxRight || 1,
    imageHeight: maxBottom || 1,
    provider: "ocrspace",
  };
}
