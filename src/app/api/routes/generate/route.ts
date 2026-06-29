import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { generateRoute } from "@/lib/routes";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date, waveNo, driverId, returnToWarehouse = true } = await req.json();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付を指定してください" }, { status: 400 });
  }

  const deliveryDate = new Date(date);

  // ドライバーを特定（指定なし → 全ドライバー）
  const shifts = await prisma.shift.findMany({
    where: {
      workDate: deliveryDate,
      status: { not: "ABSENT" },
      ...(driverId && { driverId }),
    },
    select: { driverId: true },
  });

  const targetDriverIds = driverId
    ? [driverId]
    : [...new Set(shifts.map((s) => s.driverId))];

  const results = await Promise.all(
    targetDriverIds.map((id) =>
      generateRoute(id, deliveryDate, waveNo, returnToWarehouse, session.user.id)
    )
  );

  return NextResponse.json({ success: true, results });
}
