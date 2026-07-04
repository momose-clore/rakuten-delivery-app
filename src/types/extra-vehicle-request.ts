// 増便申請の型定義（管理者・ドライバー双方が申請 / 後でCARIO連携）

export type ExtraVehicleRequestStatus = "pending" | "approved" | "rejected";
// 報告ステータス（DBの cario_* カラムを流用。CARIO公式LINEでの専用グループ報告状態）
export type CarioSyncStatus = "not_sent" | "pending" | "sent" | "failed";
export type RequesterRole = "ADMIN" | "DRIVER";

// API レスポンス用 DTO（個人情報を含む申請理由は本人/管理者のみが閲覧）
export interface ExtraVehicleRequestDTO {
  id: string;
  requestDate: string;        // YYYY-MM-DD
  depot: string;
  waveNo: string;
  vehicleCount: number;
  assignedDriverName: string | null;
  reason: string;
  status: ExtraVehicleRequestStatus;
  createdByRole: RequesterRole;
  createdByName: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  carioSyncStatus: CarioSyncStatus;
  carioSentAt: string | null;
  createdAt: string;
}

// フォーム入力
export interface ExtraVehicleRequestInput {
  requestDate: string;        // YYYY-MM-DD
  depot: string;
  waveNo: string;
  vehicleCount: number;
  assignedDriverName?: string | null;
  reason: string;
}

export const STATUS_LABEL: Record<ExtraVehicleRequestStatus, string> = {
  pending: "申請中",
  approved: "承認済み",
  rejected: "却下",
};

// 報告ステータス表示（CARIOがpull→公式LINEで専用グループへ報告した状態）
export const REPORT_STATUS_LABEL: Record<CarioSyncStatus, string> = {
  not_sent: "未報告",
  pending: "取得待ち",
  sent: "報告済み",
  failed: "報告失敗",
};
