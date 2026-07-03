import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/** クルーが朝の倉庫到着時刻を記録する（1日1件・upsert） */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  const { time } = (await req.json()) as { time?: string };
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "time は HH:MM 形式で指定してください" }, { status: 400 });
  }

  const workDate = new Date();
  workDate.setHours(0, 0, 0, 0);
  const dateStr = workDate.toISOString().split("T")[0]!;
  const arrivalAt = new Date(`${dateStr}T${time}:00`);

  const report = await prisma.driverDayReport.upsert({
    where: { driverId_workDate: { driverId, workDate } },
    create: { driverId, workDate, warehouseArrivalAt: arrivalAt },
    update: { warehouseArrivalAt: arrivalAt },
  });

  return NextResponse.json({ success: true, warehouseArrivalAt: report.warehouseArrivalAt });
}
