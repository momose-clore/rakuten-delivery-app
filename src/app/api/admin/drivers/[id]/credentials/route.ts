import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

// POST: ドライバーのログインID/パスワードを設定・リセット（ADMIN のみ）
//   body: { loginId?: string, password: string }
//   - 既にアカウントがある: パスワード更新（loginId 指定時はIDも更新）
//   - アカウント未作成: loginId 必須で新規作成し Driver に紐付け
// 既存パスワードは bcrypt ハッシュのため取得不可 → 本APIで「設定」する。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const driver = await prisma.driver.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!driver) return NextResponse.json({ error: "ドライバーが見つかりません" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  const loginId = typeof body.loginId === "string" ? body.loginId.trim() : "";

  if (password.length < 4) {
    return NextResponse.json({ error: "パスワードは4文字以上で入力してください" }, { status: 400 });
  }

  const passwordHash = await bcryptjs.hash(password, 12);

  if (driver.userId) {
    // 既存アカウント: パスワード更新（＋ID変更）
    if (loginId) {
      const dup = await prisma.user.findUnique({ where: { email: loginId }, select: { id: true } });
      if (dup && dup.id !== driver.userId) {
        return NextResponse.json({ error: "そのログインIDは既に使われています" }, { status: 409 });
      }
    }
    await prisma.user.update({
      where: { id: driver.userId },
      data: { passwordHash, ...(loginId ? { email: loginId } : {}) },
    });
  } else {
    // アカウント新規作成（loginId 必須）
    if (!loginId) {
      return NextResponse.json({ error: "新規作成にはログインIDが必要です" }, { status: 400 });
    }
    const dup = await prisma.user.findUnique({ where: { email: loginId }, select: { id: true } });
    if (dup) return NextResponse.json({ error: "そのログインIDは既に使われています" }, { status: 409 });
    const user = await prisma.user.create({
      data: { email: loginId, passwordHash, role: "DRIVER" },
    });
    await prisma.driver.update({ where: { id }, data: { userId: user.id } });
  }

  // 監査ログ（パスワードの値は残さない）
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DRIVER_CREDENTIALS_SET",
      targetType: "drivers",
      targetId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
