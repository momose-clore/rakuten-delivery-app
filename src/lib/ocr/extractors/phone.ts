import { correctDigitMisreads, toHalfWidth } from "../misread-dictionary";

export function extractPhone(raw: string): { value: string | null; valid: boolean } {
  const cleaned = correctDigitMisreads(toHalfWidth(raw)).replace(/[\s\-()]/g, "");
  const match = cleaned.match(/0\d{9,10}/);
  if (!match) return { value: cleaned.length > 5 ? cleaned : null, valid: false };
  return { value: match[0], valid: true };
}

/** テキストから電話番号を切り出す */
export function extractPhoneFromText(text: string): string {
  const corrected = correctDigitMisreads(toHalfWidth(text));
  const m = corrected.match(/0\d[\d\s\-]{8,11}/);
  return m ? m[0] : "";
}
