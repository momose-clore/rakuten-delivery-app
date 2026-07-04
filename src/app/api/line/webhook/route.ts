import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// LINE Messaging API Webhook（テスト用: groupId 取得補助）
//
// 用途:
//   テストグループに公式アカウント(Bot)を招待し、グループで何かメッセージを送ると、
//   Bot が「このトークルームのID（groupId 等）」を返信する。
//   その値を .env の LINE_TEST_GROUP_ID に設定すれば「LINEテスト送信」が使える。
//
// 設定:
//   LINE Developers のチャネルで Webhook URL に  https://<デプロイ先>/api/line/webhook  を登録し、
//   Webhookを「オン」にする。LINE_CHANNEL_ACCESS_TOKEN が設定されていれば返信する。
//   LINE_CHANNEL_SECRET があれば署名検証する（未設定ならテスト用途として検証スキップ）。
//
// セキュリティ: トークン・生レスポンスをログに出さない。groupId は個人情報ではない。

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    // 本番では未設定＝検証不能なので拒否（fail-closed）。
    // 開発時のみ、署名検証をスキップして疎通確認できるようにする。
    return process.env.NODE_ENV !== "production";
  }
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface LineSource {
  type?: string;
  groupId?: string;
  roomId?: string;
  userId?: string;
}
interface LineEvent {
  replyToken?: string;
  source?: LineSource;
}

function pickId(src: LineSource): { kind: string; id: string } | null {
  if (src.groupId) return { kind: "groupId", id: src.groupId };
  if (src.roomId) return { kind: "roomId", id: src.roomId };
  if (src.userId) return { kind: "userId", id: src.userId };
  return null;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-line-signature");
  if (!verifySignature(raw, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const events = Array.isArray(payload.events) ? payload.events : [];
  const captured: string[] = [];

  for (const ev of events) {
    const src = ev.source ?? {};
    const picked = pickId(src);
    if (!picked) continue;
    captured.push(`${picked.kind}: ${picked.id}`);

    // グループIDの自動返信は既定OFF（本番グループでのスパム防止）。
    // 新しいグループのID取得が必要な時だけ env LINE_WEBHOOK_ECHO_GROUP_ID=1 で一時的に有効化する。
    if (token && ev.replyToken && process.env.LINE_WEBHOOK_ECHO_GROUP_ID === "1") {
      const text =
        `このトークルームのID\n${picked.kind}: ${picked.id}\n\n` +
        `増便テスト送信を使うには、この値を LINE_TEST_GROUP_ID に設定してください。`;
      await fetch(LINE_REPLY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ replyToken: ev.replyToken, messages: [{ type: "text", text }] }),
      }).catch(() => {
        /* 返信失敗は握りつぶす（webhookは200を返す） */
      });
    }
  }

  // LINE には常に 200 を返す。captured は Verify 時などの確認用。
  return NextResponse.json({ ok: true, captured });
}

export function GET() {
  return NextResponse.json({
    ok: true,
    hint: "LINE Webhook エンドポイント。LINE Developers の Webhook URL にこの URL を設定してください。",
  });
}
