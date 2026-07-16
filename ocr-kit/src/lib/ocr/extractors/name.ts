export function extractName(raw: string): string | null {
  let s = raw;
  // 電話番号・伝票No・郵便番号を除去
  s = s.replace(/0\d[\d\s\-]{8,11}/g, "");
  s = s.replace(/\d{10,}/g, "");
  s = s.replace(/[〒〜]/g, "");
  s = s.trim();

  // 住所の特徴語句で始まる場合は null
  if (/^\d{3}[-ー]\d{4}/.test(s)) return null;
  if (/[都道府県]/.test(s) && s.length > 5) return null;

  return s.length >= 2 ? s : null;
}
