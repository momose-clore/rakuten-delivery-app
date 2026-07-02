/**
 * ハッシュ化ユーティリティ
 * audit_logs の targetId など、逆検索不可のハッシュを生成する
 */
import { createHash, createHmac } from "crypto";

/** ソルト（AUDIT_LOG_HASH_SALT → NEXTAUTH_SECRET → fallback の優先順） */
function getSalt(): string {
  return (
    process.env.AUDIT_LOG_HASH_SALT ??
    process.env.NEXTAUTH_SECRET ??
    "audit-salt-fallback"
  );
}

/**
 * HMAC-SHA256 でハッシュ化（逆検索不可）
 * context を含めることで異なる用途のハッシュを分離する
 */
export function hashWithSalt(value: string, context = "default"): string {
  const salt = getSalt();
  return createHmac("sha256", salt)
    .update(`${value}:${context}`)
    .digest("hex")
    .substring(0, 32);
}

/** SHA256 単純ハッシュ（ソルトなし、コンテンツ照合用） */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
