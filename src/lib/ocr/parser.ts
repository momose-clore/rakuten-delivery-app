import type { ParsedDeliveryItem } from "./types";
import { parseDispatchKey, findDispatchKey } from "./dispatch-no";

/**
 * OCR テキストを配送明細の配列に変換する。
 *
 * 対応形式:
 *   - 配車No: W5-10-1 または 10-1（号車-明細）
 *   - W番号はヘッダー情報から補完
 */
export function parseDispatchText(rawText: string, defaultWaveNo?: string | null): ParsedDeliveryItem[] {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedDeliveryItem[] = [];
  let i = 0;

  while (i < lines.length) {
    const dispatchKeyRaw = findDispatchKey(lines[i]);
    if (!dispatchKeyRaw) {
      i++;
      continue;
    }

    const blockLines: string[] = [];
    blockLines.push(lines[i]);
    i++;
    while (i < lines.length && !findDispatchKey(lines[i])) {
      blockLines.push(lines[i]);
      i++;
    }

    const item = parseBlock(dispatchKeyRaw, blockLines, defaultWaveNo);
    items.push(item);
  }

  return items;
}

function parseBlock(
  dispatchKeyRaw: string,
  lines: string[],
  defaultWaveNo?: string | null
): ParsedDeliveryItem {
  const block = lines.join(" ");

  const keyParts = parseDispatchKey(dispatchKeyRaw, defaultWaveNo);

  // 伝票No: 8〜13桁の数字
  const invoiceMatch = block.match(/\b(\d{8,13})\b/);
  const invoiceNo = invoiceMatch ? invoiceMatch[1] : null;

  // 電話番号: ハイフンあり・なし両対応
  const phoneMatch = block.match(/0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}/);
  const customerPhone = phoneMatch
    ? phoneMatch[0].replace(/[-\s]/g, "")
    : null;

  // 住所
  const addressMatch = block.match(
    /([東京都|大阪府|京都府|北海道]|.+[都道府県])[\S\s]*?(?=\s{2,}|\d{3}-|\d{10,}|$)/
  );
  const address = addressMatch ? addressMatch[0].trim() : extractAddress(block);

  // 氏名
  const nameMatch = block
    .replace(dispatchKeyRaw, "")
    .replace(address ?? "", "")
    .replace(customerPhone ?? "", "")
    .match(/[ぁ-んァ-ン一-龠]{2,8}/);
  const customerName = nameMatch ? nameMatch[0] : null;

  // 数量欄（常温・クーラー・ケース・総数）
  const counts = extractCounts(block);

  // 特殊フラグ
  const flagMatch = block.match(/[○×△◎]/);
  const specialFlag = flagMatch ? flagMatch[0] : null;

  // 備考
  const memoMatch = block.match(/[※【](.+?)[】]?$/);
  const memo = memoMatch ? memoMatch[1].trim() : null;

  return {
    dispatchKey: keyParts?.dispatchKey ?? dispatchKeyRaw,
    waveNo: keyParts?.waveNo ?? defaultWaveNo ?? null,
    vehicleNo: keyParts?.vehicleNo ?? null,
    deliverySeq: keyParts?.deliverySeq ?? null,
    invoiceNo,
    customerName,
    customerPhone,
    address,
    specialFlag,
    normalOriconCount: counts[0],
    coolerBoxCount: counts[1],
    caseCount: counts[2],
    totalCount: counts[3],
    memo,
    reviewReasons: [],
  };
}

function extractCounts(block: string): [number | null, number | null, number | null, number | null] {
  const nums = [...block.matchAll(/\b(\d{1,3})\b/g)]
    .map((m) => parseInt(m[1], 10))
    .filter((n) => n >= 0 && n <= 999);

  if (nums.length >= 4) {
    const tail = nums.slice(-4);
    return [tail[0], tail[1], tail[2], tail[3]];
  }
  return [null, null, null, null];
}

function extractAddress(block: string): string | null {
  const match = block.match(/[\S]+[丁目番地号室]/);
  return match ? match[0] : null;
}
