/**
 * CARIO API レスポンス → 内部型 への変換
 *
 * CARIO 実API仕様が確定したら、このファイルのフィールドマッピングを調整する。
 * 他のファイルはこのファイルだけを修正すれば対応できる構成にしている。
 */
import type { CarioDriver, CarioShift, CarioAssignment } from "./types";

// ── API レスポンスの型（仕様確定後に実際の型に変更）────────────────
type ApiRecord = Record<string, unknown>;

/**
 * CARIO API のドライバーレコードを CarioDriver に変換する。
 * TODO: CARIO実API仕様確定後にフィールドマッピングを調整
 */
export function mapApiDriver(record: ApiRecord): CarioDriver {
  return {
    carioDriverId: String(record.id ?? record.driver_id ?? record.driverId ?? ""),
    name: String(record.name ?? record.driver_name ?? record.driverName ?? ""),
    phone: record.phone ? String(record.phone) : null,
    companyName: record.company_name
      ? String(record.company_name)
      : record.companyName ? String(record.companyName) : null,
    area: record.area ? String(record.area) : null,
    vehicleId: record.vehicle_id
      ? String(record.vehicle_id)
      : record.vehicleId ? String(record.vehicleId) : null,
  };
}

/**
 * CARIO API のシフトレコードを CarioShift に変換する。
 * TODO: CARIO実API仕様確定後にフィールドマッピングを調整
 */
export function mapApiShift(record: ApiRecord): CarioShift {
  const statusRaw = String(record.status ?? record.shift_status ?? "CONFIRMED").toUpperCase();
  const status: CarioShift["status"] =
    statusRaw === "TENTATIVE" ? "TENTATIVE"
    : statusRaw === "ABSENT"   ? "ABSENT"
    : "CONFIRMED";

  return {
    carioDriverId: String(record.driver_id ?? record.driverId ?? record.id ?? ""),
    workDate: String(record.work_date ?? record.workDate ?? record.date ?? ""),
    startTime: record.start_time ? String(record.start_time)
      : record.startTime ? String(record.startTime) : null,
    endTime: record.end_time ? String(record.end_time)
      : record.endTime ? String(record.endTime) : null,
    status,
  };
}

/**
 * CARIO assignments API のレコードを CarioAssignment に変換する。
 * TODO: 実レスポンス確認後にフィールドマッピングを調整
 */
export function mapApiAssignment(record: ApiRecord): CarioAssignment {
  const statusRaw = String(
    record.status ?? record.assignment_status ?? record.assignmentStatus ?? "UNKNOWN"
  ).toUpperCase();
  const assignmentStatus: CarioAssignment["assignmentStatus"] =
    statusRaw === "ASSIGNED"  ? "ASSIGNED"
    : statusRaw === "COMPLETED" ? "COMPLETED"
    : "UNKNOWN";

  return {
    carioDriverId: String(record.driver_id ?? record.driverId ?? record.id ?? ""),
    driverName: record.driver_name
      ? String(record.driver_name)
      : record.driverName ? String(record.driverName) : null,
    deliveryDate: String(
      record.delivery_date ?? record.deliveryDate ?? record.work_date ?? record.date ?? ""
    ),
    waveNo: record.wave_no
      ? String(record.wave_no)
      : record.waveNo ? String(record.waveNo) : null,
    vehicleNo: record.vehicle_no
      ? String(record.vehicle_no)
      : record.vehicleNo ? String(record.vehicleNo) : null,
    routeNo: record.route_no
      ? String(record.route_no)
      : record.routeNo ? String(record.routeNo) : null,
    assignmentStatus,
  };
}

/** API レスポンス配列を CarioDriver[] に変換 */
export function mapApiDrivers(records: ApiRecord[]): CarioDriver[] {
  return records.map(mapApiDriver).filter((d) => d.carioDriverId !== "");
}

/** API レスポンス配列を CarioShift[] に変換 */
export function mapApiShifts(records: ApiRecord[]): CarioShift[] {
  return records.map(mapApiShift).filter((s) => s.carioDriverId !== "");
}

