import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { buildMapsUrls } from "@/lib/maps/url";
import { buildLookupKey } from "@/lib/address/address-normalizer";
import { buildBestNavigationUrl } from "@/lib/maps/navigation";
import { buildApprovedOverrideCoordinateMeta } from "@/lib/prediction/metadata";
import type { CoordinateBadgeType } from "@/types/prediction";
import type { OverrideInfo } from "@/types/location";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const assignments = await prisma.assignment.findMany({
    where: {
      driverId,
      status: "ASSIGNED",
      deliveryItem: {
        dispatchImage: {
          deliveryDate: { gte: today, lt: tomorrow },
          ocrStatus: "CONFIRMED",
        },
      },
    },
    include: {
      deliveryItem: {
        select: {
          id: true,
          dispatchKey: true,
          waveNo: true,
          vehicleNo: true,
          address: true,
          normalOriconCount: true,
          coolerBoxCount: true,
          caseCount: true,
          totalCount: true,
          memo: true,
          lat: true,
          lng: true,
          deliveryStatus: true,
          coordinateSource: true,
          coordinateStatus: true,
          coordinateConfidence: true,
        },
      },
    },
    orderBy: { routeOrder: "asc" },
  });

  // N+1防止: 全アドレスの lookup key を一括収集してから override を一括クエリ
  const addresses = assignments
    .map((a) => a.deliveryItem.address)
    .filter((addr): addr is string => !!addr);

  const lookupKeys = [...new Set(addresses.map(buildLookupKey))];

  const overrides = lookupKeys.length > 0
    ? await prisma.deliveryLocationOverride.findMany({
        where: {
          normalizedAddress: { in: lookupKeys },
          status: "approved",
        },
        orderBy: { usageCount: "desc" },
      })
    : [];

  // 住所 → override のマップを構築（1住所につき最も使用回数が多いものを使用）
  const overrideMap = new Map<string, OverrideInfo>();
  for (const ov of overrides) {
    if (!overrideMap.has(ov.normalizedAddress)) {
      overrideMap.set(ov.normalizedAddress, {
        id: ov.id,
        status: ov.status as "approved",
        lat: ov.lat, lng: ov.lng,
        entranceMemo:  ov.entranceMemo,
        buildingMemo:  ov.buildingMemo,
        nameplateMemo: ov.nameplateMemo,
        accessMemo:    ov.accessMemo,
        cautionMemo:   ov.cautionMemo,
        parkingMemo:   ov.parkingMemo,
        matchConfidence: "high",
      });
    }
  }

  // usageCount 一括更新（使用したoverride IDを収集）
  const usedOverrideIds = [...new Set(
    assignments
      .map((a) => {
        if (!a.deliveryItem.address) return null;
        const key = buildLookupKey(a.deliveryItem.address);
        return overrideMap.get(key)?.id ?? null;
      })
      .filter((id): id is string => !!id)
  )];

  if (usedOverrideIds.length > 0) {
    await prisma.deliveryLocationOverride.updateMany({
      where: { id: { in: usedOverrideIds } },
      data: {
        usageCount: { increment: 1 },
        appliedFrom: buildApprovedOverrideCoordinateMeta().coordinateSource,
      },
    });
  }

  // 個人情報はログに出さない（address 等を console.log しない）
  const items = assignments.map((a) => {
    const di = a.deliveryItem;
    const lookupKey = di.address ? buildLookupKey(di.address) : null;
    const override = lookupKey ? overrideMap.get(lookupKey) ?? null : null;

    const bestNavUrl = buildBestNavigationUrl({
      address: di.address,
      lat: di.lat,
      lng: di.lng,
      override,
    });

    // 座標バッジ種別を判定
    let coordinateBadge: CoordinateBadgeType = "none";
    if (override?.status === "approved") {
      coordinateBadge = "approved";
    } else if (!di.lat || !di.lng) {
      coordinateBadge = "missing";
    } else if (di.coordinateStatus === "ESTIMATED" || di.coordinateStatus === null) {
      coordinateBadge = "estimated";
    }

    // 住所文字列フォールバックURL（座標が推定の場合も表示）
    const addressNavUrl = di.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(di.address)}&travelmode=driving&dir_action=navigate`
      : null;

    return {
      assignmentId: a.id,
      routeOrder: a.routeOrder,
      waveNo: di.waveNo,
      deliveryItemId: di.id,
      dispatchKey: di.dispatchKey,
      vehicleNo: di.vehicleNo,
      address: di.address,
      normalOriconCount: di.normalOriconCount,
      coolerBoxCount: di.coolerBoxCount,
      caseCount: di.caseCount,
      totalCount: di.totalCount,
      memo: di.memo,
      lat: override?.lat ?? di.lat,
      lng: override?.lng ?? di.lng,
      deliveryStatus: di.deliveryStatus,
      hasOverride: !!override,
      entranceMemo:  override?.entranceMemo ?? null,
      buildingMemo:  override?.buildingMemo ?? null,
      nameplateMemo: override?.nameplateMemo ?? null,
      parkingMemo:   override?.parkingMemo ?? null,
      cautionMemo:   override?.cautionMemo ?? null,
      mapsUrl: bestNavUrl,
      addressNavUrl,
      coordinateBadge,
      coordinateStatus:     di.coordinateStatus,
      coordinateConfidence: di.coordinateConfidence,
    };
  });

  const geoItems = items
    .filter((i) => i.routeOrder !== null && i.lat !== null && i.lng !== null)
    .sort((a, b) => (a.routeOrder ?? 0) - (b.routeOrder ?? 0));

  const mapsUrls = geoItems.length > 0
    ? buildMapsUrls(geoItems.map((i) => ({ lat: i.lat!, lng: i.lng! })), true)
    : [];

  return NextResponse.json({ items, mapsUrls });
}
