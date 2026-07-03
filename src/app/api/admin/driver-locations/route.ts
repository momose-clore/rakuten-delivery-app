import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/**
 * 全ドライバーの現在地一覧（管理者・GPS リアルタイム表示用）
 * - DriverLocation（現在地）＋ Driver（氏名・号車・会社）を driverId でマージ
 * - 30秒ポーリング前提の軽量レスポンス
 * - staleSec: 何秒前の位置か（一定時間更新が無いドライバーは古いピン扱いにできる）
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const locations = await prisma.driverLocation.findMany();
  if (locations.length === 0) {
    return NextResponse.json({ locations: [], serverTime: new Date().toISOString() });
  }

  const drivers = await prisma.driver.findMany({
    where: { id: { in: locations.map((l) => l.driverId) } },
    select: { id: true, name: true, vehicleId: true, companyName: true, area: true },
  });
  const driverMap = new Map(drivers.map((d) => [d.id, d]));

  const now = Date.now();
  const result = locations.map((l) => {
    const d = driverMap.get(l.driverId);
    const recordedMs = l.recordedAt.getTime();
    return {
      driverId: l.driverId,
      name: d?.name ?? "不明",
      vehicle: d?.vehicleId ? `${d.vehicleId}号車` : "—",
      company: d?.companyName ?? null,
      area: d?.area ?? null,
      lat: l.lat,
      lng: l.lng,
      accuracy: l.accuracy,
      heading: l.heading,
      speed: l.speed,
      recordedAt: l.recordedAt.toISOString(),
      staleSec: Math.max(0, Math.round((now - recordedMs) / 1000)),
    };
  });

  return NextResponse.json({ locations: result, serverTime: new Date().toISOString() });
}
