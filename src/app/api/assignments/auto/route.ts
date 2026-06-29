import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { autoAssign } from "@/lib/assignment/autoAssign";
import type { AssignedItem, AvailableDriver } from "@/types/assignment";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date, waveNo, area } = await req.json();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付を指定してください（YYYY-MM-DD）" }, { status: 400 });
  }

  const deliveryDate = new Date(date);

  // CONFIRMED 配送明細（未割当）を取得
  const images = await prisma.dispatchImage.findMany({
    where: {
      deliveryDate,
      ocrStatus: "CONFIRMED",
      ...(area && { area }),
      ...(waveNo && { waveNo }),
    },
  });
  const imageIds = images.map((i) => i.id);

  const rawItems = await prisma.deliveryItem.findMany({
    where: {
      dispatchImageId: { in: imageIds },
      deliveryStatus: { in: ["PENDING_OCR", "UNASSIGNED"] },
    },
    include: { assignments: true },
  });

  // 未割当のみ対象
  const unassignedItems = rawItems.filter((i) => i.assignments.length === 0);

  const items: AssignedItem[] = unassignedItems.map((i) => ({
    deliveryItemId: i.id,
    dispatchKey: i.dispatchKey,
    waveNo: i.waveNo,
    vehicleNo: i.vehicleNo,
    deliverySeq: i.deliverySeq,
    address: i.address,
    totalCount: i.totalCount,
    deliveryStatus: i.deliveryStatus,
    assignmentId: null,
    assignedDriverId: null,
    assignedDriverName: null,
  }));

  if (items.length === 0) {
    return NextResponse.json({ success: true, assignedCount: 0, message: "未割当の明細がありません" });
  }

  // 稼働可能ドライバー取得
  const shifts = await prisma.shift.findMany({
    where: { workDate: deliveryDate, status: { not: "ABSENT" } },
    include: { driver: true },
  });

  const drivers: AvailableDriver[] = shifts
    .filter((s) => s.driver.vehicleId)
    .map((s) => ({
      driverId: s.driver.id,
      name: s.driver.name,
      companyName: s.driver.companyName,
      area: s.driver.area,
      vehicleId: s.driver.vehicleId,
      startTime: null,
      endTime: null,
      shiftStatus: s.status,
      assignedCount: 0,
    }));

  if (drivers.length === 0) {
    return NextResponse.json({ error: "稼働可能なドライバーがいません" }, { status: 409 });
  }

  // 半自動割当
  const assignMap = autoAssign(items, drivers, area);

  // upsert 保存
  let assignedCount = 0;
  for (const [deliveryItemId, driverId] of assignMap) {
    await prisma.assignment.upsert({
      where: { deliveryItemId },
      update: { driverId, waveNo: items.find((i) => i.deliveryItemId === deliveryItemId)?.waveNo ?? null },
      create: {
        deliveryItemId,
        driverId,
        waveNo: items.find((i) => i.deliveryItemId === deliveryItemId)?.waveNo ?? null,
        status: "ASSIGNED",
      },
    });

    await prisma.deliveryItem.update({
      where: { id: deliveryItemId },
      data: { deliveryStatus: "ASSIGNED" },
    });

    assignedCount++;
  }

  // 操作ログ（件数のみ・個人情報なし）
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "AUTO_ASSIGN",
      targetType: "assignments",
      targetId: date,
      afterData: { assignedCount, driverCount: drivers.length, date, waveNo: waveNo ?? null, area: area ?? null },
    },
  });

  return NextResponse.json({ success: true, assignedCount });
}
