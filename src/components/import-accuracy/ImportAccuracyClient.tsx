"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { REVIEW_REASON_LABELS, type ReviewReason } from "@/types/dispatch";

interface AccuracyRow {
  dispatchImageId: string;
  deliveryDate: string;
  area: string | null;
  waveNo: string | null;
  ocrStatus: string;
  totalItemCount: number;
  totalFieldCount: number;
  confirmedFieldCount: number;
  autoRescuedFieldCount: number;
  manualFixedFieldCount: number;
  adminApprovedFieldCount: number;
  needsReviewFieldCount: number;
  lowConfidenceFieldCount: number;
  estimatedFieldCount: number;
  noMetadataItemCount: number;
  accuracyPercent: number;
}

interface AccuracyTotals {
  imageCount: number;
  totalItemCount: number;
  totalFieldCount: number;
  confirmedFieldCount: number;
  autoRescuedFieldCount: number;
  manualFixedFieldCount: number;
  adminApprovedFieldCount: number;
  needsReviewFieldCount: number;
  lowConfidenceFieldCount: number;
  estimatedFieldCount: number;
  noMetadataItemCount: number;
  overallAccuracyPercent: number;
  rescueRate: number;
  needsReviewRate: number;
}

interface ReasonTop { reason: string; count: number }
interface Breakdown { label: string; count: number }

function sourceLabel(src: string): string {
  const map: Record<string, string> = {
    camera_ocr: "カメラ", image_ocr: "画像", pdf_text: "PDF(テキスト)", pdf_ocr: "PDF(スキャン)",
    csv: "CSV", excel: "Excel", paste: "貼り付け", seed: "シード", unknown: "不明",
  };
  return map[src] ?? src;
}

function accuracyColor(pct: number): string {
  if (pct >= 90) return "bg-green-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function AccuracyBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full ${accuracyColor(percent)}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-gray-700">{percent}%</span>
    </div>
  );
}

export function ImportAccuracyClient() {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<AccuracyRow[]>([]);
  const [totals, setTotals] = useState<AccuracyTotals | null>(null);
  const [reasonTop, setReasonTop] = useState<ReasonTop[]>([]);
  const [waveBreakdown, setWaveBreakdown] = useState<Breakdown[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function fetchAccuracy() {
    setLoading(true);
    setError("");
    const qs = date ? `?date=${date}` : "";
    const res = await fetch(`/api/admin/import-accuracy${qs}`);
    setLoading(false);
    setLoaded(true);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "取得に失敗しました");
      return;
    }
    const body = await res.json();
    setRows(body.rows ?? []);
    setTotals(body.totals ?? null);
    setReasonTop(body.reasonTop ?? []);
    setWaveBreakdown((body.waveBreakdown ?? []).map((w: { wave: string; count: number }) => ({ label: w.wave, count: w.count })));
    setSourceBreakdown((body.sourceBreakdown ?? []).map((s: { source: string; count: number }) => ({ label: sourceLabel(s.source), count: s.count })));
  }

  return (
    <div className="space-y-6">
      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">対象日（任意）</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={fetchAccuracy} disabled={loading}>
            {loading ? "集計中..." : "精度を集計"}
          </Button>
          {date && (
            <Button
              onClick={() => setDate("")}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              日付クリア（最新30件）
            </Button>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
        )}
      </div>

      {/* 全体サマリー */}
      {totals && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">全体精度</h2>
            <span className="text-xs text-gray-500">
              画像 {totals.imageCount} 件 / 明細 {totals.totalItemCount} 件 / フィールド {totals.totalFieldCount} 個
            </span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <span className={`text-3xl font-bold tabular-nums ${
              totals.overallAccuracyPercent >= 90 ? "text-green-600"
              : totals.overallAccuracyPercent >= 70 ? "text-amber-600"
              : "text-red-600"
            }`}>
              {totals.overallAccuracyPercent}%
            </span>
            <span className="text-sm text-gray-500">確定済み（確定+手動修正+承認）フィールド割合</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatChip label="確定" value={totals.confirmedFieldCount} className="text-green-700 bg-green-50" />
            <StatChip label="自動救済" value={totals.autoRescuedFieldCount} className="text-blue-700 bg-blue-50" />
            <StatChip label="手動修正" value={totals.manualFixedFieldCount} className="text-indigo-700 bg-indigo-50" />
            <StatChip label="承認済み" value={totals.adminApprovedFieldCount} className="text-emerald-700 bg-emerald-50" />
            <StatChip label="要確認" value={totals.needsReviewFieldCount} className="text-orange-700 bg-orange-50" />
            <StatChip label="推定値" value={totals.estimatedFieldCount} className="text-amber-700 bg-amber-50" />
            <StatChip label="低信頼" value={totals.lowConfidenceFieldCount} className="text-red-700 bg-red-50" />
            <StatChip label="メタなし明細" value={totals.noMetadataItemCount} className="text-gray-600 bg-gray-100" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <StatChip label="自動救済率" value={`${totals.rescueRate}%`} className="text-blue-700 bg-blue-50" />
            <StatChip label="要確認率" value={`${totals.needsReviewRate}%`} className="text-orange-700 bg-orange-50" />
          </div>
        </div>
      )}

      {/* 要確認理由TOP / 取込方式別 / W番号別 */}
      {totals && (reasonTop.length > 0 || sourceBreakdown.length > 0 || waveBreakdown.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">要確認理由 TOP</h3>
            {reasonTop.length === 0 ? <p className="text-xs text-gray-400">なし</p> : (
              <ul className="space-y-1">
                {reasonTop.map((r) => (
                  <li key={r.reason} className="flex justify-between text-xs">
                    <span className="text-gray-700">{REVIEW_REASON_LABELS[r.reason as ReviewReason] ?? r.reason}</span>
                    <span className="font-bold tabular-nums text-gray-900">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">取込方式別（画像数）</h3>
            <ul className="space-y-1">
              {sourceBreakdown.map((s) => (
                <li key={s.label} className="flex justify-between text-xs">
                  <span className="text-gray-700">{s.label}</span>
                  <span className="font-bold tabular-nums text-gray-900">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">W番号別（明細数）</h3>
            <ul className="space-y-1">
              {waveBreakdown.map((w) => (
                <li key={w.label} className="flex justify-between text-xs">
                  <span className="text-gray-700">{w.label}</span>
                  <span className="font-bold tabular-nums text-gray-900">{w.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 画像別テーブル */}
      {rows.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">画像別精度（{rows.length} 件）</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["配送日", "エリア", "W番号", "OCR状態", "明細数", "精度", "自動救済", "要確認", "低信頼"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.dispatchImageId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{r.deliveryDate}</td>
                    <td className="px-4 py-3 text-gray-700">{r.area ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{r.waveNo ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{r.ocrStatus}</td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">{r.totalItemCount}</td>
                    <td className="px-4 py-3"><AccuracyBar percent={r.accuracyPercent} /></td>
                    <td className="px-4 py-3 text-blue-700 tabular-nums">{r.autoRescuedFieldCount}</td>
                    <td className="px-4 py-3 text-orange-700 tabular-nums">{r.needsReviewFieldCount}</td>
                    <td className="px-4 py-3 text-red-700 tabular-nums">{r.lowConfidenceFieldCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            ※ 精度＝(確定+手動修正+承認)フィールド ÷ 全OCRフィールド。メタデータのない旧データは集計対象外。
          </p>
        </div>
      )}

      {loaded && !loading && rows.length === 0 && !error && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">対象の取込画像がありません</p>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, className }: { label: string; value: number | string; className: string }) {
  return (
    <div className={`rounded-md px-3 py-2 ${className}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
