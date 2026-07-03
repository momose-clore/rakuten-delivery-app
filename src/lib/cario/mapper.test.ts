/**
 * CARIO mapper ユニットテスト
 * 実行: npx tsx --test src/lib/cario/mapper.test.ts
 *
 * prisma を import しない純粋関数のみ対象（DB不要）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapApiAssignment,
  deriveDriversFromAssignments,
  deriveShiftsFromAssignments,
  mapRakutenAssignmentsResponse,
} from "./mapper";

// 実レスポンス準拠のネストした assignment
const nested = {
  id: "a1",
  work_date: "2026-07-03",
  driver: { id: "d1", name: "西龍輝", phone: "09011112222", line_user_id: "U..." },
  external_driver_name: null,
  site: { id: "s1", name: "楽天ネットスーパー（美女木）", flow_type: "wave_count", wave_count: 6 },
  course: { id: "c1", name: "14号車", terminal_no: null },
  note: null,
};

test("mapApiAssignment: ネスト構造を正しく展開する", () => {
  const a = mapApiAssignment(nested);
  assert.equal(a.assignmentId, "a1");
  assert.equal(a.carioDriverId, "d1");
  assert.equal(a.driverName, "西龍輝");
  assert.equal(a.driverPhone, "09011112222");
  assert.equal(a.deliveryDate, "2026-07-03");
  assert.equal(a.vehicleNo, "14号車");
  assert.equal(a.routeNo, "14号車");
  assert.equal(a.siteId, "s1");
  assert.equal(a.siteName, "楽天ネットスーパー（美女木）");
  assert.equal(a.courseId, "c1");
  assert.equal(a.assignmentStatus, "ASSIGNED");
});

test("mapApiAssignment: 旧フラット形式にも後方互換で対応", () => {
  const a = mapApiAssignment({
    id: "a2",
    driver_id: "d2",
    driver_name: "旧太郎",
    work_date: "2026-07-04",
    vehicle_no: "12号車",
  });
  assert.equal(a.carioDriverId, "d2");
  assert.equal(a.driverName, "旧太郎");
  assert.equal(a.vehicleNo, "12号車");
});

test("mapApiAssignment: 外部ドライバー（driver null）は名前のみ・IDは空", () => {
  const a = mapApiAssignment({
    id: "a3",
    work_date: "2026-07-03",
    driver: null,
    external_driver_name: "外部 花子",
    site: { id: "s1", name: "美女木" },
    course: { id: "c9", name: "9号車" },
  });
  assert.equal(a.carioDriverId, "");
  assert.equal(a.driverName, "外部 花子");
});

test("deriveDriversFromAssignments: driver.id で重複排除・現場をarea・号車をvehicleId・phone保持", () => {
  const assignments = [
    mapApiAssignment(nested),
    mapApiAssignment({ ...nested, id: "a1b", work_date: "2026-07-04", course: { id: "c2", name: "15号車" } }),
  ];
  const drivers = deriveDriversFromAssignments(assignments);
  assert.equal(drivers.length, 1); // 同一driverは1件に集約
  assert.equal(drivers[0]!.carioDriverId, "d1");
  assert.equal(drivers[0]!.phone, "09011112222");
  assert.equal(drivers[0]!.area, "楽天ネットスーパー（美女木）");
  assert.equal(drivers[0]!.vehicleId, "14号車"); // 最初に見た号車
});

test("deriveDriversFromAssignments: 外部ドライバーは除外", () => {
  const ext = mapApiAssignment({ id: "x", work_date: "2026-07-03", driver: null, external_driver_name: "外部" });
  assert.equal(deriveDriversFromAssignments([ext]).length, 0);
});

test("deriveShiftsFromAssignments: driver×日で重複排除・CONFIRMED・時刻null", () => {
  const assignments = [
    mapApiAssignment(nested),
    mapApiAssignment({ ...nested, id: "dup" }), // 同一driver×同一日 → 1件に
    mapApiAssignment({ ...nested, id: "a1b", work_date: "2026-07-04" }),
  ];
  const shifts = deriveShiftsFromAssignments(assignments);
  assert.equal(shifts.length, 2);
  assert.equal(shifts[0]!.status, "CONFIRMED");
  assert.equal(shifts[0]!.startTime, null);
  assert.equal(shifts[0]!.endTime, null);
});

test("mapRakutenAssignmentsResponse: {from,to,assignments} から drivers/shifts を導出", () => {
  const res = {
    from: "2026-07-03",
    to: "2026-07-03",
    assignments: [nested, { ...nested, id: "a4", driver: { id: "d5", name: "菅原", phone: null } }],
  };
  const out = mapRakutenAssignmentsResponse(res);
  assert.equal(out.responseShape, "object.assignments");
  assert.equal(out.assignments.length, 2);
  assert.equal(out.drivers.length, 2);
  assert.equal(out.shifts.length, 2);
});

test("mapRakutenAssignmentsResponse: 外部ドライバー件数を warning に記録", () => {
  const res = {
    assignments: [{ id: "x", work_date: "2026-07-03", driver: null, external_driver_name: "外部" }],
  };
  const out = mapRakutenAssignmentsResponse(res);
  assert.ok(out.warnings.some((w) => w.includes("外部ドライバー")));
});

test("mapRakutenAssignmentsResponse: 空/非オブジェクトは空結果", () => {
  const out = mapRakutenAssignmentsResponse(null);
  assert.equal(out.assignments.length, 0);
  assert.equal(out.responseShape, "empty");
});
