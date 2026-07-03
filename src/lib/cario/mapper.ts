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

/** ネストされたオブジェクト（driver / site / course）を安全に取り出す */
function asObject(value: unknown): ApiRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApiRecord)
    : null;
}

function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

/**
 * CARIO assignments API のレコードを CarioAssignment に変換する（実レスポンス準拠）。
 *
 * 実レスポンス構造:
 *   { id, work_date, driver:{id,name,phone,line_user_id}, external_driver_name,
 *     site:{id,name,flow_type,wave_count}, course:{id,name,terminal_no}, note }
 *
 * フラット形式（driver_id 直下など）にも後方互換で対応する。
 */
export function mapApiAssignment(record: ApiRecord): CarioAssignment {
  const driver = asObject(record.driver);
  const site = asObject(record.site);
  const course = asObject(record.course);

  // driver.id を優先。フラット形式（driver_id）にもフォールバック
  const carioDriverId = String(
    driver?.id ?? record.driver_id ?? record.driverId ?? ""
  );
  const driverName =
    strOrNull(driver?.name) ??
    strOrNull(record.external_driver_name) ??
    strOrNull(record.driver_name ?? record.driverName);

  // course.name（例: "12号車"）を号車/ルート番号として扱う
  const courseName = strOrNull(course?.name ?? record.vehicle_no ?? record.route_no);

  // 割当は常に確定割当扱い（実APIに status フィールドは無い）
  const statusRaw = String(
    record.status ?? record.assignment_status ?? record.assignmentStatus ?? "ASSIGNED"
  ).toUpperCase();
  const assignmentStatus: CarioAssignment["assignmentStatus"] =
    statusRaw === "COMPLETED" ? "COMPLETED"
    : statusRaw === "UNKNOWN" ? "UNKNOWN"
    : "ASSIGNED";

  return {
    assignmentId: String(record.id ?? ""),
    carioDriverId,
    driverName,
    deliveryDate: String(
      record.work_date ?? record.delivery_date ?? record.deliveryDate ?? record.date ?? ""
    ),
    waveNo: strOrNull(record.wave_no ?? record.waveNo),
    vehicleNo: courseName,
    routeNo: courseName,
    siteId: strOrNull(site?.id ?? record.site_id),
    siteName: strOrNull(site?.name),
    courseId: strOrNull(course?.id),
    note: strOrNull(record.note),
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

/** API レスポンス配列を CarioAssignment[] に変換（外部ドライバー割当も保持） */
export function mapApiAssignments(records: ApiRecord[]): CarioAssignment[] {
  return records.map(mapApiAssignment).filter((a) => a.assignmentId !== "");
}

/**
 * assignments から drivers を導出する（driver.id で重複排除）。
 * 実APIの assignment には driver 情報が埋め込まれているため、
 * 別途 /drivers を叩かずドライバー upsert 対象を得られる。
 * area には現場名（siteName）、vehicleId には号車（vehicleNo）を格納する。
 */
export function deriveDriversFromAssignments(assignments: CarioAssignment[]): CarioDriver[] {
  const byId = new Map<string, CarioDriver>();
  for (const a of assignments) {
    if (!a.carioDriverId) continue; // 外部ドライバー（自社DAでない）は skip
    if (!byId.has(a.carioDriverId)) {
      byId.set(a.carioDriverId, {
        carioDriverId: a.carioDriverId,
        name: a.driverName ?? "",
        phone: null,
        companyName: null,
        area: a.siteName,
        vehicleId: a.vehicleNo,
      });
    }
  }
  return [...byId.values()];
}

/**
 * assignments から shifts を導出する（driverId × work_date で重複排除）。
 * 割当がある = その日の出勤確定とみなし CONFIRMED を立てる。
 * 実APIに勤務時間は無いため startTime/endTime は null。
 */
export function deriveShiftsFromAssignments(assignments: CarioAssignment[]): CarioShift[] {
  const seen = new Set<string>();
  const shifts: CarioShift[] = [];
  for (const a of assignments) {
    if (!a.carioDriverId || !a.deliveryDate) continue;
    const key = `${a.carioDriverId}__${a.deliveryDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    shifts.push({
      carioDriverId: a.carioDriverId,
      workDate: a.deliveryDate,
      startTime: null,
      endTime: null,
      status: "CONFIRMED",
    });
  }
  return shifts;
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

  // パターン3: { from, to, assignments: [...] }（楽天CARIO実API v1.0の主形式）
  if (Array.isArray(res.assignments)) {
    const assignments = mapApiAssignments(res.assignments as ApiRecord[]);
    // drivers が明示されていれば優先、無ければ assignments から導出
    const drivers = Array.isArray(res.drivers)
      ? mapApiDrivers(res.drivers as ApiRecord[])
      : deriveDriversFromAssignments(assignments);
    const shifts = Array.isArray(res.shifts)
      ? mapApiShifts(res.shifts as ApiRecord[])
      : deriveShiftsFromAssignments(assignments);

    const externalCount = assignments.filter((a) => !a.carioDriverId).length;
    if (externalCount > 0) {
      warnings.push(`外部ドライバー割当 ${externalCount} 件（自社DA未登録のため取込対象外）`);
    }
    return {
      drivers,
      shifts,
      assignments,
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
