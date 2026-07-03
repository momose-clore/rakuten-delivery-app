/**
 * CARIO 号車 ↔ 配送明細(OCR) 号車 のマッチング提案（read-only）。
 *
 * CARIO の稼働ドライバー（driver.vehicleId = 号車）と、
 * 当日の配送明細（DeliveryItem.vehicleNo = OCR由来の号車）を突き合わせ、
 * 「どのドライバーがどの号車の明細を担当すべきか」の候補を提示する。
 *
 * ⚠️ 提案のみ。実際の割当（Assignment作成・autoAssign）には一切書き込まない。
 *    配車ロジック側（α/β）が本結果を参照して割当できるようにするための材料。
 */
import { prisma } from "@/lib/prisma";

export interface VehicleMatchProposal {
  date: string;
  matches: Array<{
    vehicleNo: string;
    itemCount: number;
    driverId: string;
    driverName: string;
    carioDriverId: string | null;
  }>;
  /** 明細はあるが担当ドライバー（同号車）が見つからない号車 */
  vehiclesWithoutDriver: Array<{ vehicleNo: string; itemCount: number }>;
  /** 稼働予定だが担当する号車の明細が無いドライバー */
  driversWithoutItems: Array<{ driverId: string; driverName: string; vehicleNo: string | null }>;
}

export async function proposeVehicleMatches(date: string): Promise<VehicleMatchProposal> {
  const deliveryDate = new Date(date);

  // 当日 CARIO 稼働ドライバー（号車付き）
  const shifts = await prisma.shift.findMany({
    where: { workDate: deliveryDate, status: { in: ["CONFIRMED", "TENTATIVE"] } },
    select: { driver: { select: { id: true, name: true, vehicleId: true, carioDriverId: true } } },
  });

  // 当日の配送明細を号車ごとに集計（dispatchImage.deliveryDate 経由）
  const images = await prisma.dispatchImage.findMany({
    where: { deliveryDate },
    select: { id: true },
  });
  const items = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: { in: images.map((i) => i.id) } },
    select: { vehicleNo: true },
  });

  const itemCountByVehicle = new Map<string, number>();
  for (const it of items) {
    if (!it.vehicleNo) continue;
    itemCountByVehicle.set(it.vehicleNo, (itemCountByVehicle.get(it.vehicleNo) ?? 0) + 1);
  }

  // 号車 → ドライバー（driver.vehicleId 一致・最初の1名）
  const driverByVehicle = new Map<string, (typeof shifts)[number]["driver"]>();
  for (const s of shifts) {
    const v = s.driver.vehicleId;
    if (v && !driverByVehicle.has(v)) driverByVehicle.set(v, s.driver);
  }

  const matches: VehicleMatchProposal["matches"] = [];
  const vehiclesWithoutDriver: VehicleMatchProposal["vehiclesWithoutDriver"] = [];
  for (const [vehicleNo, itemCount] of itemCountByVehicle) {
    const d = driverByVehicle.get(vehicleNo);
    if (d) {
      matches.push({ vehicleNo, itemCount, driverId: d.id, driverName: d.name, carioDriverId: d.carioDriverId });
    } else {
      vehiclesWithoutDriver.push({ vehicleNo, itemCount });
    }
  }

  const matchedVehicles = new Set(matches.map((m) => m.vehicleNo));
  const driversWithoutItems = shifts
    .filter((s) => !s.driver.vehicleId || !matchedVehicles.has(s.driver.vehicleId))
    .map((s) => ({ driverId: s.driver.id, driverName: s.driver.name, vehicleNo: s.driver.vehicleId }));

  return {
    date,
    matches: matches.sort((a, b) => a.vehicleNo.localeCompare(b.vehicleNo, "ja")),
    vehiclesWithoutDriver: vehiclesWithoutDriver.sort((a, b) => a.vehicleNo.localeCompare(b.vehicleNo, "ja")),
    driversWithoutItems,
  };
}
