import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/**
 * 当日の号車配置（号車→ドライバー・日替わり）。管理者専用。
 *
 * GET  /api/admin/vehicle-roster?date=YYYY-MM-DD
 *   → { date, roster:[{vehicleNo, driverId, driverName, note}], candidates:[{driverId,name,vehicleId}] }
 *      candidates = その日シフトのドライバー（配置の選択肢）。
 * PUT  /api/admin/vehicle-roster   body: { date, entries:[{vehicleNo, driverId, note?}] }
 *   → その日の配置を entries で置き換え（driverId空は除外）。
 *
 * ※ 号車番号は固定せず可変（1〜4…今後増える）。号車≠wave。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }
  const workDate = new Date(date);

  const [rosters, shifts] = await Promise.all([
    prisma.vehicleRoster.findMany({ where: { workDate }, orderBy: { vehicleNo: "asc" } }),
    prisma.shift.findMany({ where: { workDate }, include: { driver: true }, orderBy: { driver: { name: "asc" } } }),
  ]);

  const candidates = shifts.map((s) => ({ driverId: s.driver.id, name: s.driver.name, vehicleId: s.driver.vehicleId }));
  // 配置に載っているがシフト外のドライバーの名前も引く
  const missingIds = rosters.map((r) => r.driverId).filter((id) => !candidates.some((c) => c.driverId === id));
  const extra = missingIds.length
    ? await prisma.driver.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = (id: string) =>
    candidates.find((c) => c.driverId === id)?.name ?? extra.find((e) => e.id === id)?.name ?? "";

  return NextResponse.json({
    date,
    roster: rosters.map((r) => ({ vehicleNo: r.vehicleNo, driverId: r.driverId, driverName: nameOf(r.driverId), note: r.note })),
    candidates,
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { date?: string; entries?: { vehicleNo?: string; driverId?: string; note?: string }[] };
  const { date } = body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }
  const workDate = new Date(date);

  // 号車番号ごとに1ドライバー・driverId空は除外・号車番号重複は最後を採用
  const map = new Map<string, { vehicleNo: string; driverId: string; note: string | null }>();
  for (const e of body.entries ?? []) {
    const v = (e.vehicleNo ?? "").trim();
    const d = (e.driverId ?? "").trim();
    if (!v || !d) continue;
    map.set(v, { vehicleNo: v, driverId: d, note: e.note?.trim() || null });
  }
  const entries = [...map.values()];

  await prisma.$transaction([
    prisma.vehicleRoster.deleteMany({ where: { workDate } }),
    ...(entries.length
      ? [prisma.vehicleRoster.createMany({ data: entries.map((e) => ({ workDate, vehicleNo: e.vehicleNo, driverId: e.driverId, note: e.note })) })]
      : []),
  ]);

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "SET_VEHICLE_ROSTER", targetType: "vehicle_rosters", targetId: date, afterData: { count: entries.length } },
  });

  return NextResponse.json({ ok: true, date, count: entries.length });
}
