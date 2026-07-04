/**
 * Gemini（画像AI / ビジョンLLM）で L1M貨物一覧表を「構造化データ」として読み取る。
 *
 * 用途限定：**カメラ生写真専用**（斜め/横向き/密な表でも座標に頼らず意味で読める）。
 * PDF/スキャン画像は従来どおり OCR.space（無料・決定的）を使う＝ハイブリッド。
 * 出力は JSON スキーマで強制するため、OCRの「読み取り順の乱れ」問題が原理的に起きない。
 *
 * 方針変更（riku承認 2026-07-04）: 「OCR.spaceのみ・AI禁止」を"カメラOCRに限り"解除。
 * 無料枠のあるGemini(Flash)を使用。GEMINI_API_KEY 必須。
 * 個人情報（氏名/住所/電話）はここでは console.log しない。
 */
import type { NormalizedDispatchRow, ImportBatchResult, L1MMetadata } from "@/types/import";
import { calcBatchStats } from "@/lib/import/pipeline";
import { extractDispatchKey } from "@/lib/ocr/extractors/dispatch-key";

// gemini-flash-latest は無料枠で利用可（gemini-2.0-flash は無料枠対象外で429になることがある）
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    waveNo: { type: "string", description: "便 W1〜W6" },
    vehicleNo: { type: "string", description: "号車の数字のみ 例: 11" },
    deliveryDate: { type: "string", description: "YYYY-MM-DD" },
    depotName: { type: "string", description: "拠点名 例: 美女木" },
    barcodeText: { type: "string", description: "左上バーコードの数字" },
    deliveries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dispatchKey: { type: "string", description: "配車No 例: 11-1" },
          invoiceNo: { type: "string", description: "伝票No（数字）" },
          customerName: { type: "string" },
          customerPhone: { type: "string" },
          address: { type: "string", description: "郵便番号を除いた住所全体（都道府県から建物・部屋番号まで）" },
          normalOriconCount: { type: "integer", description: "常温" },
          coolerBoxCount: { type: "integer", description: "クーラー" },
          caseCount: { type: "integer", description: "ケース数" },
          totalCount: { type: "integer", description: "箱数計" },
        },
        required: ["dispatchKey", "invoiceNo", "address", "totalCount"],
      },
    },
  },
  required: ["deliveries"],
};

const PROMPT = `これは配送用の「L1M貨物一覧表」の写真です。斜め・横向き・回転していても正しい向きで読んでください。
表の各行（1配送）を上から順に、指定スキーマのJSONで**正確に書き起こして**ください。
ルール:
- 推測や創作をしない。読めない項目は空文字/0にする（でっち上げ禁止）。
- 配車No は「号車-連番」の形式（例: 11-1）。
- 伝票No は印字の数字をそのまま（15桁程度）。
- 住所は郵便番号を除き、都道府県→市区町村→丁目→番地→建物名・部屋番号 の順で1つの文字列に。
- 数量は 常温/クーラー/ケース数/箱数計 の各列の数字。空欄は0。
- 個人情報も含め、写真に見えるまま忠実に。`;

interface GeminiDelivery {
  dispatchKey?: string;
  invoiceNo?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  normalOriconCount?: number;
  coolerBoxCount?: number;
  caseCount?: number;
  totalCount?: number;
}
interface GeminiResult {
  waveNo?: string;
  vehicleNo?: string;
  deliveryDate?: string;
  depotName?: string;
  barcodeText?: string;
  deliveries?: GeminiDelivery[];
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** Gemini でカメラ写真から L1M を構造化抽出。未設定/失敗時は null（呼び出し側でOCR.spaceにフォールバック）。 */
export async function extractL1MWithGemini(
  imageBuffer: Buffer,
  mime: string = "image/jpeg"
): Promise<ImportBatchResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [
      { parts: [{ inline_data: { mime_type: mime, data: imageBuffer.toString("base64") } }, { text: PROMPT }] },
    ],
    generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}`);
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  let parsed: GeminiResult;
  try {
    parsed = JSON.parse(text) as GeminiResult;
  } catch {
    return null;
  }
  const deliveries = parsed.deliveries ?? [];
  if (deliveries.length === 0) return null;

  const meta: L1MMetadata = {
    waveNo: parsed.waveNo,
    vehicleNo: parsed.vehicleNo,
    deliveryDate: parsed.deliveryDate,
    depotName: parsed.depotName,
    barcodeText: parsed.barcodeText,
  };

  const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  const rows: NormalizedDispatchRow[] = deliveries.map((d, i) => {
    const n = int(d.normalOriconCount), c = int(d.coolerBoxCount), k = int(d.caseCount), t = int(d.totalCount);
    const notes: string[] = [];
    if (!d.dispatchKey) notes.push("DISPATCH_KEY_MISSING");
    if (!d.invoiceNo) notes.push("INVOICE_MISSING");
    if (!d.address) notes.push("ADDRESS_EMPTY");
    if (t > 0 && n + c + k !== t) notes.push("COUNT_MISMATCH");
    return {
      source: "camera_ocr",
      rowNo: i + 1,
      waveNo: parsed.waveNo,
      deliveryDate: parsed.deliveryDate,
      area: parsed.depotName ?? null,
      dispatchKey: d.dispatchKey?.trim() ? extractDispatchKey(d.dispatchKey.trim(), parsed.waveNo) : null,
      invoiceNo: (d.invoiceNo ?? "").replace(/[^\d]/g, "") || null,
      customerName: d.customerName?.trim() || null,
      customerPhone: (d.customerPhone ?? "").replace(/[^\d]/g, "") || null,
      address: d.address?.trim() || null,
      specialFlag: null,
      normalOriconCount: n,
      coolerBoxCount: c,
      caseCount: k,
      totalCount: t,
      memo: null,
      confidence: notes.length === 0 ? "high" : notes.length <= 2 ? "medium" : "low",
      notes,
      layoutProfile: "l1m_cargo_list",
    } as NormalizedDispatchRow;
  });

  const stats = calcBatchStats(rows);
  return {
    batchId: "",
    source: "camera_ocr",
    ...stats,
    rows,
    layoutProfile: "l1m_cargo_list",
    depotName: meta.depotName,
    waveNo: meta.waveNo,
    vehicleNo: meta.vehicleNo,
    deliveryDate: meta.deliveryDate,
  };
}
