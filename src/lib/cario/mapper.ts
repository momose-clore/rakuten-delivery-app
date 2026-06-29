/**
 * CARIO API レスポンス → 内部型 への変換
 *
 * CARIO 実API仕様が確定したら、このファイルの型定義とマッピングを調整する。
 * 他のファイルはこのファイルだけを修正すれば対応できる構成にしている。
 *
 * TODO: CARIO実API仕様確定後にマッピング調整
 */
import type { CarioDriver, CarioShift } from "./types";

// ── CARIO API レスポンスの型（仕様確定後に実際の型に変更）────────────────
// 現在は汎用 Record 型。実API のレスポンス構造に合わせて具体的な型に変更する。
type ApiDriverRecord = Record<string, unknown>;
type ApiShiftRecord = Record<string, unknown>;

/**
 * CARIO API のドライバーレコードを CarioDriver に変換する。
 * TODO: CARIO実API仕様確定後にフィールドマッピングを調整
 */
export function mapApiDriver(record: ApiDriverRecord): CarioDriver {
  return {
    // TODO: 実際のフィールド名に変更（例: record.driver_id → record.driverId 等）
    carioDriverId: String(record.id ?? record.driver_id ?? record.driverId ?? ""),
    name: String(record.name ?? record.driver_name ?? record.driverName ?? ""),
    phone: record.phone ? String(record.phone) : null,
    companyName: record.company_name
      ? String(record.company_name)
      : record.companyName
        ? String(record.companyName)
        : null,
    area: record.area ? String(record.area) : null,
    vehicleId: record.vehicle_id
      ? String(record.vehicle_id)
      : record.vehicleId
        ? String(record.vehicleId)
        : null,
  };
}

/**
 * CARIO API のシフトレコードを CarioShift に変換する。
 * TODO: CARIO実API仕様確定後にフィールドマッピングを調整
 */
export function mapApiShift(record: ApiShiftRecord): CarioShift {
  const statusRaw = String(record.status ?? record.shift_status ?? "CONFIRMED").toUpperCase();
  const status: CarioShift["status"] =
    statusRaw === "TENTATIVE" ? "TENTATIVE"
    : statusRaw === "ABSENT" ? "ABSENT"
    : "CONFIRMED";

  return {
    // TODO: 実際のフィールド名に変更
    carioDriverId: String(record.driver_id ?? record.driverId ?? record.id ?? ""),
    workDate: String(record.work_date ?? record.workDate ?? record.date ?? ""),
    startTime: record.start_time ? String(record.start_time) : null,
    endTime: record.end_time ? String(record.end_time) : null,
    status,
  };
}

/** API レスポンス配列を CarioDriver[] に変換 */
export function mapApiDrivers(records: ApiDriverRecord[]): CarioDriver[] {
  return records.map(mapApiDriver).filter((d) => d.carioDriverId !== "");
}

/** API レスポンス配列を CarioShift[] に変換 */
export function mapApiShifts(records: ApiShiftRecord[]): CarioShift[] {
  return records.map(mapApiShift).filter((s) => s.carioDriverId !== "");
}
