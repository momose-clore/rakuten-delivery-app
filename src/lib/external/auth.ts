// 外部連携（CARIO が当アプリを pull する）ためのインバウンド認証。
//
// CARIO からの GET/POST リクエストを Bearer トークンで認証する。
// トークンは当アプリが発行し、CARIO 側に共有する（当アプリが CARIO を呼ぶ
// RAKUTEN_APP_API_KEY とは別物・逆方向）。
//
// 必要な環境変数:
//   EXTRA_VEHICLE_PULL_TOKEN … CARIO に共有するインバウンド用トークン
//
// セキュリティ: トークンはログに出さない。比較はタイミングセーフに行う。

import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Authorization: Bearer <token> を検証。設定不備や不一致なら false。 */
export function isExternalRequestAuthorized(req: NextRequest): boolean {
  const expected = process.env.EXTRA_VEHICLE_PULL_TOKEN;
  if (!expected) return false; // 未設定ならすべて拒否（誤って全公開しない）

  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return false;

  return safeEqual(m[1], expected);
}
