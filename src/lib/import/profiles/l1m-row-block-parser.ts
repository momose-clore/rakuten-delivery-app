/**
 * L1M 明細ブロックパーサー
 * 1配送先 = 複数サブ行（伝票No/氏名/連絡先/住所）のブロック構造を復元する。
 */
import type { OcrWord } from "@/lib/ocr/ocrspace";
import type { NormalizedDispatchRow, L1MMetadata } from "@/types/import";
import { extractDispatchKey } from "@/lib/ocr/extractors/dispatch-key";
import { extractInvoiceNo } from "@/lib/ocr/extractors/invoice";
import { extractPhone } from "@/lib/ocr/extractors/phone";
import { extractAddress } from "@/lib/ocr/extractors/address";
import { extractCounts } from "@/lib/ocr/extractors/counts";
import { extractName } from "@/lib/ocr/extractors/name";
import { correctDigitMisreads, toHalfWidth } from "@/lib/ocr/misread-dictionary";

const DISPATCH_KEY_RE = /^\d{1,3}-\d{1,2}$/;

function numEnv(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 左カラムの同一行語から配車Noを復元する。
 * OCRが `11-1` を `11` + `1`（ハイフン欠落）や `l1-l` 等に分割・誤読しても、
 * 行内の数値トークン2つ（N=1〜3桁, M=1〜2桁）から `N-M` を組み立てて取りこぼしを防ぐ。
 * 実データ（CamScanner PDF）で分割・ハイフン欠落を確認したための復元処理。
 */
function reconstructDispatchKey(rowWords: OcrWord[]): string | null {
  // 1) 既に1単語で配車No形式（誤読補正込み）ならそれを採用
  for (const w of rowWords) {
    const s = w.text.trim();
    if (DISPATCH_KEY_RE.test(s)) return s;
    const c = correctDigitMisreads(toHalfWidth(s));
    if (DISPATCH_KEY_RE.test(c)) return c;
  }
  // 2) 分割ケース：左→右の数値トークン2つで N-M を復元
  const nums = rowWords
    .slice()
    .sort((a, b) => a.left - b.left)
    .map((w) => correctDigitMisreads(toHalfWidth(w.text)).replace(/[^\d]/g, ""))
    .filter((t) => t.length >= 1 && t.length <= 3);
  if (nums.length >= 2 && nums[0].length <= 3 && nums[1].length <= 2) {
    return `${nums[0]}-${nums[1]}`;
  }
  return null;
}

/** OCR単語から L1M 明細ブロックを抽出 */
export function parseL1MRowBlocks(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number,
  meta: L1MMetadata
): NormalizedDispatchRow[] {
  // y座標でソート
  const sorted = [...words].sort((a, b) => a.top - b.top);

  // 領域の境界（左: 配車No/特殊フラグ、中: お客様情報、右: 数量）
  // 配車No列は実測で左端10〜13%に分布するため 0.14 で列全体を含める（0.12だと2桁目が欠落し復元不能・実データで確認）。
  // 0.16以上にすると日付(2026/06/24)等を配車Noに誤検出するため上げすぎない。env で微調整可。
  const leftBoundary = imageWidth * numEnv("OCR_L1M_LEFT_BOUNDARY", 0.14);
  const quantityBoundary = imageWidth * numEnv("OCR_L1M_QTY_BOUNDARY", 0.76);

  // 左カラム語を「行」にクラスタリング（top近接）し、配車Noを含む行をブロック開始として検出
  const leftIdx: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].left < leftBoundary) leftIdx.push(i);
  }
  const rowTol = Math.max(median(leftIdx.map((i) => sorted[i].height)) * 0.7, imageHeight * 0.012);
  const clusters: number[][] = [];
  let prevTop = -Infinity;
  for (const i of leftIdx) {
    if (sorted[i].top - prevTop > rowTol) clusters.push([]);
    clusters[clusters.length - 1].push(i);
    prevTop = sorted[i].top;
  }

  // 配車No を含む行を「ブロック開始」として検出（分割・ハイフン欠落は reconstructDispatchKey で復元）
  const blockStarts: number[] = [];
  const blockKeys: string[] = [];
  for (const cl of clusters) {
    const key = reconstructDispatchKey(cl.map((i) => sorted[i]));
    if (key) {
      blockStarts.push(cl[0]);
      blockKeys.push(key);
    }
  }

  if (blockStarts.length === 0) return [];

  const rows: NormalizedDispatchRow[] = [];

  for (let b = 0; b < blockStarts.length; b++) {
    const startIdx = blockStarts[b];
    const endIdx = b + 1 < blockStarts.length ? blockStarts[b + 1] : sorted.length;
    const blockWords = sorted.slice(startIdx, endIdx);

    // 配車No（行クラスタから復元済みの値を使用：分割・ハイフン欠落に対応）
    const dispatchKeyRaw = blockKeys[b] ?? "";
    const dispatchKey = extractDispatchKey(dispatchKeyRaw, meta.waveNo);

    // 中央列の単語（お客様情報エリア）
    const centerWords = blockWords.filter(
      (w) => w.left >= leftBoundary && w.left < quantityBoundary
    ).sort((a, b) => a.top - b.top);

    // 数量列の単語（左→右に整列＝常温/クーラー/ケース/総数 の並びを保証）
    const quantityWords = blockWords
      .filter((w) => w.left >= quantityBoundary)
      .sort((a, b) => a.left - b.left);

    // 伝票No・氏名・電話・住所をラベルベースで抽出
    const centerText = centerWords.map((w) => w.text).join(" ");
    const invoiceNo = extractInvoiceNo(centerText);
    const { value: phone, valid: phoneValid } = extractPhone(centerText);

    // 氏名（「氏名」ラベル後の文字列）
    const nameMatch = centerText.match(/氏名[\s:：]*([\p{L}ぁ-んァ-ン一-龠\s]{2,20})/u);
    const customerName = nameMatch ? extractName(nameMatch[1]) : extractName(centerText);

    // 住所（「住所」ラベル後、または郵便番号パターンの後）
    const addressMatch = centerText.match(/住所[\s:：]*([\s\S]+?)(?:$|氏名|電話|伝票)/);
    const rawAddress = addressMatch ? addressMatch[1] : centerText;
    const { value: address, suspect: addressSuspect } = extractAddress(rawAddress);

    // 数量（数値のみ抽出して左→右で常温/クーラー/ケース/総数に割当）
    const qNums = quantityWords
      .map((w) => correctDigitMisreads(toHalfWidth(w.text)).replace(/[^\d]/g, ""))
      .filter((t) => t.length > 0);
    const { normalOricon, coolerBox, caseCount, totalCount } = extractCounts(
      qNums[0] ?? "", qNums[1] ?? "", qNums[2] ?? "", qNums[3] ?? ""
    );

    // メモ（数量エリア下の文章）
    const memoWords = quantityWords.filter((w) => {
      const txt = w.text;
      return txt.length > 5 && !/^\d+$/.test(txt);
    });
    const memo = memoWords.map((w) => w.text).join("") || null;

    const notes: string[] = [];
    if (!dispatchKey) notes.push("DISPATCH_KEY_MISSING");
    if (!invoiceNo) notes.push("INVOICE_MISSING");
    if (!address) notes.push("ADDRESS_EMPTY");
    else if (addressSuspect) notes.push("ADDRESS_SUSPECT");
    if (!phoneValid && phone) notes.push("PHONE_INVALID");
    const n = normalOricon ?? 0, c = coolerBox ?? 0, k = caseCount ?? 0, t = totalCount ?? 0;
    if (t > 0 && n + c + k !== t) notes.push("COUNT_MISMATCH");

    rows.push({
      source: "camera_ocr",
      rowNo: b + 1,
      waveNo: meta.waveNo,
      deliveryDate: meta.deliveryDate,
      area: meta.depotName,
      dispatchKey,
      invoiceNo,
      customerName,
      customerPhone: phoneValid ? phone : null,
      address,
      specialFlag: null,
      normalOriconCount: normalOricon ?? 0,
      coolerBoxCount: coolerBox ?? 0,
      caseCount: caseCount ?? 0,
      totalCount: totalCount ?? 0,
      memo,
      confidence: notes.length === 0 ? "high" : notes.length <= 2 ? "medium" : "low",
      notes,
      layoutProfile: "l1m_cargo_list",
    });
  }

  return rows;
}
