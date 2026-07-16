import { correctAddressMisreads } from "../misread-dictionary";

export interface AddressResult {
  value: string | null;
  suspect: boolean;
  autoCorrected: boolean;
}

const ADDRESS_WORDS = /[都道府県市区町村丁目番地号室棟]/u;

export function extractAddress(raw: string): AddressResult {
  let s = raw;

  // 電話番号を除去
  s = s.replace(/0\d[\d\s\-]{8,11}/g, "");
  // 伝票No(10桁以上)を除去
  s = s.replace(/\d{10,}/g, "");
  // 末尾の単独数字(住所番地でない可能性)を除去
  s = s.replace(/\s+\d{1,3}$/, "");
  s = s.trim();

  if (!s || s.length < 3) return { value: null, suspect: false, autoCorrected: false };

  // 地名誤読補正
  const { value: corrected, corrected: wasCorrected } = correctAddressMisreads(s);

  const hasAddressWord = ADDRESS_WORDS.test(corrected);
  const suspect = corrected.length < 8 || !hasAddressWord;

  return { value: corrected, suspect, autoCorrected: wasCorrected };
}
