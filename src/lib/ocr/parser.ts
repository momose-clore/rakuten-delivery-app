import type { ParsedDeliveryItem } from "./types";
import { parseDispatchKey, findDispatchKey } from "./dispatch-no";

/**
 * Cloud Vision API から得たテキストを配送明細の配列に変換する。
 *
 * L1M 配車予定表のレイアウト前提:
 *   行ごとにスペース/タブ区切りで各フィールドが並ぶ。
 *   配車No（W1-11-1形式）を含む行を1明細の起点とする。
 *
 * OCR精度を過信しない設計:
 *   - パースに失敗したフィールドは null にする
 *   - 明細が0件でも空配列を返す（エラーにしない）
 */
export function parseDispatchText(rawText: string): ParsedDeliveryItem[] {
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

    // 配車No行を起点に、次の配車No行または末尾までを1明細のブロックとする
    const blockLines: string[] = [];
    blockLines.push(lines[i]);
    i++;
    while (i < lines.length && !findDispatchKey(lines[i])) {
      blockLines.push(lines[i]);
      i++;
    }

    const item = parseBlock(dispatchKeyRaw, blockLines);
    items.push(item);
  }

  return items;
}

function parseBlock(
  dispatchKeyRaw: string,
  lines: string[]
): ParsedDeliveryItem {
  const block = lines.join(" ");

  const keyParts = parseDispatchKey(dispatchKeyRaw);

  // 伝票No: 8〜12桁の数字
  const invoiceMatch = block.match(/\b(\d{8,12})\b/);
  const invoiceNo = invoiceMatch ? invoiceMatch[1] : null;

  // 電話番号: ハイフンありなし両対応
  const phoneMatch = block.match(/0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}/);
  const customerPhone = phoneMatch
    ? phoneMatch[0].replace(/[-\s]/g, "")
    : null;

  // 住所: 都道府県から始まる文字列
  const addressMatch = block.match(
    /([東京都|大阪府|京都府|北海道]|.+[都道府県])[\S\s]*?(?=\s{2,}|\d{3}-|\d{10,}|$)/
  );
  const address = addressMatch ? addressMatch[0].trim() : extractAddress(block);

  // 氏名: 住所・電話番号・配車Noを除いたカタカナ/漢字の塊（2〜8文字）
  const nameMatch = block
    .replace(dispatchKeyRaw, "")
    .replace(address ?? "", "")
    .replace(customerPhone ?? "", "")
    .match(/[ぁ-んァ-ン一-龠]{2,8}/);
  const customerName = nameMatch ? nameMatch[0] : null;

  // 数量欄: 連続する4つの整数（常温 クーラー ケース 総数）
  const counts = extractCounts(block);

  // 特殊フラグ: ○×△などの記号
  const flagMatch = block.match(/[○×△◎]/);
  const specialFlag = flagMatch ? flagMatch[0] : null;

  // 備考: ※や【】で囲まれた部分
  const memoMatch = block.match(/[※【](.+?)[】]?$/);
  const memo = memoMatch ? memoMatch[1].trim() : null;

  return {
    dispatchKey: keyParts?.dispatchKey ?? dispatchKeyRaw,
    waveNo: keyParts?.waveNo ?? null,
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

/** ブロックから数量4項目（常温・クーラー・ケース・総数）を抽出 */
function extractCounts(block: string): [number | null, number | null, number | null, number | null] {
  // スペース区切りで並ぶ 1〜3桁の整数を最大4つ抽出
  const nums = [...block.matchAll(/\b(\d{1,3})\b/g)]
    .map((m) => parseInt(m[1], 10))
    .filter((n) => n >= 0 && n <= 999);

  if (nums.length >= 4) {
    // 末尾4つ（配車予定表では数量欄が行末寄りに配置されることが多い）
    const tail = nums.slice(-4);
    return [tail[0], tail[1], tail[2], tail[3]];
  }
  return [null, null, null, null];
}

/** 都道府県パターンに依存しない住所抽出（補助） */
function extractAddress(block: string): string | null {
  // 「丁目」「番地」「号」を含む文字列
  const match = block.match(/[\S]+[丁目番地号室]/);
  return match ? match[0] : null;
}
