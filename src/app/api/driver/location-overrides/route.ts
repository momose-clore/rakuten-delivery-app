import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/address/address-normalizer";

/** ドライバーが修正ピン候補を申請する（PENDING として登録） */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報がありません" }, { status: 403 });

  const body = await req.json();
  const { deliveryItemId, address, lat, lng, entranceMemo, buildingMemo, nameplateMemo, parkingMemo, cautionMemo } = body;

  if (!deliveryItemId || !address) {
    return NextResponse.json({ error: "deliveryItemId と address は必須です" }, { status: 400 });
  }

  // 自分の担当配送先かチェック
  const assignment = await prisma.assignment.findFirst({
    where: { deliveryItemId, driverId },
  });
  if (!assignment) return NextResponse.json({ error: "この配送先への登録権限がありません" }, { status: 403 });

  const parts = normalizeAddress(address);

  const override = await prisma.deliveryLocationOverride.create({
    data: {
      normalizedAddress: parts.lookupKey,
      postalCode: parts.postalCode,
      prefecture: parts.prefecture,
      city: parts.city,
      lat: lat ?? null, lng: lng ?? null,
      entranceMemo: entranceMemo ?? null,
      buildingMemo: buildingMemo ?? null,
      nameplateMemo: nameplateMemo ?? null,
      parkingMemo: parkingMemo ?? null,
      cautionMemo: cautionMemo ?? null,
      source: "DRIVER",
      status: "pending",
      createdBy: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DRIVER_LOCATION_MEMO_SUBMITTED",
      targetType: "delivery_location_overrides",
      targetId: override.id,
      afterData: { status: "pending", source: "DRIVER" },
    },
  });

  return NextResponse.json({ override, message: "申請しました。管理者が確認後に反映されます。" }, { status: 201 });
}
