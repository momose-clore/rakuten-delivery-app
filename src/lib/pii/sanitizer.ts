/**
 * PII（個人情報）サニタイザー
 * audit_logs・error response・外部モニタリングから個人情報を除去する
 */

/** PII を含む可能性のあるフィールド名 */
const PII_FIELD_NAMES = new Set([
  "customerName",   "customer_name",
  "customerPhone",  "customer_phone",
  "address",
  "invoiceNo",      "invoice_no",
  "dispatchKey",    "dispatch_key",
]);

/** PII にあたる値のパターン */
const PII_VALUE_PATTERNS = [
  /^\d{10,11}$/,                         // 電話番号
  /^(\d{3}-\d{4}-\d{4}|\d{2,3}-\d{3,4}-\d{4})$/, // ハイフン付き電話番号
  /〒?\d{3}-\d{4}/,                      // 郵便番号
  /[都道府県市区町村]/,                    // 住所に含まれる可能性の高い文字
];

/** オブジェクトから PII フィールドを除去したコピーを返す */
export function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (PII_FIELD_NAMES.has(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string" && looksLikePii(value)) {
      result[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeForLog(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** 値が PII らしいかチェック */
function looksLikePii(value: string): boolean {
  return PII_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/** audit_logs の afterData / beforeData 用のサニタイズ */
export function sanitizeAuditData(
  data: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!data) return undefined;
  return sanitizeForLog(data);
}

/** エラーメッセージから PII を除去 */
export function sanitizeErrorMessage(message: string): string {
  let cleaned = message;
  // 電話番号パターンを除去
  cleaned = cleaned.replace(/\d{2,4}-\d{3,4}-\d{4}/g, "[TEL]");
  cleaned = cleaned.replace(/\d{10,11}/g, "[TEL]");
  // 郵便番号パターンを除去
  cleaned = cleaned.replace(/〒?\d{3}-\d{4}/g, "[ZIP]");
  return cleaned;
}
