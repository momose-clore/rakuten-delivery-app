import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 一時的なデバッグエンドポイント（確認後に削除する）
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const user = await prisma.user.findFirst({
      select: { email: true, role: true, createdAt: true },
    });
    return NextResponse.json({
      ok: true,
      userCount,
      firstUser: user,
      dbUrl: process.env.DATABASE_URL ? "set" : "NOT SET",
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      dbUrl: process.env.DATABASE_URL ? "set" : "NOT SET",
    }, { status: 500 });
  }
}
