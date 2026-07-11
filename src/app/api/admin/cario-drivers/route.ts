import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { fetchAssignmentsForRange } from "@/lib/cario/getAssignments";

// GET: CARIO側ドライバー一覧（新規ドライバー登録の紐付け候補）。
//   直近レンジのCARIO割当からドライバーを導出（γのfetchAssignmentsForRangeを read-only 再利用）。
//   既に自アプリDBに紐付け済みかを alreadyRegistered で示す。
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD（省略時は当月前後の広めレンジ）
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? defaultFrom();
  const to = sp.get("to") ?? defaultTo();

  let drivers;
  try {
    ({ drivers } = await fetchAssignmentsForRange(from, to));
  } catch {
    // CARIO接続失敗時も画面は壊さない（空一覧＋メッセージ）
    return NextResponse.json(
      { drivers: [], error: "CARIOからドライバー一覧を取得できませんでした" },
      { status: 200 }
    );
  }

  // 導出ドライバーを carioDriverId で重複排除
  const byId = new Map<string, (typeof drivers)[number]>();
  for (const d of drivers) {
    if (d.carioDriverId && !byId.has(d.carioDriverId)) byId.set(d.carioDriverId, d);
  }
  const ids = [...byId.keys()];

  // 既に紐付け済みの carioDriverId を判定
  const registered = await prisma.driver.findMany({
    where: { carioDriverId: { in: ids } },
    select: { carioDriverId: true, name: true },
  });
  const registeredMap = new Map(registered.map((r) => [r.carioDriverId!, r.name]));

  const list = [...byId.values()].map((d) => ({
    carioDriverId: d.carioDriverId,
    name: d.name,
    vehicleId: d.vehicleId ?? null,
    area: d.area ?? null,
    alreadyRegistered: registeredMap.has(d.carioDriverId!),
    registeredAs: registeredMap.get(d.carioDriverId!) ?? null,
  }));
  list.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return NextResponse.json({ drivers: list, range: { from, to } });
}

// 既定レンジ：当月1日〜翌月末（広めに取り、当月稼働ドライバーを網羅）
function defaultFrom(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function defaultTo(): string {
  const d = new Date();
  const nextMonthEnd = new Date(d.getFullYear(), d.getMonth() + 2, 0);
  return `${nextMonthEnd.getFullYear()}-${String(nextMonthEnd.getMonth() + 1).padStart(2, "0")}-${String(nextMonthEnd.getDate()).padStart(2, "0")}`;
}
