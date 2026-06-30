/**
 * フィールド別正規化ルール（強化版）
 */

export function normalizeDispatchKey(raw: string, defaultWaveNo?: string | null): string | null {
  const s = raw.trim().replace(/[\s_]/g, "-").toUpperCase();
  const full = s.match(/W([1-6])-(\d+)-(\d+)/);
  if (full) return `W${full[1]}-${full[2]}-${full[3]}`;
  const short = s.match(/^(\d{1,3})-(\d{1,2})$/);
  if (short) {
    const w = defaultWaveNo?.toUpperCase() ?? null;
    return w ? `${w}-${short[1]}-${short[2]}` : `${short[1]}-${short[2]}`;
  }
  return null;
}

export function normalizeInvoiceNo(raw: string): string | null {
  const digits = raw.replace(/[\s\-]/g, "");
  const match = digits.match(/\d{10,14}/);
  return match ? match[0] : null;
}

export function normalizePhone(raw: string): { value: string | null; valid: boolean } {
  const digits = raw.replace(/[\s\-()]/g, "");
  const match = digits.match(/0\d{9,10}/);
  if (!match) return { value: digits.length > 5 ? digits : null, valid: false };
  return { value: match[0], valid: true };
}

/**
 * 住所正規化（強化版）
 * - 電話番号・伝票Noを除去
 * - 番地・部屋番号の数字は保持
 * - 数量っぽい単独数字（住所の末尾）は除去
 * - 短すぎる住所は ADDRESS_SUSPECT フラグ
 */
export function normalizeAddress(raw: string): { value: string | null; suspect: boolean } {
  let s = raw;

  // 電話番号を除去
  s = s.replace(/0\d[\d\s\-]{8,11}/g, "");
  // 伝票Nっぽい10桁以上を除去
  s = s.replace(/\d{10,}/g, "");
  // 末尾の単独1〜3桁数字（番地でない可能性が高い）は除去
  s = s.replace(/\s+\d{1,3}$/, "");
  // 郵便番号の後の余分テキストは許容
  s = s.trim();

  if (!s || s.length < 3) return { value: null, suspect: false };

  // 住所として不自然に短い（都道府県や市区町村がない）
  const hasAddressWord = /[都道府県市区町村丁目番地号室棟]/u.test(s);
  const suspect = s.length < 8 || !hasAddressWord;

  return { value: s, suspect };
}

/**
 * 数量正規化（x座標列で厳密に分離するが、住所番地との混同を防ぐ）
 * isInQuantityColumn: 数量列x範囲内の単語かどうか
 */
export function normalizeCount(raw: string, isInQuantityColumn = true): number | null {
  if (!isInQuantityColumn) return null;
  const match = raw.replace(/[^\d]/g, "").match(/^\d+$/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  // 数量として非現実的な値（>9999）は除外
  return n <= 9999 ? n : null;
}

export function normalizeName(raw: string): string | null {
  let s = raw;
  s = s.replace(/0\d[\d\s\-]{8,11}/g, "");
  s = s.replace(/\d{10,}/g, "");
  s = s.replace(/[〒〜]/g, "");
  if (/^\d{3}[-ー]\d{4}/.test(s)) return null;
  if (/[都道府県]/.test(s) && s.length > 5) return null;
  s = s.trim();
  return s.length >= 2 ? s : null;
}
