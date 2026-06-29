const VISION_API_ENDPOINT =
  "https://vision.googleapis.com/v1/images:annotate";

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: { text: string };
    error?: { message: string };
  }>;
}

/** Google Cloud Vision API で画像からテキストを抽出する */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_VISION_API_KEY が設定されていません");
  }

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
    throw new Error(`Vision API エラー: HTTP ${res.status}`);
  }

  const data = (await res.json()) as VisionResponse;
  const response = data.responses[0];

  if (response?.error) {
    throw new Error(`Vision API エラー: ${response.error.message}`);
  }

  return response?.fullTextAnnotation?.text ?? "";
}
