/**
 * 配送ルートの到着時刻を前向き予測し、各配送の遅配リスクを判定する。
 *
 * 「今の残件数 × 1件あたり所要」で各未完了配送への到着見込みを立て、
 * その配送の Wave 時間帯（締切）と突き合わせて「配りきれなさそう＝遅配見込み」を先読みする。
 * 判定の時間帯は waves.ts（単一の真実源）を使用。
 *
 *   late   … すでに Wave 締切を過ぎている（未完了）
 *   atRisk … 締切前だが到着予測が締切を超える＝配りきれない見込み（赤警告）
 *   soon   … 締切30分以内で間に合う見込み
 *   onTime … 余裕
 *   none   … 完了/スキップ/Wave不明（対象外）
 */

import { minutesToDeadline } from "@/lib/waves";

export type EtaStatus = "onTime" | "soon" | "late" | "atRisk" | "none";

export const DEFAULT_PACE_MIN = 7; // 1配達あたりの平均所要（配達＋移動）の既定値
export const PACE_MIN = 3; // ペース下限（クランプ・UIの最小値）
export const PACE_MAX = 20; // ペース上限（クランプ・UIの最大値）
const SOON_THRESHOLD_MIN = 30;

/** UI入力のペース値を安全な範囲に整える（不正/範囲外は既定へ寄せる） */
export function clampPace(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return DEFAULT_PACE_MIN;
  return Math.min(PACE_MAX, Math.max(PACE_MIN, Math.round(v)));
}

export interface RouteEtaInput {
  waveNo: string | null;
  deliveryStatus: string; // COMPLETED / SKIPPED / ASSIGNED / ...
  completedAt?: Date | null; // 完了時刻（あれば当日の実ペース推定に使う）
}

/**
 * route順に並んだ配送配列に対し、各要素の遅配リスク（EtaStatus）を返す。
 * items は route_order 昇順で渡すこと（到着順の前提）。
 */
export function predictRouteEta(
  items: RouteEtaInput[],
  now: Date = new Date(),
  defaultPaceMin: number = DEFAULT_PACE_MIN,
): EtaStatus[] {
  const pace = estimatePaceMin(items, defaultPaceMin);
  let remainingIdx = 0; // 未完了の並び順（1始まり）。到着予測の順番に使う。
  return items.map((it) => {
    if (it.deliveryStatus === "COMPLETED" || it.deliveryStatus === "SKIPPED") return "none";
    // 未完了は Wave 不明でも「前に控える件数」として時間を消費する→先にカウント。
    remainingIdx += 1;
    const rem = minutesToDeadline(it.waveNo, now);
    if (rem === null) return "none"; // Wave 不明は判定対象外（ただし件数には算入済み）
    if (rem < 0) return "late"; // 既に締切超過
    const etaMin = remainingIdx * pace; // この配送に到達するまでの見込み分数
    if (etaMin > rem) return "atRisk"; // 到達時には締切を超える見込み
    if (rem <= SOON_THRESHOLD_MIN) return "soon";
    return "onTime";
  });
}

/**
 * 1件あたり所要(分)を決める。
 * 当日の完了実績が3件以上あれば実測ペースを優先（より正確）。
 * 実績不足のときは UI で調整された既定値 defaultPaceMin を使う。
 */
function estimatePaceMin(items: RouteEtaInput[], defaultPaceMin: number): number {
  const times = items
    .filter((it) => it.deliveryStatus === "COMPLETED" && it.completedAt)
    .map((it) => (it.completedAt as Date).getTime())
    .sort((a, b) => a - b);
  if (times.length >= 3) {
    const spanMin = (times[times.length - 1] - times[0]) / 60000;
    const measured = spanMin / (times.length - 1);
    if (Number.isFinite(measured)) return Math.min(PACE_MAX, Math.max(PACE_MIN, measured));
  }
  return clampPace(defaultPaceMin);
}
