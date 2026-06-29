import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import type { DriverProgress } from "@/types/progress";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const dateParam = searchParams.get("date");
  const area = searchParams.get("area") || undefined;
  const waveNo = searchParams.get("waveNo") || undefined;

  const targetDate = dateParam ? new Date(dateParam) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // 対象日の割当を取得
  const assignments = await prisma.assignment.findMany({
    where: {
      deliveryItem: {
        dispatchImage: {
          deliveryDate: { gte: targetDate, lt: nextDate },
          ocrStatus: "CONFIRMED",
          ...(area && { area }),
          ...(waveNo && { waveNo }),
        },
      },
    },
    include: {
      driver: true,
      deliveryItem: {
        select: { deliveryStatus: true, updatedAt: true },
      },
    },
  });

  // ドライバー別に集計
  const driverMap = new Map<string, DriverProgress>();

  for (const a of assignments) {
    if (!driverMap.has(a.driverId)) {
      driverMap.set(a.driverId, {
        driverId: a.driverId,
        driverName: a.driver.name,
        companyName: a.driver.companyName,
        area: a.driver.area,
        vehicleId: a.driver.vehicleId,
        totalCount: 0,
        completedCount: 0,
        absentCount: 0,
        returnedCount: 0,
        skippedCount: 0,
        inProgressCount: 0,
        lastUpdatedAt: null,
      });
    }

    const dp = driverMap.get(a.driverId)!;
    dp.totalCount++;

    const st = a.deliveryItem.deliveryStatus;
    if (st === "COMPLETED") dp.completedCount++;
    else if (st === "ABSENT") dp.absentCount++;
    else if (st === "RETURNED") dp.returnedCount++;
    else if (st === "SKIPPED") dp.skippedCount++;
    else dp.inProgressCount++;

    const updatedAt = a.deliveryItem.updatedAt.toISOString();
    if (!dp.lastUpdatedAt || updatedAt > dp.lastUpdatedAt) {
      dp.lastUpdatedAt = updatedAt;
    }
  }

  const drivers = [...driverMap.values()].sort((a, b) => a.driverName.localeCompare(b.driverName));
  return NextResponse.json({ drivers, date: targetDate.toISOString().split("T")[0] });
}
