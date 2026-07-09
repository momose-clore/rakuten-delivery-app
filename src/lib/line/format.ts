// 増便報告のLINEメッセージ整形（クライアント/サーバー両用・純粋関数）
//
// 報告フォーマット（運用指定）:
//   7/3
//
//   対象デポ
//   美女木デポ
//
//   該当便
//   6w
//
//   台数
//   1台→石毛
//
//   申請理由
//   〜〜

import type { AdditionalDriver } from "@/types/extra-vehicle-request";

export interface ExtraVehicleReportFields {
  requestDate: string; // YYYY-MM-DD
  depot: string;
  waveNo: string;
  vehicleCount: number;
  assignedDriverName: string | null;
  additionalDrivers?: AdditionalDriver[];
  reason: string;
}

/** 便番号を実グループ表記に正規化: "6w" → "6W" */
export function normalizeWaveNo(waveNo: string): string {
  return waveNo.trim().toUpperCase();
}

/**
 * 専用グループへ実際に投稿する増便通知（実グループのCARIO投稿と同じ短い1行）。
 *   例: "石毛 6W 増便申請が届きました"
 * name は割当先ドライバー名（無ければ申請者名）を渡す。
 */
export function formatExtraVehicleNotification(name: string, waveNo: string): string {
  const who = name.trim() || "（担当未定）";
  return `${who} ${normalizeWaveNo(waveNo)} 増便申請が届きました`;
}

/** "2026-07-03" → "7/3"（ゼロ埋めなし・年なし） */
export function formatReportDate(requestDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(requestDate.trim());
  if (!m) return requestDate;
  return `${Number(m[2])}/${Number(m[3])}`;
}

/** 台数行 "1台→石毛"（割当先が無ければ "1台"） */
export function formatVehicleLine(vehicleCount: number, assignedDriverName: string | null): string {
  const base = `${vehicleCount}台`;
  return assignedDriverName && assignedDriverName.trim()
    ? `${base}→${assignedDriverName.trim()}`
    : base;
}

/** 専用グループへ送る報告本文を生成する */
export function formatExtraVehicleReport(f: ExtraVehicleReportFields): string {
  const lines = [
    formatReportDate(f.requestDate),
    "",
    "対象デポ",
    f.depot,
    "",
    "該当便",
    f.waveNo,
    "",
    "台数",
    formatVehicleLine(f.vehicleCount, f.assignedDriverName),
    "",
    "申請理由",
    f.reason.trim(),
  ];
  // 追加ドライバー（例: 深井奨之　6w(12号車)）
  const extras = (f.additionalDrivers ?? []).filter((d) => d.name.trim());
  if (extras.length > 0) {
    lines.push("", "・追加ドライバー");
    for (const d of extras) {
      lines.push(d.assign.trim() ? `${d.name.trim()}　${d.assign.trim()}` : d.name.trim());
    }
  }
  return lines.join("\n");
}
