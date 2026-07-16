import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { deliveryTimingStatus } from "@/lib/waves";

// 遅配予想（管理者専用）: 当日シフト名簿（CARIO由来）× Wave締切で「遅配しそうなドライバー」を判定。
//   GET /api/admin/late-forecast?date=YYYY-MM-DD
//   → { date, drivers: [{ driverId, name, vehicleId, area, companyName, total, completed, remaining, status }] }
//   status: late(遅配・締切超過の未完了あり) / atRisk(締切30分以内の未完了あり) / onTime(未完了ありだが余裕) /
//           done(全完了) / none(担当なし)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const now = new Date();

  // 当日シフトに入っているドライバー（CARIO取込のシフト。ABSENT除く）= 楽天美女木の名簿
  const shifts = await prisma.shift.findMany({
    where: { workDate: { gte: targetDate, lt: nextDate }, status: { not: "ABSENT" } },
    include: { driver: true },
    orderBy: { driver: { name: "asc" } },
  });

  // 当日の割当（Wave別終了状況の素）: driverId → 未完了/完了とWave
  const assignments = await prisma.assignment.findMany({
    where: {
      deliveryItem: { dispatchImage: { deliveryDate: { gte: targetDate, lt: nextDate }, ocrStatus: "CONFIRMED" } },
    },
    include: { deliveryItem: { select: { waveNo: true, deliveryStatus: true } } },
  });

  const byDriver = new Map<string, { total: number; completed: number; incompleteWaves: (string | null)[] }>();
  for (const a of assignments) {
    const d = byDriver.get(a.driverId) ?? { total: 0, completed: 0, incompleteWaves: [] };
    d.total++;
    const st = a.deliveryItem.deliveryStatus;
    if (st === "COMPLETED" || st === "SKIPPED") d.completed++;
    else d.incompleteWaves.push(a.deliveryItem.waveNo);
    byDriver.set(a.driverId, d);
  }

  // ウェーブごとの終了報告（帰庫/業務終了）= wave_completions。CARIO/LINE由来の実績。
  // driverId で紐付かない取込（LINE=氏名キー）にも対応するため氏名（空白除去）でも突合する。
  const completions = await prisma.waveCompletion.findMany({
    where: { date: { gte: targetDate, lt: nextDate } },
    select: { waveNo: true, driverId: true, driverName: true },
  });
  const normName = (s: string) => s.replace(/[\s　]/g, "");
  const wcById = new Map<string, Set<number>>();
  const wcByName = new Map<string, Set<number>>();
  for (const c of completions) {
    if (c.driverId) {
      if (!wcById.has(c.driverId)) wcById.set(c.driverId, new Set());
      wcById.get(c.driverId)!.add(c.waveNo);
    }
    if (c.driverName) {
      const k = normName(c.driverName);
      if (!wcByName.has(k)) wcByName.set(k, new Set());
      wcByName.get(k)!.add(c.waveNo);
    }
  }

  type Status = "late" | "atRisk" | "onTime" | "done" | "none";
  const drivers = shifts.map((s) => {
    // ① ウェーブ終了報告があればそれを実績として反映（帰庫/業務終了＝完了）
    const rep = wcById.get(s.driverId) ?? wcByName.get(normName(s.driver.name));
    if (rep && rep.size > 0) {
      const doneWaves = rep.size;
      return {
        driverId: s.driverId,
        name: s.driver.name,
        vehicleId: s.driver.vehicleId,
        area: s.driver.area,
        companyName: s.driver.companyName,
        total: doneWaves,
        completed: doneWaves,
        remaining: 0,
        status: "done" as Status,
      };
    }
    // ② 報告が無ければ従来のアプリ内割当ベース
    const agg = byDriver.get(s.driverId);
    let status: Status = "none";
    if (agg) {
      if (agg.incompleteWaves.length === 0) {
        status = "done";
      } else {
        // 未完了の各Waveを締切判定。LATE=遅配 / SOON=締切間近 / それ以外=余裕
        const timings = agg.incompleteWaves.map((w) => deliveryTimingStatus(w, now));
        if (timings.includes("LATE")) status = "late";
        else if (timings.includes("SOON")) status = "atRisk";
        else status = "onTime";
      }
    }
    return {
      driverId: s.driverId,
      name: s.driver.name,
      vehicleId: s.driver.vehicleId,
      area: s.driver.area,
      companyName: s.driver.companyName,
      total: agg?.total ?? 0,
      completed: agg?.completed ?? 0,
      remaining: agg ? agg.total - agg.completed : 0,
      status,
    };
  });

  // 遅配→締切間近→… の順に並べる（要注意を上に）
  const rank: Record<string, number> = { late: 0, atRisk: 1, onTime: 2, none: 3, done: 4 };
  drivers.sort((a, b) => (rank[a.status] - rank[b.status]) || a.name.localeCompare(b.name));

  return NextResponse.json({ date: targetDate.toISOString().split("T")[0], drivers });
}
