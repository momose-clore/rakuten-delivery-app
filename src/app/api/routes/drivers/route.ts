import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/**
 * 指定日に配送（ASSIGNED）があるドライバー一覧を返す（GPS送信の有無に関わらず）。
 * 地図で「本日配送のある号車」を選んでルート/配送先を表示するためのセレクタ用。ADMIN のみ。
 * GET /api/routes/drivers?date=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date（YYYY-MM-DD）が必要です" }, { status: 400 });
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      status: "ASSIGNED",
      deliveryItem: { dispatchImage: { deliveryDate: new Date(date), ocrStatus: "CONFIRMED" } },
    },
    select: { driverId: true },
  });

  const counts = new Map<string, number>();
  for (const a of assignments) counts.set(a.driverId, (counts.get(a.driverId) ?? 0) + 1);

  const drivers = await prisma.driver.findMany({
    where: { id: { in: [...counts.keys()] } },
    select: { id: true, name: true, vehicleId: true },
  });

  const result = drivers
    .map((d) => ({
      driverId: d.id,
      name: d.name,
      vehicle: d.vehicleId ? `${d.vehicleId}号車` : "—",
      stopCount: counts.get(d.id) ?? 0,
    }))
    .sort((a, b) => a.vehicle.localeCompare(b.vehicle, "ja"));

  return NextResponse.json({ drivers: result });
}
