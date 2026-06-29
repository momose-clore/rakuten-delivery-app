import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import type { DeliveryProgress } from "@/types/progress";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { driverId } = await params;
  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const assignments = await prisma.assignment.findMany({
    where: {
      driverId,
      deliveryItem: {
        dispatchImage: {
          deliveryDate: { gte: targetDate, lt: nextDate },
          ocrStatus: "CONFIRMED",
        },
      },
    },
    include: {
      deliveryItem: {
        select: {
          id: true,
          dispatchKey: true,
          waveNo: true,
          address: true,
          totalCount: true,
          memo: true,
          deliveryStatus: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { routeOrder: "asc" },
  });

  // 住所・備考はログに出さない
  const items: DeliveryProgress[] = assignments.map((a) => ({
    deliveryItemId: a.deliveryItemId,
    assignmentId: a.id,
    routeOrder: a.routeOrder,
    waveNo: a.deliveryItem.waveNo,
    dispatchKey: a.deliveryItem.dispatchKey,
    address: a.deliveryItem.address,
    totalCount: a.deliveryItem.totalCount,
    memo: a.deliveryItem.memo,
    deliveryStatus: a.deliveryItem.deliveryStatus,
    updatedAt: a.deliveryItem.updatedAt.toISOString(),
  }));

  return NextResponse.json({ items });
}
