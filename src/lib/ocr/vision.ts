import { extractTextWithTesseract } from "./tesseract";

const VISION_API_ENDPOINT =
  "https://vision.googleapis.com/v1/images:annotate";

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: { text: string };
    error?: { message: string };
  }>;
}

/**
 * 画像からテキストを抽出する。
 * GOOGLE_CLOUD_VISION_API_KEY が設定されていれば Cloud Vision API を使用、
 * 未設定の場合は Tesseract.js（無料・APIキー不要）にフォールバック。
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  // APIキーがない or 空 → Tesseract.js を使用
  if (!apiKey) {
    console.log("[OCR] GOOGLE_CLOUD_VISION_API_KEY 未設定のため Tesseract.js を使用");
    return extractTextWithTesseract(imageBuffer);
  }

  try {
    const body = {
      requests: [
        {
          image: { content: imageBuffer.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["ja"] },
        },
      ],
    };

    const res = await fetch(`${VISION_API_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Vision API HTTP ${res.status}`);
    }

    const data = (await res.json()) as VisionResponse;
    const response = data.responses[0];

    if (response?.error) {
      throw new Error(`Vision API: ${response.error.message}`);
    }

    return response?.fullTextAnnotation?.text ?? "";
  } catch (err) {
    // Cloud Vision 失敗 → Tesseract.js にフォールバック
    console.log("[OCR] Cloud Vision 失敗、Tesseract.js にフォールバック:", err instanceof Error ? err.message : err);
    return extractTextWithTesseract(imageBuffer);
  }
}
