"use client";

import { parseFieldStatusJson, parsePredictionWarnings } from "@/lib/prediction/metadata";
import type { ValueStatus } from "@/types/prediction";

/**
 * 明細行の予測値メタデータを要約したバッジ。
 * フィールド単位のステータス（手動修正 / 承認済み / 自動救済 / 推定 / 要確認）と
 * 低信頼警告を集約して表示する。値そのものは表示しない。
 */
export function PredictionBadge({
  fieldStatusJson,
  predictionWarningsJson,
}: {
  fieldStatusJson?: string | null;
  predictionWarningsJson?: string | null;
}) {
  const statusMap = parseFieldStatusJson(fieldStatusJson ?? null);
  const warnings = parsePredictionWarnings(predictionWarningsJson ?? null);

  const statuses = Object.values(statusMap).filter(Boolean) as ValueStatus[];
  const has = (s: ValueStatus) => statuses.includes(s);

  const badges: { label: string; className: string }[] = [];

  if (has("MANUAL_FIXED"))   badges.push({ label: "手動修正済み", className: "bg-indigo-100 text-indigo-700" });
  if (has("ADMIN_APPROVED")) badges.push({ label: "承認済み",     className: "bg-emerald-100 text-emerald-700" });
  if (has("AUTO_RESCUED"))   badges.push({ label: "自動救済",     className: "bg-blue-100 text-blue-700" });
  if (has("ESTIMATED"))      badges.push({ label: "推定値",       className: "bg-amber-100 text-amber-700" });
  if (has("NEEDS_REVIEW"))   badges.push({ label: "要確認",       className: "bg-orange-100 text-orange-700" });
  if (warnings.includes("OCR_LOW_CONFIDENCE")) {
    badges.push({ label: "⚠ 低信頼", className: "bg-red-100 text-red-700" });
  }

  // メタデータなし（旧データ）
  if (badges.length === 0 && statuses.length === 0 && warnings.length === 0) {
    return <span className="text-[10px] text-gray-300">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b.label}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${b.className}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
