// CARIO 連携モジュールの公開エントリ
// 取込の主力は assignments 経路（getAssignments → sync）。
export { fetchAssignmentsForRange, fetchAssignmentsForDate } from "./getAssignments";
export { fetchCarioSites, fetchCarioShiftRequests } from "./getSites";
export { syncCarioAssignments, approveStaleShifts, markRangeStale, jstDateStr } from "./sync";
export type {
  CarioDriver,
  CarioShift,
  CarioAssignment,
  CarioSite,
  CarioShiftRequest,
  ImportSummary,
} from "./types";
