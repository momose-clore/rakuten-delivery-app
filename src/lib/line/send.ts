// LINE Messaging API へのテキスト push（増便通知のテスト送信などに使用）。
//
// 本番の増便報告は「CARIOが当アプリからpull→CARIO公式LINEで投稿」する方針。
// これは当アプリ側から文面を検証するための送信ツール（テスト用）。
//
// 必要な環境変数:
//   LINE_CHANNEL_ACCESS_TOKEN … LINE公式アカウント(Messaging API)のチャネルアクセストークン
//   LINE_TEST_GROUP_ID        … テスト送信先グループID（本番グループを汚さないため既定はこちら）
//
// セキュリティ: トークン・本文（個人情報を含む可能性）・生レスポンスをログに出さない。

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface PushResult {
  ok: boolean;
  message: string;
}

function getTimeoutMs(): number {
  return parseInt(process.env.LINE_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10);
}

/** テキストメッセージを指定グループ/ユーザーへ push する */
export async function pushLineText(to: string, text: string): Promise<PushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, message: "LINE_CHANNEL_ACCESS_TOKEN が未設定です。" };
  }
  if (!to) {
    return { ok: false, message: "送信先(to)が指定されていません。" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());
  let res: Response;
  try {
    res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    const timeout = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      message: timeout ? `LINE送信がタイムアウトしました（${getTimeoutMs()}ms）。` : "LINE APIへの接続に失敗しました。",
    };
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: "LINE認証に失敗しました（チャネルアクセストークンを確認してください）。" };
  }
  if (!res.ok) {
    return { ok: false, message: `LINE送信に失敗しました（HTTP ${res.status}）。グループIDや公式アカウントの参加状態を確認してください。` };
  }
  return { ok: true, message: "LINEへ送信しました。" };
}
