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