/** API レスポンス配列を CarioAssignment[] に変換 */
export function mapApiAssignments(records: ApiRecord[]): CarioAssignment[] {
  return records.map(mapApiAssignment).filter((a) => a.carioDriverId !== "");
}

/**
 * Rakuten assignments API のレスポンス全体をパースする。
 * 複数のレスポンス形式を自動検出して対応する。
 *
 * 個人情報をログに出さない:
 *   - キー名のみをログ出力（値は出さない）
 *   - 生レスポンスをそのまま返さない
 */
export function mapRakutenAssignmentsResponse(response: unknown): {
  drivers: CarioDriver[];
  shifts: CarioShift[];
  assignments: CarioAssignment[];
  warnings: string[];
  responseShape: string;
} {
  const warnings: string[] = [];

  if (!response || typeof response !== "object") {
    warnings.push("レスポンスが空または非オブジェクト");
    return { drivers: [], shifts: [], assignments: [], warnings, responseShape: "empty" };
  }

  const res = response as Record<string, unknown>;

  // レスポンス構造のキーのみログ（値は出さない）
  const topLevelKeys = Object.keys(res);
  const isArray = Array.isArray(response);

  // 構造検出ロジック
  // パターン1: 配列そのまま
  if (isArray) {
    const arr = response as ApiRecord[];
    const firstKeys = arr.length > 0 ? Object.keys(arr[0] ?? {}) : [];

    // シフト中心か割当中心かをキーで判定
    const hasDeliveryDate = firstKeys.some((k) =>
      k.toLowerCase().includes("delivery") || k.toLowerCase().includes("date")
    );
    const hasWaveNo = firstKeys.some((k) =>
      k.toLowerCase().includes("wave") || k.toLowerCase().includes("route")
    );

    if (hasDeliveryDate || hasWaveNo) {
      return {
        drivers:      [],
        shifts:       [],
        assignments:  mapApiAssignments(arr),
        warnings,
        responseShape: "array:assignments",
      };
    }
    // デフォルトはシフト配列
    return {
      drivers:     [],
      shifts:      mapApiShifts(arr),
      assignments: [],
      warnings,
      responseShape: "array:shifts",
    };
  }

  // パターン2: { data: [...] }
  if (Array.isArray(res.data)) {
    return {
      drivers:     [],
      shifts:      mapApiShifts(res.data as ApiRecord[]),
      assignments: [],
      warnings,
      responseShape: "object.data",
    };
  }

  // パターン3: { assignments: [...], drivers?: [...] }
  if (Array.isArray(res.assignments)) {
    const drivers = Array.isArray(res.drivers) ? mapApiDrivers(res.drivers as ApiRecord[]) : [];
    return {
      drivers,
      shifts:      [],
      assignments: mapApiAssignments(res.assignments as ApiRecord[]),
      warnings,
      responseShape: "object.assignments",
    };
  }

  // パターン4: { shifts: [...], drivers?: [...] }
  if (Array.isArray(res.shifts)) {
    const drivers = Array.isArray(res.drivers) ? mapApiDrivers(res.drivers as ApiRecord[]) : [];
    return {
      drivers,
      shifts:      mapApiShifts(res.shifts as ApiRecord[]),
      assignments: [],
      warnings,
      responseShape: "object.shifts",
    };
  }

  // パターン5: { drivers: [...] } のみ
  if (Array.isArray(res.drivers)) {
    warnings.push(`レスポンスにシフト/割当情報がありません（topLevelKeys: ${topLevelKeys.join(",")}）`);
    return {
      drivers:     mapApiDrivers(res.drivers as ApiRecord[]),
      shifts:      [],
      assignments: [],
      warnings,
      responseShape: "object.drivers_only",
    };
  }

  // 未対応構造
  warnings.push(
    `未対応のレスポンス構造（topLevelKeys: ${topLevelKeys.join(",")} / isArray: ${String(isArray)}）`
  );
  return {
    drivers: [], shifts: [], assignments: [], warnings,
    responseShape: `unknown:${topLevelKeys.join(",")}`,
  };
}
