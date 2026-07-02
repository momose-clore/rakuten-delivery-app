/**
 * CARIO API クライアント
 *
 * 認証ヘッダー付与・エラーハンドリング・タイムアウト処理を一元管理する。
 *
 * 環境変数優先順位:
 *   APIキー: RAKUTEN_APP_API_KEY → CARIO_API_KEY
 *   BaseURL: CARIO_API_BASE_URL
 */

/** デフォルトタイムアウト（環境変数 CARIO_TIMEOUT_MS で上書き可） */
const DEFAULT_TIMEOUT_MS = 15_000;

function getTimeoutMs(): number {
  return parseInt(process.env.CARIO_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10);
}

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
  // RAKUTEN_APP_API_KEY を優先、fallback は CARIO_API_KEY（後方互換）
  const key = process.env.RAKUTEN_APP_API_KEY ?? process.env.CARIO_API_KEY;
  const secret = process.env.CARIO_API_SECRET;
  if (!key) {
    throw new CarioApiError(
      "RAKUTEN_APP_API_KEY が設定されていません（CARIO_API_KEY も未設定）",
      0,
      "AUTH"
    );
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    ...(secret && { "X-Api-Secret": secret }),
  };
}

/** タイムアウト付き fetch */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * CARIO API への GET リクエスト（汎用）
 * @param path  例: "/drivers" or "/shifts?date=2026-01-01"
 */
export async function carioGet<T>(path: string): Promise<T> {
  const baseUrl = process.env.CARIO_API_BASE_URL;
  if (!baseUrl) {
    throw new CarioApiError("CARIO_API_BASE_URL が設定されていません", 0, "AUTH");
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${baseUrl}${path}`,
      { method: "GET", headers: buildHeaders(), cache: "no-store" },
      getTimeoutMs()
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CarioApiError("CARIO API がタイムアウトしました。再実行してください。", 0, "TIMEOUT");
    }
    throw new CarioApiError("CARIO API への接続に失敗しました", 0, "NETWORK");
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

/**
 * 楽天 CARIO assignments API 呼び出し
 * GET /api/external/rakuten/assignments?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * セキュリティ:
 * - APIキーをログに出さない
 * - URLをログに出さない（クエリにセンシティブな情報が含まれる可能性）
 * - 生レスポンスをログに出さない（個人情報を含む可能性）
 *
 * @param params.from 開始日（YYYY-MM-DD）
 * @param params.to   終了日（YYYY-MM-DD）
 * @returns レスポンス JSON（型は mapper で処理）
 * @throws CarioApiError
 */
export async function fetchRakutenAssignments(params: {
  from: string;
  to: string;
}): Promise<unknown> {
  const baseUrl = process.env.CARIO_API_BASE_URL ?? "https://cario-app-two.vercel.app";
  const path =
    process.env.CARIO_ASSIGNMENTS_PATH ?? "/api/external/rakuten/assignments";

  const apiKey = process.env.RAKUTEN_APP_API_KEY ?? process.env.CARIO_API_KEY;
  if (!apiKey) {
    throw new CarioApiError("RAKUTEN_APP_API_KEY が設定されていません", 0, "AUTH");
  }

  const url = new URL(path, baseUrl);
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);

  // ❌ ログ出力しない（URLにクエリパラメータ、APIキーが含まれる可能性）
  // console.log("Fetching CARIO:", url.toString());

  let res: Response;
  try {
    res = await fetchWithTimeout(
      url.toString(),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
      getTimeoutMs()
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CarioApiError(
        `CARIO API 呼び出しがタイムアウトしました（${getTimeoutMs()}ms）`,
        0,
        "TIMEOUT"
      );
    }
    throw new CarioApiError("CARIO API への接続に失敗しました", 0, "NETWORK");
  }

  // エラーレスポンスは {"error":"unauthorized"} 形式（確認済み）
  if (res.status === 401 || res.status === 403) {
    throw new CarioApiError(
      "CARIO API の認証に失敗しました（RAKUTEN_APP_API_KEY を確認してください）",
      res.status,
      "AUTH"
    );
  }
  if (res.status === 404) {
    throw new CarioApiError("CARIO API エンドポイントが見つかりません（URLパスを確認してください）", res.status, "SERVER");
  }
  if (res.status === 429) {
    throw new CarioApiError("CARIO API のレート制限に達しました。しばらく待ってから再試行してください", res.status, "SERVER");
  }
  if (res.status >= 500) {
    throw new CarioApiError(`CARIO サーバーエラーが発生しました（${res.status}）`, res.status, "SERVER");
  }
  if (!res.ok) {
    throw new CarioApiError(`CARIO API エラー: HTTP ${res.status}`, res.status, "SERVER");
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new CarioApiError("CARIO API のレスポンスが JSON 形式ではありません", 0, "SERVER");
  }

  // {"error": "..."} 形式のエラーレスポンスを検出
  // サーバーのエラー文字列は直接返さない（内部情報漏洩防止）
  if (data && typeof data === "object" && !Array.isArray(data) && "error" in data) {
    throw new CarioApiError(
      "CARIO API が一時的に利用できません。しばらく待ってから再試行してください。",
      res.status,
      "SERVER"
    );
  }

  // ❌ 生レスポンスをログしない（個人情報を含む可能性）
  // console.log("CARIO response:", data);

  return data;
}

/** CARIO API が設定済みかチェック（RAKUTEN_APP_API_KEY または CARIO_API_KEY） */
export function isCarioApiConfigured(): boolean {
  return !!(
    process.env.CARIO_API_BASE_URL &&
    (process.env.RAKUTEN_APP_API_KEY ?? process.env.CARIO_API_KEY)
  );
}

/** 接続モードを判定（UI表示用） */
export function getCarioConnectionMode(): "MOCK" | "REAL_API" {
  return isCarioApiConfigured() ? "REAL_API" : "MOCK";
}

/** 本番環境でMOCKを使用しているか（赤警告表示用） */
export function isProductionMock(): boolean {
  return process.env.NODE_ENV === "production" && !isCarioApiConfigured();
}
