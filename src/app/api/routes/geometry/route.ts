import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { WAREHOUSE } from "@/lib/maps/warehouse";
import { getRouteGeometry } from "@/lib/routes/ors";
import type { GeoPoint } from "@/lib/routes/sortByNearest";
import { normalizeAddress } from "@/lib/address/address-normalizer";
import { deliveryTimingStatus } from "@/lib/waves";

/** waves.ts の判定を地図/UI 用の status に変換 */
function toStopStatus(waveNo: string | null): "onTime" | "soon" | "late" | null {
  switch (deliveryTimingStatus(waveNo)) {
    case "LATE":
      return "late";
    case "SOON":
      return "soon";
    case "ON_TIME":
      return "onTime";
    default:
      return null;
  }
}

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
    include: { deliveryItem: { select: { lat: true, lng: true, customerName: true, address: true, waveNo: true } } },
  });

  const withCoords = assignments.filter(
    (a) => a.deliveryItem.lat != null && a.deliveryItem.lng != null,
  );

  const orderedPoints: GeoPoint[] = withCoords.map((a) => ({
    id: a.id,
    lat: a.deliveryItem.lat as number,
    lng: a.deliveryItem.lng as number,
  }));

  // 配送先ピン用（配送順＋宛名）。宛名は正当な配送データ（OCR取込）で、
  // ADMIN or 本人ドライバーのみに返す。※ログには出さない（個人情報保護方針）。
  const stops = withCoords.map((a, i) => ({
    seq: a.routeOrder ?? i + 1,
    lat: a.deliveryItem.lat as number,
    lng: a.deliveryItem.lng as number,
    name: a.deliveryItem.customerName ?? null,
    // 住所（丁目・番地・号：OCR取込の正当データ）。無料の公的地図では号まで出ないため、配送先の実住所を表示する。
    address: a.deliveryItem.address ?? null,
    // 建物名（ビル/アパート/マンション/商業施設）は配送先住所から抽出（OCRの正当データ）
    building: a.deliveryItem.address
      ? normalizeAddress(a.deliveryItem.address).buildingName
      : null,
    // 遅配マーク用（β はテーブル/地図に渡すだけ）。waves.ts の締切判定。
    waveNo: a.deliveryItem.waveNo ?? null,
    status: toStopStatus(a.deliveryItem.waveNo ?? null),
  }));
  const stopAddrs = withCoords.map((a) => a.deliveryItem.address ?? null);

  // 自動蓄積：宛名が空の配送先は、過去に同じ住所へ配達した実績（OCR取込済の正当データ）の宛名で補完。
  // 貨物一覧を読み取るほど履歴が増え、地図の宛名が自動で充実する。※外部データは一切使わない。
  const missingAddrs = [
    ...new Set(stopAddrs.filter((addr, i): addr is string => !!addr && !stops[i].name)),
  ];
  if (missingAddrs.length > 0) {
    const history = await prisma.deliveryItem.findMany({
      where: { address: { in: missingAddrs }, customerName: { not: null } },
      select: { address: true, customerName: true },
      orderBy: { createdAt: "desc" },
    });
    const byAddr = new Map<string, string>();
    for (const h of history) {
      if (h.address && h.customerName && !byAddr.has(h.address)) byAddr.set(h.address, h.customerName);
    }
    stops.forEach((s, i) => {
      const addr = stopAddrs[i];
      if (!s.name && addr && byAddr.has(addr)) s.name = byAddr.get(addr) ?? null;
    });
  }

  const origin: GeoPoint = { id: "warehouse", lat: WAREHOUSE.lat, lng: WAREHOUSE.lng };
  const path = await getRouteGeometry(origin, orderedPoints, returnToWarehouse);

  return NextResponse.json({ path, stops, stopCount: orderedPoints.length });
}
