import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { buildMapsUrls } from "@/lib/maps/url";
import type { DriverRoute, RouteItem, RouteGroupInfo } from "@/types/route";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date");
  const waveNo = searchParams.get("waveNo") || undefined;
  const driverId = searchParams.get("driverId") || undefined;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付を指定してください" }, { status: 400 });
  }

  const deliveryDate = new Date(date);

  const assignments = await prisma.assignment.findMany({
    where: {
      status: "ASSIGNED",
      ...(driverId && { driverId }),
      deliveryItem: {
        dispatchImage: {
          deliveryDate,
          ocrStatus: "CONFIRMED",
          ...(waveNo && { waveNo }),
        },
      },
    },
    include: {
      driver: true,
      deliveryItem: { include: { dispatchImage: true } },
    },
    orderBy: [{ driverId: "asc" }, { routeOrder: "asc" }],
  });

  // ドライバー別にグループ化
  const driverMap = new Map<string, DriverRoute>();

  for (const a of assignments) {
    if (!driverMap.has(a.driverId)) {
      // RouteGroup 取得
      const routeGroups = await prisma.routeGroup.findMany({
        where: { driverId: a.driverId, deliveryDate },
      });

      driverMap.set(a.driverId, {
        driverId: a.driverId,
        driverName: a.driver.name,
        companyName: a.driver.companyName,
        area: a.driver.area,
        vehicleId: a.driver.vehicleId,
        items: [],
        routeGroups: routeGroups.map((rg): RouteGroupInfo => ({
          routeGroupId: rg.id,
          waveGroup: rg.waveGroup,
          loadingMode: rg.loadingMode,
          returnToWarehouse: rg.returnToWarehouse,
        })),
        mapsUrls: [],
      });
    }

    const item: RouteItem = {
      assignmentId: a.id,
      routeOrder: a.routeOrder,
      deliveryItemId: a.deliveryItemId,
      dispatchKey: a.deliveryItem.dispatchKey,
      waveNo: a.deliveryItem.waveNo,
      vehicleNo: a.deliveryItem.vehicleNo,
      address: a.deliveryItem.address,
      lat: a.deliveryItem.lat,
      lng: a.deliveryItem.lng,
      totalCount: a.deliveryItem.totalCount,
      memo: a.deliveryItem.memo,
      deliveryStatus: a.deliveryItem.deliveryStatus,
    };
    driverMap.get(a.driverId)!.items.push(item);
  }

  // Google Maps URL を生成（lat/lng 揃っているものを使用）
  for (const driver of driverMap.values()) {
    const sorted = driver.items
      .filter((i) => i.routeOrder !== null && i.lat !== null && i.lng !== null)
      .sort((a, b) => (a.routeOrder ?? 0) - (b.routeOrder ?? 0));

    if (sorted.length > 0) {
      const rg = driver.routeGroups[0];
      const returnToWarehouse = rg?.returnToWarehouse ?? true;
      driver.mapsUrls = buildMapsUrls(
        sorted.map((i) => ({ lat: i.lat!, lng: i.lng! })),
        returnToWarehouse
      );
    }
  }

  const drivers = [...driverMap.values()];
  const geocodedCount = assignments.filter((a) => a.deliveryItem.lat !== null).length;
  const ungeocodedCount = assignments.length - geocodedCount;

  return NextResponse.json({ drivers, geocodedCount, ungeocodedCount });
}
