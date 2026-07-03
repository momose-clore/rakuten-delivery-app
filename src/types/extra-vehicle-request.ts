// 増便申請の型定義（管理者・ドライバー双方が申請 / 後でCARIO連携）

export type ExtraVehicleRequestStatus = "pending" | "approved" | "rejected";
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

export const CARIO_SYNC_LABEL: Record<CarioSyncStatus, string> = {
  not_sent: "未送信",
  pending: "送信待ち",
  sent: "CARIO送信済み",
  failed: "送信失敗",
};
