import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { buildMapsUrls } from "@/lib/maps/url";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 本人担当分のみ取得（DB 側で driverId を照合）
  const assignments = await prisma.assignment.findMany({
    where: {
      driverId,
      status: "ASSIGNED",
      deliveryItem: {
        dispatchImage: {
          deliveryDate: { gte: today, lt: tomorrow },
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
          vehicleNo: true,
          address: true,
          normalOriconCount: true,
          coolerBoxCount: true,
          caseCount: true,
          totalCount: true,
          memo: true,
          lat: true,
          lng: true,
          deliveryStatus: true,
        },
      },
    },
    orderBy: { routeOrder: "asc" },
  });

  // 個人情報はログに出さない（address 等を console.log しない）
  const items = assignments.map((a) => ({
    assignmentId: a.id,
    routeOrder: a.routeOrder,
    waveNo: a.deliveryItem.waveNo,
    deliveryItemId: a.deliveryItem.id,
    dispatchKey: a.deliveryItem.dispatchKey,
    vehicleNo: a.deliveryItem.vehicleNo,
    address: a.deliveryItem.address,
    normalOriconCount: a.deliveryItem.normalOriconCount,
    coolerBoxCount: a.deliveryItem.coolerBoxCount,
    caseCount: a.deliveryItem.caseCount,
    totalCount: a.deliveryItem.totalCount,
    memo: a.deliveryItem.memo,
    lat: a.deliveryItem.lat,
    lng: a.deliveryItem.lng,
    deliveryStatus: a.deliveryItem.deliveryStatus,
  }));

  // Google Maps URL（lat/lng がある順番通りに生成）
  const geoItems = items.filter((i) => i.routeOrder !== null && i.lat !== null && i.lng !== null)
    .sort((a, b) => (a.routeOrder ?? 0) - (b.routeOrder ?? 0));

  const mapsUrls = geoItems.length > 0
    ? buildMapsUrls(geoItems.map((i) => ({ lat: i.lat!, lng: i.lng! })), true)
    : [];

  return NextResponse.json({ items, mapsUrls });
}
