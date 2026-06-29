import { prisma } from "@/lib/prisma";
import { WAREHOUSE } from "@/lib/maps/warehouse";
import { sortByNearest, type GeoPoint } from "./sortByNearest";
import { buildMapsUrls } from "@/lib/maps/url";

export interface RouteGenerateResult {
  driverId: string;
  routedCount: number;
  skippedCount: number; // lat/lng 未取得でスキップした件数
  mapsUrls: string[];
}

/**
 * ドライバーの配送ルートを生成し、route_order を assignments に保存する。
 * @param driverId ドライバーID
 * @param date 配送日（Date オブジェクト）
 * @param waveNo W番号（指定なしは全 wave）
 * @param returnToWarehouse 倉庫戻りするか
 */
export async function generateRoute(
  driverId: string,
  date: Date,
  waveNo: string | undefined,
  returnToWarehouse: boolean,
  userId: string
): Promise<RouteGenerateResult> {
  // 割当済み配送明細を取得
  const assignments = await prisma.assignment.findMany({
    where: {
      driverId,
      status: "ASSIGNED",
      deliveryItem: {
        dispatchImage: {
          deliveryDate: date,
          ocrStatus: "CONFIRMED",
          ...(waveNo && { waveNo }),
        },
      },
    },
    include: {
      deliveryItem: {
        include: { dispatchImage: true },
      },
    },
  });

  // lat/lng が揃っているものだけソート対象
  const withCoords = assignments.filter(
    (a) => a.deliveryItem.lat !== null && a.deliveryItem.lng !== null
  );
  const skippedCount = assignments.length - withCoords.length;

  const origin: GeoPoint = { id: "warehouse", lat: WAREHOUSE.lat, lng: WAREHOUSE.lng };
  const points: GeoPoint[] = withCoords.map((a) => ({
    id: a.id,
    lat: a.deliveryItem.lat!,
    lng: a.deliveryItem.lng!,
  }));

  const sorted = sortByNearest(origin, points);

  // route_order を assignments に保存
  for (let i = 0; i < sorted.length; i++) {
    await prisma.assignment.update({
      where: { id: sorted[i].id },
      data: {
        routeOrder: i + 1,
        loadingGroup: waveNo ?? null,
      },
    });
  }

  // RouteGroup を upsert
  const waveGroup = waveNo ?? "ALL";
  await prisma.routeGroup.upsert({
    where: { driverId_deliveryDate_waveGroup: { driverId, deliveryDate: date, waveGroup } },
    update: { returnToWarehouse, startLocation: WAREHOUSE.address },
    create: {
      driverId,
      deliveryDate: date,
      waveGroup,
      loadingMode: "SIMULTANEOUS",
      startLocation: WAREHOUSE.address,
      returnToWarehouse,
    },
  });

  // Google Maps URL 生成
  const waypoints = sorted.map((p) => {
    const assignment = withCoords.find((a) => a.id === p.id)!;
    return { lat: assignment.deliveryItem.lat!, lng: assignment.deliveryItem.lng! };
  });
  const mapsUrls = buildMapsUrls(waypoints, returnToWarehouse);

  await prisma.auditLog.create({
    data: {
      userId,
      action: "GENERATE_ROUTE",
      targetType: "assignments",
      targetId: driverId,
      afterData: { routedCount: sorted.length, skippedCount, waveNo: waveNo ?? null },
    },
  });

  return { driverId, routedCount: sorted.length, skippedCount, mapsUrls };
}
