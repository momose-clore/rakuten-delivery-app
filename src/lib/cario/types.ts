// CARIO から取得するドライバー情報
export interface CarioDriver {
  carioDriverId: string;
  name: string;
  phone: string | null;
  companyName: string | null;
  area: string | null;
  vehicleId: string | null;
}

// CARIO から取得するシフト情報
export interface CarioShift {
  carioDriverId: string;
  workDate: string;         // "YYYY-MM-DD"
  startTime: string | null; // "HH:MM"
  endTime: string | null;   // "HH:MM"
  status: "CONFIRMED" | "TENTATIVE" | "ABSENT";
}

// CARIO assignments API から取得する割当情報（v1.0追加）
export interface CarioAssignment {
  carioDriverId: string;
  driverName: string | null;
  deliveryDate: string;    // "YYYY-MM-DD"
  waveNo: string | null;
  vehicleNo: string | null;
  routeNo: string | null;
  assignmentStatus: "ASSIGNED" | "COMPLETED" | "UNKNOWN";
}

// 取込結果サマリー
export interface ImportSummary {
  date: string;
  driverUpserted: number;
  shiftUpserted: number;
  confirmedCount: number;
  tentativeCount: number;
  absentCount: number;
  companyBreakdown: Record<string, number>;
  areaBreakdown: Record<string, number>;
  // v1.0追加
  connectionMode: "MOCK" | "REAL_API" | "LAST_IMPORTED";
  isStale: boolean;
  mapperWarnings?: string[];
}

// 接続状態情報（/admin/shifts 表示用）
export interface CarioConnectionInfo {
  /** 接続モード */
  mode: "MOCK" | "REAL_API" | "LAST_IMPORTED";
  /** API種別ラベル */
  apiLabel: string;
  /** 本番でMOCKを使用している場合 true（赤警告表示） */
  isProductionMock: boolean;
  /** 最終取込日時 */
  lastImportedAt: Date | null;
  /** 旧データを使用中か（CARIO API 失敗時） */
  isStale: boolean;
  /** stale の理由 */
  staleReason: string | null;
}
