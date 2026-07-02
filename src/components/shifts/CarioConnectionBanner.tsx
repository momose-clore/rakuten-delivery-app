"use client";

import { Button } from "@/components/ui/button";
import type { CarioConnectionDisplay } from "@/types/shift";

/**
 * CARIO 接続状態バナー。
 *
 * 表示するもの: 接続モード（MOCK / REAL_API / LAST_IMPORTED）・最終取込日時・
 * 対象日・stale 理由。
 * ⚠️ APIキー・Authorization・env 実値は一切表示しない（安全な表示のみ）。
 */
export function CarioConnectionBanner({
  connection,
  onApproveStale,
  approving,
}: {
  connection: CarioConnectionDisplay;
  onApproveStale?: () => void;
  approving?: boolean;
}) {
  const { mode, isProductionMock, isStale, sourceStatus, staleReason, lastImportedAt, targetDate } =
    connection;

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "未取込";
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── 本番でモック使用中（最優先の赤警告） ──
  if (isProductionMock) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4">
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none">🛑</span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              本番環境でモックデータを使用中です
            </p>
            <p className="mt-1 text-xs text-red-700">
              CARIO API が未接続のため、実データではなくサンプルデータが表示されています。
              <br />
              管理者は <code className="rounded bg-red-100 px-1">RAKUTEN_APP_API_KEY</code> を環境変数に設定してください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── 前回取込データ表示中（stale・赤警告） ──
  if (mode === "LAST_IMPORTED" || isStale) {
    const alreadyApproved = sourceStatus === "USER_APPROVED";
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4">
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              前回取込データを表示中（最新ではありません）
            </p>
            <p className="mt-1 text-xs text-red-700">
              {staleReason ?? "最新データを取得できていません。"}
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-red-700">
              <dt className="font-medium">対象日</dt>
              <dd>{targetDate}</dd>
              <dt className="font-medium">最終取込日時</dt>
              <dd>{formatDateTime(lastImportedAt)}</dd>
              <dt className="font-medium">状態</dt>
              <dd>
                {alreadyApproved ? "管理者が継続使用を承認済み" : "未承認（再取込を推奨）"}
              </dd>
            </dl>
            {!alreadyApproved && onApproveStale && (
              <Button
                onClick={onApproveStale}
                disabled={approving}
                className="mt-3 bg-red-600 text-white hover:bg-red-700"
              >
                {approving ? "承認中..." : "前回データの継続使用を承認"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── モックデータ（開発環境・情報表示） ──
  if (mode === "MOCK") {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none">🧪</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">モックデータ（CARIO 未接続）</p>
            <p className="mt-1 text-xs text-amber-700">
              開発用サンプルデータを表示しています。実データを取得するには CARIO API キーの設定が必要です。
              {lastImportedAt && <>（最終取込: {formatDateTime(lastImportedAt)}）</>}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── REAL_API 接続中（正常・緑） ──
  return (
    <div className="rounded-lg border border-green-300 bg-green-50 p-4">
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">🟢</span>
        <div>
          <p className="text-sm font-semibold text-green-800">CARIO 実 API 接続（REAL_API）</p>
          <p className="mt-1 text-xs text-green-700">
            CARIO から取得した最新データを表示しています。
            {lastImportedAt && <>（最終取込: {formatDateTime(lastImportedAt)}）</>}
          </p>
        </div>
      </div>
    </div>
  );
}
