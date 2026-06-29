import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import type { AssignedItem, AvailableDriver, AssignmentSummary } from "@/types/assignment";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date");
  const waveNo = searchParams.get("waveNo") || undefined;
  const area = searchParams.get("area") || undefined;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付を指定してください（YYYY-MM-DD）" }, { status: 400 });
  }

  const deliveryDate = new Date(date);

  // CONFIRMED の dispatch_images を取得（日付・エリア絞り込み）
  const images = await prisma.dispatchImage.findMany({
    where: {
      deliveryDate,
      ocrStatus: "CONFIRMED",
      ...(area && { area }),
      ...(waveNo && { waveNo }),
    },
  });
  const imageIds = images.map((i) => i.id);

  // delivery_items 取得
  const deliveryItems = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: { in: imageIds } },
    include: { assignments: { include: { driver: true } } },
    orderBy: [{ waveNo: "asc" }, { vehicleNo: "asc" }, { deliverySeq: "asc" }],
  });

  // 稼働可能ドライバー取得（ABSENT 以外・車両あり）
  const shifts = await prisma.shift.findMany({
    where: {
      workDate: deliveryDate,
      status: { not: "ABSENT" },
    },
    include: { driver: true },
  });

  // 現在の割当件数を集計
  const assignedCounts: Record<string, number> = {};
  for (const item of deliveryItems) {
    const a = item.assignments[0];
    if (a) {
      assignedCounts[a.driverId] = (assignedCounts[a.driverId] ?? 0) + 1;
    }
  }

  const items: AssignedItem[] = deliveryItems.map((item) => {
    const assignment = item.assignments[0] ?? null;
    return {
      deliveryItemId: item.id,
      dispatchKey: item.dispatchKey,
      waveNo: item.waveNo,
      vehicleNo: item.vehicleNo,
      deliverySeq: item.deliverySeq,
      address: item.address,
      totalCount: item.totalCount,
      deliveryStatus: item.deliveryStatus,
      assignmentId: assignment?.id ?? null,
      assignedDriverId: assignment?.driverId ?? null,
      assignedDriverName: assignment?.driver?.name ?? null,
    };
  });

  const drivers: AvailableDriver[] = shifts
    .filter((s) => s.driver.vehicleId)
    .map((s) => ({
      driverId: s.driver.id,
      name: s.driver.name,
      companyName: s.driver.companyName,
      area: s.driver.area,
      vehicleId: s.driver.vehicleId,
      startTime: s.startTime
        ? `${String(s.startTime.getUTCHours()).padStart(2, "0")}:${String(s.startTime.getUTCMinutes()).padStart(2, "0")}`
        : null,
      endTime: s.endTime
        ? `${String(s.endTime.getUTCHours()).padStart(2, "0")}:${String(s.endTime.getUTCMinutes()).padStart(2, "0")}`
        : null,
      shiftStatus: s.status,
      assignedCount: assignedCounts[s.driver.id] ?? 0,
    }));

  // 集計
  const unassignedCount = items.filter((i) => !i.assignedDriverId).length;
  const assignedCount = items.filter((i) => !!i.assignedDriverId).length;
  const driverBreakdown: Record<string, number> = {};
  const waveBreakdown: Record<string, number> = {};
  const vehicleBreakdown: Record<string, number> = {};

  for (const item of items) {
    if (item.assignedDriverName) {
      driverBreakdown[item.assignedDriverName] = (driverBreakdown[item.assignedDriverName] ?? 0) + 1;
    }
    if (item.waveNo) {
      waveBreakdown[item.waveNo] = (waveBreakdown[item.waveNo] ?? 0) + 1;
    }
    if (item.vehicleNo) {
      vehicleBreakdown[item.vehicleNo] = (vehicleBreakdown[item.vehicleNo] ?? 0) + 1;
    }
  }

  const summary: AssignmentSummary = {
    totalItems: items.length,
    unassignedCount,
    assignedCount,
    driverCount: drivers.length,
    driverBreakdown,
    waveBreakdown,
    vehicleBreakdown,
  };

  return NextResponse.json({ items, drivers, summary });
}
