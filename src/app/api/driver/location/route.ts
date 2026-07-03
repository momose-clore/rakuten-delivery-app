import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/**
 * ドライバー現在地の受信（GPS リアルタイム表示用）
 * - ブラウザ標準 Geolocation で取得した座標を保存（Google 有料APIは不使用・課金なし）
 * - 1ドライバー1行を upsert（現在地のみ・履歴は持たない）
 * - 位置情報（緯度経度）は個人情報のため console.log しない
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const b = body as {
    lat?: unknown;
    lng?: unknown;
    accuracy?: unknown;
    heading?: unknown;
    speed?: unknown;
    recordedAt?: unknown;
  };

  const lat = Number(b.lat);
  const lng = Number(b.lng);
  // 緯度経度の妥当性チェック（範囲外・NaN は拒否）
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "緯度が不正です" }, { status: 400 });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "経度が不正です" }, { status: 400 });
  }

  const toFiniteOrNull = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const recordedAt =
    typeof b.recordedAt === "string" || typeof b.recordedAt === "number"
      ? new Date(b.recordedAt)
      : new Date();
  const recordedAtSafe = Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt;

  const data = {
    lat,
    lng,
    accuracy: toFiniteOrNull(b.accuracy),
    heading: toFiniteOrNull(b.heading),
    speed: toFiniteOrNull(b.speed),
    recordedAt: recordedAtSafe,
  };

  await prisma.driverLocation.upsert({
    where: { driverId },
    create: { driverId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
