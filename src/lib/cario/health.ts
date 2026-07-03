/**
 * CARIO 連携ヘルスチェック＆データ整合（ドリフト）検出。
 * 監視・障害切り分け用。書き込みは行わない（read-only）。
 */
import { prisma } from "@/lib/prisma";
import { isCarioApiConfigured, CarioApiError } from "./client";
import { fetchCarioSites } from "./getSites";
import { fetchAssignmentsForRange } from "./getAssignments";
import { jstDateStr } from "./sync";

export interface CarioHealth {
  apiConfigured: boolean;
  connectivity: "OK" | "FAILED" | "SKIPPED";
  connectivityError: string | null;
  siteCount: number | null;
  /** JST本日〜+2日で最後に取り込んだ時刻 */
  lastImportedAt: string | null;
  minutesSinceLastImport: number | null;
  /** 同範囲の stale シフト件数 */
  staleShiftCount: number;
  checkedAt: string;
  drift?: CarioDrift;
}

export interface CarioDrift {
  date: string;
  /** CARIOにあるがDBに無い（driver×date） */
  missingInDb: string[];
  /** DB（CARIO由来）にあるがCARIOに無い */
  extraInDb: string[];
  inSync: boolean;
}

export async function carioHealthCheck(opts?: { driftDate?: string }): Promise<CarioHealth> {
  const apiConfigured = isCarioApiConfigured();

  // 疎通確認（軽い GET /sites）
  let connectivity: CarioHealth["connectivity"] = "SKIPPED";
  let connectivityError: string | null = null;
  let siteCount: number | null = null;
  if (apiConfigured) {
    try {
      const sites = await fetchCarioSites();
      siteCount = sites.length;
      connectivity = "OK";
    } catch (err) {
      connectivity = "FAILED";
      connectivityError = err instanceof CarioApiError ? err.message : "疎通に失敗しました";
    }
  }

  // 同期の鮮度・stale（JST本日〜+2日）
  const from = new Date(jstDateStr(0));
  const to = new Date(jstDateStr(2));
  const [latest, staleShiftCount] = await Promise.all([
    prisma.shift.findFirst({
      where: { workDate: { gte: from, lte: to }, importedAt: { not: null } },
      orderBy: { importedAt: "desc" },
      select: { importedAt: true },
    }),
    prisma.shift.count({ where: { workDate: { gte: from, lte: to }, isStale: true } }),
  ]);

  const lastImportedAt = latest?.importedAt?.toISOString() ?? null;
  const minutesSinceLastImport = latest?.importedAt
    ? Math.round((Date.now() - latest.importedAt.getTime()) / 60000)
    : null;

  const health: CarioHealth = {
    apiConfigured,
    connectivity,
    connectivityError,
    siteCount,
    lastImportedAt,
    minutesSinceLastImport,
    staleShiftCount,
    checkedAt: new Date().toISOString(),
  };

  if (opts?.driftDate) {
    health.drift = await detectDrift(opts.driftDate);
  }
  return health;
}

/** 指定日の CARIO assignments と DB shifts のドリフトを検出する（read-only） */
export async function detectDrift(date: string): Promise<CarioDrift> {
  const { shifts: carioShifts } = await fetchAssignmentsForRange(date);
  const carioKeys = new Set(carioShifts.map((s) => `${s.carioDriverId}__${s.workDate}`));

  const dbShifts = await prisma.shift.findMany({
    where: { workDate: new Date(date), source: { in: ["CARIO_API", "CARIO_MOCK"] } },
    select: { workDate: true, driver: { select: { carioDriverId: true } } },
  });
  const dbKeys = new Set(
    dbShifts
      .filter((s) => s.driver.carioDriverId)
      .map((s) => `${s.driver.carioDriverId}__${s.workDate.toISOString().split("T")[0]}`)
  );

  const missingInDb = [...carioKeys].filter((k) => !dbKeys.has(k));
  const extraInDb = [...dbKeys].filter((k) => !carioKeys.has(k));
  return {
    date,
    missingInDb,
    extraInDb,
    inSync: missingInDb.length === 0 && extraInDb.length === 0,
  };
}
