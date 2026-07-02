/**
 * CARIO シフト取込 + stale 状態管理
 *
 * 状態遷移:
 * MOCK_DATA → [API設定後] OK
 * OK → [API失敗] API_FAILURE (isStale=true)
 * API_FAILURE → [管理者承認] USER_APPROVED (isStale=true)
 * API_FAILURE / USER_APPROVED → [次回API成功] OK (isStale=false)
 */
import { prisma } from "@/lib/prisma";
import { fetchCarioShifts } from "./getShifts";
import { fetchCarioDrivers } from "./getDrivers";
import { CarioApiError } from "./client";

export interface ShiftImportResult {
  success:      boolean;
  upsertedCount: number;
  isStale:      boolean;
  sourceStatus: "OK" | "API_FAILURE" | "USER_APPROVED" | "MOCK";
  errorMessage?: string;
}

/**
 * 指定日のシフトを CARIO から取り込む
 * API失敗時は既存シフトを isStale=true にする
 */
export async function importShiftsForDate(
  workDate: Date,
  adminUserId: string
): Promise<ShiftImportResult> {
  const dateStr = workDate.toISOString().split("T")[0]!;

  try {
    const [carioDrivers, carioShifts] = await Promise.all([
      fetchCarioDrivers(workDate),
      fetchCarioShifts(workDate),
    ]);

    // ドライバー upsert
    for (const d of carioDrivers) {
      await prisma.driver.upsert({
        where: { carioDriverId: d.carioDriverId },
        create: {
          carioDriverId: d.carioDriverId,
          name:        d.name,
          phone:       d.phone ?? null,
          companyName: d.companyName ?? null,
          area:        d.area ?? null,
        },
        update: {
          name:        d.name,
          phone:       d.phone ?? null,
          companyName: d.companyName ?? null,
          area:        d.area ?? null,
        },
      });
    }

    // シフト upsert（isStale=false / sourceStatus=OK）
    let upsertedCount = 0;
    for (const s of carioShifts) {
      const driver = await prisma.driver.findUnique({
        where: { carioDriverId: s.carioDriverId },
      });
      if (!driver) continue;

      await prisma.shift.upsert({
        where: { driverId_workDate: { driverId: driver.id, workDate } },
        create: {
          driverId:     driver.id,
          workDate,
          startTime:    s.startTime ? new Date(`${dateStr}T${s.startTime}:00`) : null,
          endTime:      s.endTime   ? new Date(`${dateStr}T${s.endTime}:00`)   : null,
          status:       s.status as "CONFIRMED" | "TENTATIVE" | "ABSENT",
          source:       "CARIO",
          isStale:      false,
          sourceStatus: "OK",
          importedAt:   new Date(),
        },
        update: {
          startTime:    s.startTime ? new Date(`${dateStr}T${s.startTime}:00`) : null,
          endTime:      s.endTime   ? new Date(`${dateStr}T${s.endTime}:00`)   : null,
          status:       s.status as "CONFIRMED" | "TENTATIVE" | "ABSENT",
          source:       "CARIO",
          isStale:      false,
          sourceStatus: "OK",
          importedAt:   new Date(),
        },
      });
      upsertedCount++;
    }

    return { success: true, upsertedCount, isStale: false, sourceStatus: "OK" };

  } catch (err) {
    // API失敗: 既存シフトを stale 化
    const errorMessage = err instanceof Error ? err.message : "不明なエラー";
    const isCarioError = err instanceof CarioApiError;

    if (isCarioError || process.env.CARIO_API_BASE_URL) {
      // API設定済みで失敗した場合のみ stale 化（モック環境は対象外）
      await prisma.shift.updateMany({
        where: { workDate },
        data: {
          isStale:      true,
          sourceStatus: "API_FAILURE",
        },
      });
    }

    // audit_log
    await prisma.auditLog.create({
      data: {
        userId:     adminUserId,
        action:     "CARIO_IMPORT_FAILED",
        targetType: "shifts",
        targetId:   dateStr,
        afterData:  { errorMessage: isCarioError ? "CARIO_API_ERROR" : "UNEXPECTED_ERROR" },
      },
    });

    return {
      success:       false,
      upsertedCount: 0,
      isStale:       true,
      sourceStatus:  "API_FAILURE",
      errorMessage,
    };
  }
}

/**
 * stale シフトを管理者が承認する（過去データを使用することに同意）
 */
export async function approveStaleShifts(
  workDate: Date,
  adminUserId: string
): Promise<void> {
  await prisma.shift.updateMany({
    where: { workDate, isStale: true },
    data: { sourceStatus: "USER_APPROVED" },
  });

  await prisma.auditLog.create({
    data: {
      userId:     adminUserId,
      action:     "CARIO_STALE_APPROVED",
      targetType: "shifts",
      targetId:   workDate.toISOString().split("T")[0]!,
      afterData:  { sourceStatus: "USER_APPROVED" },
    },
  });
}
