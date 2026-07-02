/**
 * ドライバーメモ表示範囲制御（N+1対策済み）
 *
 * 表示ルール:
 * - DRIVER_SUBMITTED（申請中）: 申請者本人 + 管理者のみ
 * - ADMIN_APPROVED（承認済み）: 同一住所の全ドライバー + 管理者
 */
import { prisma } from "@/lib/prisma";
import { buildLookupKey } from "@/lib/address/address-normalizer";

export interface AccessibleMemo {
  id:             string;
  normalizedAddress: string;
  status:         string;
  lat:            number | null;
  lng:            number | null;
  entranceMemo:   string | null;
  buildingMemo:   string | null;
  nameplateMemo:  string | null;
  accessMemo:     string | null;
  cautionMemo:    string | null;
  parkingMemo:    string | null;
  matchConfidence: string | null;
}

/**
 * ドライバーがアクセス可能なメモを一括取得（N+1なし）
 * 本人申請中 + 承認済みの全住所メモを1クエリで取得
 */
export async function getAccessibleMemosForDriver(
  viewerDriverUserId: string,
  addresses: string[]
): Promise<Map<string, AccessibleMemo>> {
  const lookupKeys = [...new Set(addresses.map(buildLookupKey))].filter(Boolean);
  if (lookupKeys.length === 0) return new Map();

  const memos = await prisma.deliveryLocationOverride.findMany({
    where: {
      normalizedAddress: { in: lookupKeys },
      OR: [
        // 承認済みは全ドライバーに表示
        { status: "approved" },
        // 申請中は本人のみ（createdBy は userId）
        { status: "pending", createdBy: viewerDriverUserId },
      ],
    },
    select: {
      id:               true,
      normalizedAddress: true,
      status:           true,
      lat:              true,
      lng:              true,
      entranceMemo:     true,
      buildingMemo:     true,
      nameplateMemo:    true,
      accessMemo:       true,
      cautionMemo:      true,
      parkingMemo:      true,
      matchConfidence:  true,
    },
    orderBy: [{ status: "asc" }, { usageCount: "desc" }],
  });

  // 住所 → 最優先メモのマップを構築（approved > pending）
  const result = new Map<string, AccessibleMemo>();
  for (const memo of memos) {
    const existing = result.get(memo.normalizedAddress);
    // approved は pending より優先
    if (!existing || (existing.status !== "approved" && memo.status === "approved")) {
      result.set(memo.normalizedAddress, memo);
    }
  }

  return result;
}
