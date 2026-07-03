import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

const DONE_STATUSES = ["COMPLETED", "ABSENT", "RETURNED", "SKIPPED"];

/** クルーが本日の配送終了を報告する（全担当が完了している場合のみ） */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  const workDate = new Date();
  workDate.setHours(0, 0, 0, 0);
  const tomorrow = new Date(workDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 本日の担当配送を取得し、全て完了しているか確認
  const assignments = await prisma.assignment.findMany({
    where: {
      driverId,
      status: "ASSIGNED",
      deliveryItem: { dispatchImage: { deliveryDate: { gte: workDate, lt: tomorrow }, ocrStatus: "CONFIRMED" } },
    },
    include: { deliveryItem: { select: { deliveryStatus: true } } },
  });

  const remaining = assignments.filter((a) => !DONE_STATUSES.includes(a.deliveryItem.deliveryStatus)).length;
  if (remaining > 0) {
    return NextResponse.json({ error: `未完了の配送が ${remaining} 件あります`, remaining }, { status: 409 });
  }

  const report = await prisma.driverDayReport.upsert({
    where: { driverId_workDate: { driverId, workDate } },
    create: { driverId, workDate, finishedReportedAt: new Date() },
    update: { finishedReportedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DRIVER_FINISH_REPORT", targetType: "driver_day_reports", targetId: report.id, afterData: { count: assignments.length } },
  });

  return NextResponse.json({ success: true, finishedReportedAt: report.finishedReportedAt });
}
