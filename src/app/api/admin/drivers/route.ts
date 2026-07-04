import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

// GET: ドライバー一覧（管理者用・ログインID/紐付け状況込み）
// パスワードは bcrypt ハッシュのため「値」は返せない（設定済みか否かのみ）。
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const drivers = await prisma.driver.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      carioDriverId: true,
      vehicleId: true,
      companyName: true,
      area: true,
      user: { select: { email: true, passwordHash: true } },
    },
  });

  const list = drivers.map((d) => ({
    id: d.id,
    name: d.name,
    carioDriverId: d.carioDriverId,
    vehicleId: d.vehicleId,
    companyName: d.companyName,
    area: d.area,
    loginId: d.user?.email ?? null,   // ログインID（メール/ID）
    hasAccount: !!d.user,
    hasPassword: !!d.user?.passwordHash,
  }));

  return NextResponse.json({ drivers: list });
}
