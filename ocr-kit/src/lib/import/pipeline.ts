/**
 * 取込パイプラインのうち、DB非依存の純粋ユーティリティのみを切り出したもの。
 * （元アプリの saveImportBatch / saveDriverScan は DB 保存のため本モジュールには含めない）
 */
import type { NormalizedDispatchRow } from "../../types/import";

/** 正規化済み行から信頼度別の集計を計算する */
export function calcBatchStats(rows: NormalizedDispatchRow[]) {
  return {
    totalRows: rows.length,
    highCount: rows.filter((r) => r.confidence === "high").length,
    mediumCount: rows.filter((r) => r.confidence === "medium").length,
    lowCount: rows.filter((r) => r.confidence === "low").length,
    autoRescuedCount: rows.filter((r) => r.autoRescued).length,
    needsReviewCount: rows.filter((r) => r.notes.includes("NEEDS_REVIEW")).length,
  };
}
