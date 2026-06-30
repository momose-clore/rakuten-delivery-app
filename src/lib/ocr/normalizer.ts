/**
 * フィールド別正規化ルール
 * AI fallback なし。変換できないものはそのまま返し、confidence で要確認にする。
 */

/** 配車No 正規化: "W1-10-1" / "10-1" / "W1 10 1" / "W1_10_1" → 統一形式 */
export function normalizeDispatchKey(raw: string, defaultWaveNo?: string | null): string | null {
  const s = raw.trim().replace(/[\s_]/g, "-").toUpperCase();

  // W1-10-1 形式
  const full = s.match(/W([1-6])-(\d+)-(\d+)/);
  if (full) return `W${full[1]}-${full[2]}-${full[3]}`;

  // 10-1 形式（号車-明細）
  const short = s.match(/^(\d{1,3})-(\d{1,2})$/);
  if (short) {
    const w = defaultWaveNo?.toUpperCase() ?? null;
    return w ? `${w}-${short[1]}-${short[2]}` : `${short[1]}-${short[2]}`;
  }

  return null;
}

/** 伝票No 正規化: 10〜14桁の数字列 */
export function normalizeInvoiceNo(raw: string): string | null {
  const digits = raw.replace(/[\s\-]/g, "");
  const match = digits.match(/\d{10,14}/);
  return match ? match[0] : null;
}

/** 電話番号 正規化 */
export function normalizePhone(raw: string): { value: string | null; valid: boolean } {
  const digits = raw.replace(/[\s\-()]/g, "");
  const match = digits.match(/0\d{9,10}/);
  if (!match) return { value: digits.length > 5 ? digits : null, valid: false };
  return { value: match[0], valid: true };
}

/** 住所から伝票No・電話番号・数量っぽい数字を除去 */
export function normalizeAddress(raw: string): string | null {
  let s = raw;
  // 電話番号を除去
  s = s.replace(/0\d[\d\s\-]{8,11}/g, "");
  // 伝票Noっぽい10桁以上の数字列を除去
  s = s.replace(/\d{10,}/g, "");
  // 単体の2桁以下数字（数量の可能性）を除去（住所として不自然）
  s = s.replace(/\s+\d{1,3}\s+/g, " ");
  s = s.trim();
  return s.length >= 3 ? s : null;
}

/** 数量フィールド正規化: 数字以外除去 */
export function normalizeCount(raw: string): number | null {
  const match = raw.replace(/[^\d]/g, "").match(/^\d+$/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return n <= 9999 ? n : null;
}

/** 氏名: 住所語句・数量・電話番号を除去 */
export function normalizeName(raw: string): string | null {
  let s = raw;
  s = s.replace(/0\d[\d\s\-]{8,11}/g, ""); // 電話
  s = s.replace(/\d{10,}/g, "");            // 伝票
  s = s.replace(/[〒〜]/g, "");
  s = s.replace(/[都道府県市区町村]/g, (m) => m); // 住所語句を除去せず、後でチェック
  // 住所の特徴語句で始まる場合は null
  if (/^\d{3}[-ー]\d{4}/.test(s)) return null; // 郵便番号
  if (/[都道府県]/.test(s) && s.length > 5) return null; // 住所の可能性
  s = s.trim();
  return s.length >= 2 ? s : null;
}
