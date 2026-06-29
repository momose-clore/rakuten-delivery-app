import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const workDate = new Date(date);

  const shifts = await prisma.shift.findMany({
    where: { workDate },
    include: { driver: true },
    orderBy: [{ driver: { companyName: "asc" } }, { driver: { name: "asc" } }],
  });

  const drivers = shifts.map((s) => ({
    driverId: s.driver.id,
    carioDriverId: s.driver.carioDriverId,
    name: s.driver.name,
    companyName: s.driver.companyName,
    area: s.driver.area,
    vehicleId: s.driver.vehicleId,
    shiftId: s.id,
    workDate: s.workDate.toISOString().split("T")[0],
    startTime: s.startTime ? `${String(s.startTime.getUTCHours()).padStart(2, "0")}:${String(s.startTime.getUTCMinutes()).padStart(2, "0")}` : null,
    endTime: s.endTime ? `${String(s.endTime.getUTCHours()).padStart(2, "0")}:${String(s.endTime.getUTCMinutes()).padStart(2, "0")}` : null,
    status: s.status,
  }));

  // 集計
  const companyBreakdown: Record<string, number> = {};
  const areaBreakdown: Record<string, number> = {};
  let confirmedCount = 0;
  let tentativeCount = 0;

  for (const d of drivers) {
    if (d.status === "CONFIRMED") confirmedCount++;
    if (d.status === "TENTATIVE") tentativeCount++;
    const company = d.companyName ?? "不明";
    const area = d.area ?? "不明";
    companyBreakdown[company] = (companyBreakdown[company] ?? 0) + 1;
    areaBreakdown[area] = (areaBreakdown[area] ?? 0) + 1;
  }

  return NextResponse.json({
    drivers,
    summary: {
      total: drivers.length,
      confirmedCount,
      tentativeCount,
      companyBreakdown,
      areaBreakdown,
    },
  });
}
