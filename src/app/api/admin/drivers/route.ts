import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
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

// POST: 新規ドライバー登録（管理者用）。CARIO紐付け(carioDriverId)＋任意でログインID/パスワード。
//   body: { name, carioDriverId?, vehicleId?, companyName?, area?, loginId?, password? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const carioDriverId = str(body.carioDriverId) || null;
  const vehicleId = str(body.vehicleId) || null;
  const companyName = str(body.companyName) || null;
  const area = str(body.area) || null;
  const loginId = str(body.loginId);
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) return NextResponse.json({ error: "氏名は必須です" }, { status: 400 });
  if (loginId && password.length < 4) {
    return NextResponse.json({ error: "パスワードは4文字以上で入力してください" }, { status: 400 });
  }
  if (password && !loginId) {
    return NextResponse.json({ error: "パスワードを設定するにはログインIDが必要です" }, { status: 400 });
  }

  // CARIO紐付けの重複チェック（unique）
  if (carioDriverId) {
    const dup = await prisma.driver.findUnique({
      where: { carioDriverId },
      select: { id: true, name: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: `このCARIOドライバーは既に「${dup.name}」に紐付け済みです` },
        { status: 409 }
      );
    }
  }

  // ログインID重複チェック
  if (loginId) {
    const dupUser = await prisma.user.findUnique({ where: { email: loginId }, select: { id: true } });
    if (dupUser) return NextResponse.json({ error: "そのログインIDは既に使われています" }, { status: 409 });
  }

  // ログインを付ける場合は User を先に作成して紐付け
  let userId: string | undefined;
  if (loginId && password) {
    const passwordHash = await bcryptjs.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: loginId, passwordHash, role: "DRIVER" },
    });
    userId = user.id;
  }

  const driver = await prisma.driver.create({
    data: { name, carioDriverId, vehicleId, companyName, area, userId },
    select: { id: true },
  });

  // 監査ログ（氏名・PIIの値は残さない）
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DRIVER_CREATED",
      targetType: "drivers",
      targetId: driver.id,
    },
  });

  return NextResponse.json({ ok: true, driverId: driver.id });
}
