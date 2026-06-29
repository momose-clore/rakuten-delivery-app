import { extractTextWithOcrSpace } from "./ocr-space";

const VISION_API_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: { text: string };
    error?: { message: string };
  }>;
}

/**
 * OCR エンジンの優先順位:
 * 1. Google Cloud Vision API（GOOGLE_CLOUD_VISION_API_KEY が設定済みで動作する場合）
 * 2. OCR.space（無料・高速・Vercel 10秒制限内）
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const visionKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  // Cloud Vision API を試みる
  if (visionKey) {
    try {
      const body = {
        requests: [{
          image: { content: imageBuffer.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["ja"] },
        }],
      };
      const res = await fetch(`${VISION_API_ENDPOINT}?key=${visionKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as VisionResponse;
        const r = data.responses[0];
        if (!r?.error && r?.fullTextAnnotation?.text) {
          return r.fullTextAnnotation.text;
        }
      }
    } catch {
      // フォールバック
    }
  }

  // OCR.space（無料・高速・デモキー helloworld で即時利用可能）
  return extractTextWithOcrSpace(imageBuffer);
}
