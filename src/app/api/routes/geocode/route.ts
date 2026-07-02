import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/maps/geocode";
import { shouldBlockCoordinateOverwrite } from "@/lib/prediction/overwrite-guard";
import { buildGeocodeCoordinateMeta } from "@/lib/prediction/metadata";
import { recordPredictionAudit, PREDICTION_AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date, waveNo, driverId } = await req.json() as {
    date?: string; waveNo?: string; driverId?: string;
  };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付を指定してください" }, { status: 400 });
  }

  const deliveryDate = new Date(date);

  // lat/lng が未取得の delivery_items を取得（座標ステータスも取得）
  const items = await prisma.deliveryItem.findMany({
    where: {
      lat: null,
      address: { not: null },
      dispatchImage: {
        deliveryDate,
        ocrStatus: "CONFIRMED",
        ...(waveNo && { waveNo }),
      },
      ...(driverId && { assignments: { some: { driverId } } }),
    },
    select: {
      id: true,
      address: true,
      coordinateStatus: true,
    },
  });

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    if (!item.address) continue;

    // 上書き保護チェック（ADMIN_APPROVED / MANUAL_FIXED は Geocode で上書きしない）
    const guard = shouldBlockCoordinateOverwrite(item.coordinateStatus);
    if (guard.blocked) {
      skippedCount++;
      await recordPredictionAudit({
        actorUserId: session.user.id,
        action: PREDICTION_AUDIT_ACTIONS.AUTO_OVERWRITE_BLOCKED,
        targetType: "delivery_items",
        targetId: item.id,
        source: "GOOGLE_GEOCODE",
        status: guard.existingStatus ?? undefined,
        reason: guard.reason ?? "上書き保護のためスキップ",
        meta: { coordinateStatus: guard.existingStatus },
      });
      continue;
    }

    const result = await geocodeAddress(item.address);

    if (result) {
      const meta = buildGeocodeCoordinateMeta();
      await prisma.deliveryItem.update({
        where: { id: item.id },
        data: {
          lat: result.lat,
          lng: result.lng,
          coordinateSource:     meta.coordinateSource,
          coordinateStatus:     meta.coordinateStatus,
          coordinateConfidence: meta.coordinateConfidence,
        },
      });
      successCount++;
    } else {
      await prisma.deliveryItem.update({
        where: { id: item.id },
        data: { deliveryStatus: "ADDRESS_ERROR" },
      });
      failCount++;
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "GEOCODE_ADDRESSES",
      targetType: "delivery_items",
      targetId: date,
      afterData: {
        successCount,
        failCount,
        skippedCount,
        total: items.length,
        coordinateSource: "GOOGLE_GEOCODE",
        coordinateStatus: "ESTIMATED",
      },
    },
  });

  return NextResponse.json({
    success: true,
    successCount,
    failCount,
    skippedCount,
    total: items.length,
  });
}
