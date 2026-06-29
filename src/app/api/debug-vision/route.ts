import { NextResponse } from "next/server";

// Cloud Vision API の動作確認用（確認後に削除する）
export async function GET() {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_CLOUD_VISION_API_KEY が未設定" });

  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { source: { imageUri: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/120px-PNG_transparency_demonstration_1.png" } },
            features: [{ type: "LABEL_DETECTION", maxResults: 1 }],
          }],
        }),
      }
    );
    const data = await res.json();
    if (data.error) return NextResponse.json({ ok: false, error: data.error.message, status: data.error.code });
    return NextResponse.json({ ok: true, keyPrefix: apiKey.substring(0, 10) + "..." });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
