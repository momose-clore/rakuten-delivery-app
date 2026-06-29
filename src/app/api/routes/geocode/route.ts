import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/maps/geocode";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date, waveNo, driverId } = await req.json();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付を指定してください" }, { status: 400 });
  }

  const deliveryDate = new Date(date);

  // lat/lng が未取得の delivery_items を取得
  const items = await prisma.deliveryItem.findMany({
    where: {
      lat: null,
      address: { not: null },
      dispatchImage: {
        deliveryDate,
        ocrStatus: "CONFIRMED",
        ...(waveNo && { waveNo }),
      },
      ...(driverId && {
        assignments: { some: { driverId } },
      }),
    },
  });

  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    if (!item.address) continue;

    const result = await geocodeAddress(item.address);

    if (result) {
      await prisma.deliveryItem.update({
        where: { id: item.id },
        data: { lat: result.lat, lng: result.lng },
      });
      successCount++;
    } else {
      await prisma.deliveryItem.update({
        where: { id: item.id },
        data: { deliveryStatus: "ADDRESS_ERROR" },
      });
      failCount++;
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "GEOCODE_ADDRESSES",
      targetType: "delivery_items",
      targetId: date,
      afterData: { successCount, failCount, total: items.length },
    },
  });

  return NextResponse.json({ success: true, successCount, failCount, total: items.length });
}
