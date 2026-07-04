import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import bcryptjs from "bcryptjs";

/**
 * テスト用ドライバーアカウント＋本日のサンプル配送を作成する（冪等）。
 * 実行方法: 管理者でログインした状態でこのURLを開く。
 * 本番でクルー画面を試すための一時セットアップ。用済み後は削除してよい。
 *
 * セキュリティ: 以前あった ?token= による未ログインバイパスは削除済み
 * （ソースにトークンが載る＝遠隔悪用可能な認証バイパスだったため）。
 * 実行は常に ADMIN セッションを必須とする。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "管理者でログインしてください" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "管理者のみ実行できます" }, { status: 403 });

  // クリーンアップ：テストドライバー(TEST-001)の配送データのみ削除（実データは対象外）
  const action = req.nextUrl.searchParams.get("action");
  if (action === "cleanup") {
    const driver = await prisma.driver.findUnique({ where: { carioDriverId: "TEST-001" } });
    if (!driver) return NextResponse.json({ ok: true, message: "テストドライバーが存在しません（削除対象なし）" });
    const asg = await prisma.assignment.findMany({ where: { driverId: driver.id }, select: { deliveryItemId: true } });
    const itemIds = asg.map((a) => a.deliveryItemId);
    const items = await prisma.deliveryItem.findMany({ where: { id: { in: itemIds } }, select: { dispatchImageId: true } });
    const imageIds = [...new Set(items.map((i) => i.dispatchImageId))];
    await prisma.deliveryFollow.deleteMany({ where: { OR: [{ driverId: driver.id }, { deliveryItemId: { in: itemIds } }] } });
    await prisma.assignment.deleteMany({ where: { driverId: driver.id } });
    await prisma.deliveryItem.deleteMany({ where: { id: { in: itemIds } } });
    let deletedImages = 0;
    for (const imgId of imageIds) {
      const remain = await prisma.deliveryItem.count({ where: { dispatchImageId: imgId } });
      if (remain === 0) { await prisma.dispatchImage.delete({ where: { id: imgId } }); deletedImages++; }
    }
    await prisma.driverDayReport.deleteMany({ where: { driverId: driver.id } });
    return NextResponse.json({
      ok: true,
      message: "テストドライバーの配送データを削除しました",
      deletedAssignments: itemIds.length,
      deletedItems: itemIds.length,
      deletedImages,
    });
  }

  const email = "test-driver@delivery-app.local";
  const password = "driver1234";
  const passwordHash = await bcryptjs.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "DRIVER" },
    create: { email, passwordHash, role: "DRIVER" },
  });

  const driver = await prisma.driver.upsert({
    where: { carioDriverId: "TEST-001" },
    update: { userId: user.id, name: "テスト ドライバー", vehicleId: "3", companyName: "テスト運輸", area: "テスト" },
    create: { userId: user.id, carioDriverId: "TEST-001", name: "テスト ドライバー", vehicleId: "3", companyName: "テスト運輸", area: "テスト" },
  });

  // 本日のサンプル配送（既に作成済みならスキップ）
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const existing = await prisma.dispatchImage.findFirst({
    where: { area: "TESTSEED", deliveryDate: { gte: today, lt: tomorrow } },
    select: { id: true },
  });

  let sampleCreated = 0;
  if (!existing) {
    const img = await prisma.dispatchImage.create({
      data: { deliveryDate: today, area: "TESTSEED", waveNo: "W1", imageUrl: "", ocrStatus: "CONFIRMED", ocrProvider: "seed" },
    });
    const samples = [
      { wave: "W1", seq: 1, addr: "埼玉県さいたま市南区別所7-1-1 コーポ美女木201", conf: "ADMIN_APPROVED", lat: 35.86, lng: 139.65, normal: 3, cooler: 1, total: 4 },
      { wave: "W1", seq: 2, addr: "東京都板橋区高島平3-12-8", conf: "ESTIMATED", lat: 35.79, lng: 139.66, normal: 2, cooler: 2, total: 5 },
      { wave: "W2", seq: 1, addr: "埼玉県戸田市美女木2-8-5", conf: "ESTIMATED", lat: 35.83, lng: 139.63, normal: 4, cooler: 0, total: 6 },
    ];
    let order = 1;
    for (const s of samples) {
      const item = await prisma.deliveryItem.create({
        data: {
          dispatchImageId: img.id, dispatchKey: `3-${s.seq}`, waveNo: s.wave, vehicleNo: "3", deliverySeq: s.seq,
          address: s.addr, normalOriconCount: s.normal, coolerBoxCount: s.cooler, caseCount: 0, totalCount: s.total,
          lat: s.lat, lng: s.lng, ocrStatus: "CONFIRMED", deliveryStatus: "ASSIGNED", coordinateStatus: s.conf,
        },
      });
      await prisma.assignment.create({
        data: { deliveryItemId: item.id, driverId: driver.id, routeOrder: order, waveNo: s.wave, status: "ASSIGNED" },
      });
      order++; sampleCreated++;
    }
  }

  return NextResponse.json({
    ok: true,
    message: "テストドライバーを作成しました。ログアウトして下記でログインしてください。",
    login: { url: "/login", email, password },
    driver: { name: driver.name, vehicle: `${driver.vehicleId}号車` },
    sampleDeliveriesCreated: sampleCreated,
  });
}
