export type ShiftStatus = "CONFIRMED" | "TENTATIVE" | "ABSENT";

export interface DriverWithShift {
  driverId: string;
  carioDriverId: string | null;
  name: string;
  companyName: string | null;
  area: string | null;
  vehicleId: string | null;
  shiftId: string;
  workDate: string;
  startTime: string | null;
  endTime: string | null;
  status: ShiftStatus;
}

export interface ShiftImportResult {
  date: string;
  driverUpserted: number;
  shiftUpserted: number;
  confirmedCount: number;
  tentativeCount: number;
  absentCount: number;
  companyBreakdown: Record<string, number>;
  areaBreakdown: Record<string, number>;
  drivers: DriverWithShift[];
}

/** CARIO 接続モード（UI 表示用） */
export type CarioConnectionMode = "MOCK" | "REAL_API" | "LAST_IMPORTED";

/**
 * /admin/shifts の接続状態表示情報。
 * ⚠️ APIキー・Authorization・env 実値は一切含めない（安全な表示のみ）。
 */
export interface CarioConnectionDisplay {
  /** 表示モード */
  mode: CarioConnectionMode;
  /** API キー + BaseURL が設定済みか（真偽のみ・値は含めない） */
  apiConfigured: boolean;
  /** 本番環境で MOCK を使用しているか（赤警告） */
  isProductionMock: boolean;
  /** 対象日（YYYY-MM-DD） */
  targetDate: string;
  /** 最終取込日時（ISO 文字列 / データなしは null） */
  lastImportedAt: string | null;
  /** 古いデータを表示中か */
  isStale: boolean;
  /** シフトの取得状態（OK | API_FAILURE | USER_APPROVED | MOCK） */
  sourceStatus: string | null;
  /** stale の理由（表示用の安全な文言 / null は理由なし） */
  staleReason: string | null;
}
