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

// CARIO assignments API から取得する割当情報（v1.0確定・実レスポンス準拠）
// 実レスポンス: { id, work_date, driver:{id,name,phone,line_user_id},
//   external_driver_name, site:{id,name,flow_type,wave_count},
//   course:{id,name,terminal_no}, note, created_at }
export interface CarioAssignment {
  assignmentId: string;      // 割当ID（assignment.id）
  carioDriverId: string;     // driver.id（外部ドライバー時は空文字）
  driverName: string | null; // driver.name ?? external_driver_name
  driverPhone: string | null; // driver.phone
  deliveryDate: string;      // work_date "YYYY-MM-DD"
  waveNo: string | null;     // 現状APIに無し（将来用）
  vehicleNo: string | null;  // course.name（例: "12号車"）
  routeNo: string | null;    // course.name（vehicleNo と同値・別名参照用）
  siteId: string | null;     // site.id
  siteName: string | null;   // site.name
  courseId: string | null;   // course.id
  note: string | null;       // 備考
  assignmentStatus: "ASSIGNED" | "COMPLETED" | "UNKNOWN";
}

// CARIO 現場（/sites）
export interface CarioSite {
  id: string;
  name: string;
  flowType: string | null;   // 例: "wave_count"
  waveCount: number | null;  // Wave 数
  client: string | null;     // 元請
}

// CARIO シフト希望（/shift-requests）※現状レスポンスは空。将来対応の先回り型
export interface CarioShiftRequest {
  driverId: string;
  driverName: string | null;
  workDate: string;          // "YYYY-MM-DD"
  raw: Record<string, unknown>; // 実フィールド確定まで生データを保持
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
