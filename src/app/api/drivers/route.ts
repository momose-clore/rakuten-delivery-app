import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

// GET: ドライバー候補一覧（認証済みユーザー・増便フォームの選択肢用）
// 氏名・会社・エリアのみ返す（電話番号等は返さない）。
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const drivers = await prisma.driver.findMany({
    select: { id: true, name: true, companyName: true, area: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ drivers });
}
