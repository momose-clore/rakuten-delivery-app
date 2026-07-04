import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/address/address-normalizer";

// GET: 指定日の配達伝票(delivery_items)から、Wave別の市区町村エリアを集計。
//   /api/extra-vehicle-requests/wave-areas?date=YYYY-MM-DD
//   → { areasByWave: { "W1": ["足立区","北区"], ... } }
// 申請理由テンプレートのエリア自動差し込みに使う。住所全体は返さず市区町村のみ（個人情報配慮）。
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const items = await prisma.deliveryItem.findMany({
    where: {
      address: { not: null },
      dispatchImage: { deliveryDate: { gte: targetDate, lt: nextDate } },
    },
    select: { waveNo: true, address: true, dispatchImage: { select: { waveNo: true } } },
  });

  // Wave正規化: "W3" / "3" / "w3" → "W3"
  const normWave = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const m = /(\d+)/.exec(raw);
    return m ? `W${Number(m[1])}` : null;
  };

  // Wave → 市区町村の出現回数
  const counts = new Map<string, Map<string, number>>();
  for (const it of items) {
    const wave = normWave(it.waveNo) ?? normWave(it.dispatchImage?.waveNo);
    if (!wave || !it.address) continue;
    const city = normalizeAddress(it.address).city;
    if (!city) continue;
    if (!counts.has(wave)) counts.set(wave, new Map());
    const m = counts.get(wave)!;
    m.set(city, (m.get(city) ?? 0) + 1);
  }

  // 出現回数の多い順に最大4エリア
  const areasByWave: Record<string, string[]> = {};
  for (const [wave, m] of counts) {
    areasByWave[wave] = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([city]) => city);
  }

  return NextResponse.json({ areasByWave });
}
