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
  workDate: string;       // "YYYY-MM-DD"
  startTime: string | null; // "HH:MM"
  endTime: string | null;   // "HH:MM"
  status: "CONFIRMED" | "TENTATIVE" | "ABSENT";
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
}
