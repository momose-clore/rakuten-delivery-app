import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/** 応援できる配送一覧（他ドライバーの本日担当・号車ごと） */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const assignments = await prisma.assignment.findMany({
    where: {
      driverId: { not: driverId },
      status: "ASSIGNED",
      deliveryItem: { dispatchImage: { deliveryDate: { gte: today, lt: tomorrow }, ocrStatus: "CONFIRMED" } },
    },
    include: {
      driver: { select: { name: true, companyName: true, vehicleId: true } },
      deliveryItem: { select: { id: true, dispatchKey: true, waveNo: true, vehicleNo: true, address: true, totalCount: true, deliveryStatus: true } },
    },
    orderBy: [{ driverId: "asc" }, { routeOrder: "asc" }],
  });

  const myFollows = await prisma.deliveryFollow.findMany({ where: { driverId }, select: { deliveryItemId: true } });
  const followedSet = new Set(myFollows.map((f) => f.deliveryItemId));

  // ドライバー（号車）ごとにグループ化
  const crews = new Map<string, { driverName: string; company: string; vehicle: string; items: unknown[] }>();
  for (const a of assignments) {
    const key = a.driverId;
    if (!crews.has(key)) {
      crews.set(key, {
        driverName: a.driver.name,
        company: a.driver.companyName ?? "—",
        vehicle: a.driver.vehicleId ?? a.deliveryItem.vehicleNo ?? "—",
        items: [],
      });
    }
    crews.get(key)!.items.push({
      deliveryItemId: a.deliveryItem.id,
      dispatchKey: a.deliveryItem.dispatchKey,
      waveNo: a.deliveryItem.waveNo,
      vehicleNo: a.deliveryItem.vehicleNo,
      address: a.deliveryItem.address,
      totalCount: a.deliveryItem.totalCount,
      deliveryStatus: a.deliveryItem.deliveryStatus,
      followedByMe: followedSet.has(a.deliveryItem.id),
    });
  }

  return NextResponse.json({ crews: [...crews.values()] });
}
