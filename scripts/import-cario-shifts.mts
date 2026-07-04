/**
 * CARIO assignments → 自アプリDB 取込スクリプト（手動実行・一時利用）
 *
 * 経路B: アプリの取込ロジック（/api/shifts/import）を Prisma 直接で再現。
 * 受信専用: CARIO へは GET のみ。書き込み対象は自アプリDB(drivers/shifts)のみ。
 *
 * データ保護:
 *   - drivers.phone / companyName は「非nullの時のみ」更新（既存値をnullで壊さない）
 *   - name / area / vehicleId は CARIO を正として更新
 *   - shifts は driverId×workDate で upsert（重複登録なし）
 *
 * 使い方:  DRY=1 tsx scripts/import-cario-shifts.mts 2026-07-03 2026-07-04   # 確認のみ
 *          tsx scripts/import-cario-shifts.mts 2026-07-03 2026-07-04          # 実書き込み
 */
import { prisma } from "../src/lib/prisma";
import { fetchAssignmentsForRange } from "../src/lib/cario/getAssignments";

const DRY = process.env.DRY === "1";
const from = process.argv[2];
const to = process.argv[3] ?? from;

function maskPhone(p: string | null): string {
  if (!p) return "-";
  const digits = p.replace(/\D/g, "");
  return digits.length >= 4 ? `***${digits.slice(-4)}` : "***";
}

async function main() {
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new Error("引数: <from YYYY-MM-DD> [to YYYY-MM-DD]");
  }
  console.log(`\n=== CARIO取込 ${DRY ? "[DRY-RUN 確認のみ]" : "[本書き込み]"} range=${from}〜${to} ===`);

  const { drivers, shifts, assignments, warnings, usedMock } =
    await fetchAssignmentsForRange(from, to);

  if (usedMock) throw new Error("MOCKモードです（RAKUTEN_APP_API_KEY 未設定）。中止します。");
  console.log(`受信: assignments=${assignments.length} → drivers=${drivers.length} / shifts=${shifts.length}`);
  if (warnings.length) console.log("warnings:", warnings.join(" / "));

  // ── 既存DB状態の確認 ─────────────────────────────
  const carioIds = drivers.map((d) => d.carioDriverId);
  const existing = await prisma.driver.findMany({
    where: { carioDriverId: { in: carioIds } },
    select: { id: true, carioDriverId: true, name: true, phone: true, companyName: true, area: true, vehicleId: true },
  });
  const existingByCario = new Map(existing.map((e) => [e.carioDriverId!, e]));
  console.log(`\n既存ドライバー(該当carioId): ${existing.length}/${drivers.length} 件`);

  console.log("\n[drivers] 予定操作:");
  for (const d of drivers) {
    const ex = existingByCario.get(d.carioDriverId);
    const op = ex ? "UPDATE" : "CREATE";
    const phoneNote = ex && ex.phone && !d.phone ? "(既存phone保持)" : "";
    console.log(`  ${op} ${d.carioDriverId.slice(0, 8)} ${d.name} / area=${d.area ?? "-"} / 号車=${d.vehicleId ?? "-"} / phone=${maskPhone(d.phone)} ${phoneNote}`);
  }

  // 既存シフト確認
  const workDates = [...new Set(shifts.map((s) => s.workDate))];
  const existingShifts = await prisma.shift.findMany({
    where: {
      workDate: { in: workDates.map((w) => new Date(w)) },
      driver: { carioDriverId: { in: carioIds } },
    },
    select: { id: true, workDate: true, driver: { select: { carioDriverId: true, name: true } } },
  });
  console.log(`\n[shifts] 予定 upsert: ${shifts.length} 件 / うち既存: ${existingShifts.length} 件（重複はupsertで更新）`);

  if (DRY) {
    console.log("\n>> DRY-RUN のため書き込みは行いませんでした。");
    return;
  }

  // ── 書き込み ─────────────────────────────────────
  const driverIdMap: Record<string, string> = {};
  let driverCreated = 0, driverUpdated = 0;
  for (const d of drivers) {
    const ex = existingByCario.get(d.carioDriverId);
    // 防御的更新: phone/companyName は非nullの時だけ上書き。name/area/vehicleId はCARIO正。
    const driver = await prisma.driver.upsert({
      where: { carioDriverId: d.carioDriverId },
      update: {
        name: d.name || ex?.name || "",
        ...(d.phone ? { phone: d.phone } : {}),
        ...(d.companyName ? { companyName: d.companyName } : {}),
        area: d.area ?? ex?.area ?? null,
        vehicleId: d.vehicleId ?? ex?.vehicleId ?? null,
      },
      create: {
        carioDriverId: d.carioDriverId,
        name: d.name,
        phone: d.phone,
        companyName: d.companyName,
        area: d.area,
        vehicleId: d.vehicleId,
      },
    });
    driverIdMap[d.carioDriverId] = driver.id;
    ex ? driverUpdated++ : driverCreated++;
  }

  let shiftUpserted = 0;
  for (const s of shifts) {
    const driverId = driverIdMap[s.carioDriverId];
    if (!driverId) continue;
    const workDate = new Date(s.workDate);
    await prisma.shift.upsert({
      where: { driverId_workDate: { driverId, workDate } },
      update: {
        status: s.status,
        source: "CARIO_API",
        isStale: false,
        sourceStatus: "OK",
        importedAt: new Date(),
      },
      create: {
        driverId,
        workDate,
        startTime: null,
        endTime: null,
        status: s.status,
        source: "CARIO_API",
        isStale: false,
        sourceStatus: "OK",
        importedAt: new Date(),
      },
    });
    shiftUpserted++;
  }

  console.log(`\n>> 完了: drivers created=${driverCreated} updated=${driverUpdated} / shifts upserted=${shiftUpserted}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
