import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { WAREHOUSE } from "@/lib/maps/warehouse";
import { getRouteGeometry } from "@/lib/routes/ors";
import type { GeoPoint } from "@/lib/routes/sortByNearest";

/**
 * A③: 指定ドライバーの配送ルート（route_order 順）を実道路で結んだ経路ジオメトリを返す。
 * 地図（LiveVehicleMap の routePath）に渡して道なりの線を描くための read-only API。
 *
 * GET /api/routes/geometry?driverId=&date=YYYY-MM-DD&waveNo=&return=1
 * 認可: ADMIN は全ドライバー / DRIVER は自分の driverId のみ。
 * ORS_API_KEY 未設定・失敗時は path:null（地図は線を描かないだけ）。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const driverId = sp.get("driverId");
  const date = sp.get("date");
  const waveNo = sp.get("waveNo") ?? undefined;
  const returnToWarehouse = sp.get("return") === "1";

  if (!driverId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "driverId と date（YYYY-MM-DD）が必要です" }, { status: 400 });
  }
  if (session.user.role !== "ADMIN" && session.user.driverId !== driverId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      driverId,
      status: "ASSIGNED",
      deliveryItem: {
        dispatchImage: {
          deliveryDate: new Date(date),
          ocrStatus: "CONFIRMED",
          ...(waveNo && { waveNo }),
        },
      },
    },
    orderBy: { routeOrder: "asc" },
    include: { deliveryItem: { select: { lat: true, lng: true } } },
  });

  const orderedPoints: GeoPoint[] = assignments
    .filter((a) => a.deliveryItem.lat != null && a.deliveryItem.lng != null)
    .map((a) => ({ id: a.id, lat: a.deliveryItem.lat as number, lng: a.deliveryItem.lng as number }));

  const origin: GeoPoint = { id: "warehouse", lat: WAREHOUSE.lat, lng: WAREHOUSE.lng };
  const path = await getRouteGeometry(origin, orderedPoints, returnToWarehouse);

  return NextResponse.json({ path, stopCount: orderedPoints.length });
}
