/**
 * CARIO API クライアント
 *
 * 認証ヘッダー付与・エラーハンドリング・タイムアウト処理を一元管理する。
 * CARIO 実API仕様が確定したら、このファイルのエンドポイントとヘッダーを調整する。
 */

const TIMEOUT_MS = 10_000; // 10秒タイムアウト

export class CarioApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly type: "AUTH" | "SERVER" | "TIMEOUT" | "NETWORK"
  ) {
    super(message);
    this.name = "CarioApiError";
  }
}

function buildHeaders(): HeadersInit {
  const key = process.env.CARIO_API_KEY;
  const secret = process.env.CARIO_API_SECRET;
  if (!key) throw new CarioApiError("CARIO_API_KEY が設定されていません", 0, "AUTH");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    // TODO: CARIO実API仕様確定後、認証方式（Bearer / Basic / カスタムヘッダー等）を調整
    ...(secret && { "X-Api-Secret": secret }),
  };
}

/**
 * CARIO API への GET リクエスト
 * @param path  例: "/drivers" or "/shifts?date=2026-01-01"
 */
export async function carioGet<T>(path: string): Promise<T> {
  const baseUrl = process.env.CARIO_API_BASE_URL;
  if (!baseUrl) throw new CarioApiError("CARIO_API_BASE_URL が設定されていません", 0, "AUTH");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: buildHeaders(),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new CarioApiError("CARIO API がタイムアウトしました。再実行してください。", 0, "TIMEOUT");
    }
    throw new CarioApiError("CARIO API への接続に失敗しました", 0, "NETWORK");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new CarioApiError("CARIO API の認証に失敗しました（APIキーを確認してください）", res.status, "AUTH");
  }
  if (res.status >= 500) {
    throw new CarioApiError(`CARIO サーバーエラーが発生しました（${res.status}）`, res.status, "SERVER");
  }
  if (!res.ok) {
    throw new CarioApiError(`CARIO API エラー: HTTP ${res.status}`, res.status, "SERVER");
  }

  return res.json() as Promise<T>;
}

/** CARIO API が設定済みかチェック */
export function isCarioApiConfigured(): boolean {
  return !!(process.env.CARIO_API_BASE_URL && process.env.CARIO_API_KEY);
}
