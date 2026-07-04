/**
 * バーコード/QR デコード（無料・ローカル・非AI＝OCRエンジンとは別枠）。
 *
 * 目的: L1M貨物一覧表 左上の管理番号バーコード（実測 = Code128・「26始まり10桁」例 2606085017）を
 *       印字数字のOCRに頼らず**バーコードから直接・高精度**に取得する。
 *       → 取込のキー（伝票/管理番号）が確実になり、突合・重複排除・OCRクロスチェックが安定する。
 *
 * ※ 住所等は入っていない（数値キーのみ）。住所は従来どおりOCR。
 * ※ zxing-wasm は決定的デコーダで、Gemini/Cloud Vision等のAI-OCRではない。
 */
import sharp from "sharp";
import type * as SharpNS from "sharp";
import { readBarcodes } from "zxing-wasm";

export interface DecodedBarcode {
  format: string; // 例: "Code128", "QRCode", "DataMatrix", "DataBarStk"
  text: string;
}

/** sharp で画像を RGBA 画素へ（zxing-wasm 入力形式） */
async function toImageData(pipeline: SharpNS.Sharp) {
  const { data, info } = await pipeline
    .grayscale()
    .normalize()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
}

/**
 * 画像バッファから検出できたバーコードを全て返す。
 * 全体 → 左上クロップ（配車表の管理番号は左上）の順に試行し、重複排除して返す。
 */
export async function decodeBarcodes(imageBuffer: Buffer): Promise<DecodedBarcode[]> {
  const found = new Map<string, DecodedBarcode>();
  const push = (arr: { format: string; text: string }[]) => {
    for (const b of arr) if (b.text) found.set(`${b.format}:${b.text}`, { format: b.format, text: b.text });
  };

  let meta: SharpNS.Metadata;
  try {
    meta = await sharp(imageBuffer).metadata();
  } catch {
    return [];
  }
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return [];

  const attempts: Array<() => SharpNS.Sharp> = [
    () => sharp(imageBuffer).rotate(), // 全体
  ];
  // 左上（配車表の管理番号バーコード位置）を等倍＋2倍で
  const crop = { left: 0, top: 0, width: Math.round(W * 0.6), height: Math.round(H * 0.3) };
  attempts.push(() => sharp(imageBuffer).rotate().extract(crop));
  attempts.push(() => sharp(imageBuffer).rotate().extract(crop).resize({ width: crop.width * 2 }));

  for (const mk of attempts) {
    try {
      const img = await toImageData(mk());
      // 型: zxing-wasm v3 の入力型に合わせる（img は ImageData 互換の {data,width,height}）
      const res = await readBarcodes(img as unknown as Parameters<typeof readBarcodes>[0], { tryHarder: true, maxNumberOfSymbols: 20 });
      push(res.map((r) => ({ format: String(r.format), text: r.text })));
    } catch {
      // 個々の試行失敗は無視（次を試す）
    }
    if (found.size > 0 && mk === attempts[0]) break; // 全体で取れたら十分
  }
  return [...found.values()];
}

/**
 * L1M配車表の左上「管理番号」を返す（26始まり10桁を最優先、無ければ独立10桁）。
 * @returns 管理番号 or null
 */
export async function decodeL1MBarcode(imageBuffer: Buffer): Promise<string | null> {
  const codes = await decodeBarcodes(imageBuffer);
  const texts = codes.map((c) => c.text.replace(/\D/g, "")); // 数値化して比較
  return (
    texts.find((t) => /^26\d{8}$/.test(t)) ??
    texts.find((t) => /^\d{10}$/.test(t)) ??
    null
  );
}
