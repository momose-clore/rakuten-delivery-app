import type { AssignedItem, AvailableDriver } from "@/types/assignment";

/**
 * 半自動割当ロジック。
 * vehicleNo 単位でまとまりを保ちつつ、ドライバーへ均等分配する。
 * DB 保存は行わず Map を返す（呼び出し側で保存する）。
 */
export function autoAssign(
  items: AssignedItem[],
  drivers: AvailableDriver[],
  filterArea?: string
): Map<string, string> {
  // 稼働可能ドライバーのみ（ABSENT 除外・車両あり）
  const eligible = drivers.filter(
    (d) => d.shiftStatus !== "ABSENT" && d.vehicleId
  );
  if (eligible.length === 0) return new Map();

  // エリア一致ドライバーを先頭に並べ替え
  const sorted = filterArea
    ? [
        ...eligible.filter((d) => d.area === filterArea),
        ...eligible.filter((d) => d.area !== filterArea),
      ]
    : eligible;

  // vehicleNo でグループ化（null は個別扱い）
  const groups = new Map<string, AssignedItem[]>();
  for (const item of items) {
    const key = item.vehicleNo ?? `__null_${item.deliveryItemId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const groupKeys = [...groups.keys()];
  const result = new Map<string, string>(); // deliveryItemId → driverId

  // グループをドライバー数で均等に round-robin 割当
  groupKeys.forEach((key, idx) => {
    const driver = sorted[idx % sorted.length];
    for (const item of groups.get(key)!) {
      result.set(item.deliveryItemId, driver.driverId);
    }
  });

  return result;
}
