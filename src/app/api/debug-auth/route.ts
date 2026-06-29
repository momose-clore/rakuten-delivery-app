import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcryptjs from "bcryptjs";

// 一時的なデバッグエンドポイント（確認後に削除する）
export async function GET() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "admin@delivery-app.local" },
      include: { driver: { select: { id: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const testPassword = "admin1234";
    const isValid = await bcryptjs.compare(testPassword, user.passwordHash);

    return NextResponse.json({
      ok: true,
      email: user.email,
      role: user.role,
      hashPrefix: user.passwordHash.substring(0, 10) + "...",
      passwordValid: isValid,
      driverId: user.driver?.id ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
