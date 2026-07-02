/**
 * location override マッチャー
 * 同一住所の既存 override を検索して自動適用する
 */
import { prisma } from "@/lib/prisma";
import { buildLookupKey } from "./address-normalizer";
import type { OverrideInfo } from "@/types/location";
import { buildApprovedOverrideCoordinateMeta } from "@/lib/prediction/metadata";

/** 住所に対応する承認済みオーバーライドを検索 */
export async function findApprovedOverride(address: string): Promise<OverrideInfo | null> {
  if (!address) return null;

  const key = buildLookupKey(address);

  // normalizedAddress での完全一致を優先
  const exact = await prisma.deliveryLocationOverride.findFirst({
    where: { normalizedAddress: key, status: "approved" },
    orderBy: { usageCount: "desc" },
  });

  if (exact) {
    const meta = buildApprovedOverrideCoordinateMeta();
    await prisma.deliveryLocationOverride.update({
      where: { id: exact.id },
      data: {
        usageCount: { increment: 1 },
        matchConfidence: "high",
        appliedFrom: meta.coordinateSource,
      },
    });
    return mapToOverrideInfo(exact);
  }

  return null;
}

/** 住所に関連する override（承認待ち含む）を検索 */
export async function findAllOverridesForAddress(address: string) {
  if (!address) return [];
  const key = buildLookupKey(address);
  return prisma.deliveryLocationOverride.findMany({
    where: { normalizedAddress: key },
    orderBy: [{ status: "asc" }, { usageCount: "desc" }],
  });
}

function mapToOverrideInfo(o: {
  id: string; status: string; lat: number | null; lng: number | null;
  entranceMemo: string | null; buildingMemo: string | null; nameplateMemo: string | null;
  accessMemo: string | null; cautionMemo: string | null; parkingMemo: string | null;
}): OverrideInfo {
  return {
    id: o.id,
    status: o.status as "pending" | "approved" | "rejected",
    lat: o.lat, lng: o.lng,
    entranceMemo: o.entranceMemo,
    buildingMemo: o.buildingMemo,
    nameplateMemo: o.nameplateMemo,
    accessMemo: o.accessMemo,
    cautionMemo: o.cautionMemo,
    parkingMemo: o.parkingMemo,
  };
}
