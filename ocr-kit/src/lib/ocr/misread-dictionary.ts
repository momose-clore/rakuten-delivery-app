/**
 * OCR誤読辞書
 * 安全な変換のみ収録。個人情報を汎用補正しない。
 * 危険な補正は POSSIBLE_MISREAD として ocr_notes に記録するだけ。
 */

/**
 * 数字誤読補正（OCR頻出パターン）
 * ※ correctDigitMisreads は「数値/コード欄専用」。氏名・住所には使わない。
 */
const DIGIT_CORRECTIONS: [RegExp, string][] = [
  [/[Oo０]/g, "0"],
  [/[Ii１lｌ|｜!]/g, "1"],   // I,l,|,! → 1
  [/[Zz２]/g, "2"],
  [/[３]/g, "3"],
  [/[４]/g, "4"],
  [/[Ss５]/g, "5"],          // S → 5
  [/[６]/g, "6"],
  [/[７]/g, "7"],
  [/[Bb８]/g, "8"],          // B → 8
  [/[９]/g, "9"],
];

/** 各種ハイフン/ダッシュを半角ハイフンに統一（安全・全欄OK） */
export function normalizeHyphens(s: string): string {
  return s.replace(/[ー−–—―‐－]/g, "-");
}

/** 全角→半角変換（英数） */
export function toHalfWidth(s: string): string {
  return normalizeHyphens(s).replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );
}

/** 数字列内の誤読を補正（電話番号・伝票No・数量・配車No用。氏名/住所には使わない） */
export function correctDigitMisreads(s: string): string {
  let r = toHalfWidth(s);
  for (const [pattern, replacement] of DIGIT_CORRECTIONS) {
    r = r.replace(pattern, replacement);
  }
  return r;
}

/**
 * 住所地名誤読補正辞書
 * 完全一致のみ適用（部分一致は危険）
 */
const ADDRESS_CORRECTIONS: Record<string, string> = {
  "埼王": "埼玉",
  "埼玉県さいたま市見招区": "埼玉県さいたま市見沼区",
  "見招区": "見沼区",
  "足立医": "足立区",
  "葛節区": "葛飾区",
  "江戸川区小石川": "文京区小石川",
  "練馬区中村": "練馬区",
};

/** 住所内の安全な誤読を補正 */
export function correctAddressMisreads(address: string): { value: string; corrected: boolean } {
  for (const [wrong, correct] of Object.entries(ADDRESS_CORRECTIONS)) {
    if (address.includes(wrong)) {
      return { value: address.replace(wrong, correct), corrected: true };
    }
  }
  return { value: address, corrected: false };
}

/**
 * ヘッダー誤読の正規化
 * OCR で誤読されやすいヘッダー文字列を正規化する
 */
const HEADER_NORMALIZATIONS: [RegExp, string][] = [
  [/[Nn][Oo０oO]|ＮＯ|ＮＯ\./gi, "No"],
  [/傅票|電票|伝标|传票/g, "伝票"],
  [/住折|住戸|住柄/g, "住所"],
  [/電話番皆|電話帯/g, "電話番号"],
  [/常渥|常混/g, "常温"],
  [/オリコン|オリコン/g, "オリコン"],
];

export function normalizeHeaderText(s: string): string {
  let r = toHalfWidth(s);
  for (const [pattern, replacement] of HEADER_NORMALIZATIONS) {
    r = r.replace(pattern, replacement);
  }
  return r;
}

/** 配車No の誤読補正 */
export function correctDispatchKeyMisreads(s: string): string {
  return correctDigitMisreads(s)
    .replace(/[Wｗ]/, "W")
    .replace(/[\s_]/g, "-");
}
