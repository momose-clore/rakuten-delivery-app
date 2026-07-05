import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isExternalRequestAuthorized } from "@/lib/external/auth";

/**
 * CARIO が当アプリから「クルーの運行報告」を pull するためのエンドポイント（読み取り専用）。
 * CARIO は取得した内容を CARIO本体専用の公式LINE に投稿する（当アプリはLINEに一切触らない）。
 *
 * 認証: Authorization: Bearer <EXTRA_VEHICLE_PULL_TOKEN>（インバウンド用・既存と共通）。
 * 返す内容（ドライバー×当日）:
 *   - warehouseArrivalAt … 倉庫到着/着車（朝一到着）
 *   - waves[] … 各wave(W1〜W6)の 件数/完了数/全件完了時刻(waveDoneAt)/エリア
 *               → CARIO が「NW終了 HH:MM」を投稿する材料
 *   - finishedAt … 業務終了（全体終了 = 6W完了 等）
 * ※個人情報（住所/氏名の詳細）はログに出さない。返却は報告に必要な最小限。
 */
export const dynamic = "force-dynamic";

const TERMINAL = new Set(["COMPLETED", "ABSENT", "RETURNED", "SKIPPED"]);

/** 住所から市区町村（○区/○市/○町/○村）を抽出 */
function cityOf(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/([^\s\d]{1,6}?[区市町村])/);
  return m ? m[1] : null;
}

export async function GET(req: NextRequest) {
  if (!isExternalRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dateStr = req.nextUrl.searchParams.get("date");
  const day = dateStr ? new Date(dateStr) : new Date();
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);

  // 当日の配送（明細＋担当ドライバー）
  const assignments = await prisma.assignment.findMany({
    where: { deliveryItem: { dispatchImage: { deliveryDate: { gte: day, lt: next } } } },
    select: {
      driverId: true,
      waveNo: true,
      driver: { select: { name: true, vehicleId: true } },
      deliveryItem: { select: { waveNo: true, deliveryStatus: true, address: true, updatedAt: true } },
    },
  });

  // 当日の日次報告（倉庫到着・業務終了）
  const reports = await prisma.driverDayReport.findMany({
    where: { workDate: { gte: day, lt: next } },
    select: { driverId: true, warehouseArrivalAt: true, finishedReportedAt: true },
  });
  const reportMap = new Map(reports.map((r) => [r.driverId, r]));

  // ドライバー×wave で集計
  type WaveAgg = { total: number; completed: number; remaining: number; lastAt: Date | null; cities: Map<string, number> };
  type DriverAgg = { name: string; vehicleNo: string | null; waves: Map<string, WaveAgg> };
  const drivers = new Map<string, DriverAgg>();

  for (const a of assignments) {
    const wave = (a.deliveryItem.waveNo ?? a.waveNo ?? "").toUpperCase();
    if (!wave) continue;
    let d = drivers.get(a.driverId);
    if (!d) {
      d = { name: a.driver?.name ?? "", vehicleNo: a.driver?.vehicleId ?? null, waves: new Map() };
      drivers.set(a.driverId, d);
    }
    let w = d.waves.get(wave);
    if (!w) {
      w = { total: 0, completed: 0, remaining: 0, lastAt: null, cities: new Map() };
      d.waves.set(wave, w);
    }
    w.total++;
    const st = a.deliveryItem.deliveryStatus;
    if (st === "COMPLETED") w.completed++;
    if (!TERMINAL.has(st)) w.remaining++;
    const at = a.deliveryItem.updatedAt;
    if (at && (!w.lastAt || at > w.lastAt)) w.lastAt = at;
    const city = cityOf(a.deliveryItem.address);
    if (city) w.cities.set(city, (w.cities.get(city) ?? 0) + 1);
  }

  const result = [...drivers.entries()].map(([driverId, d]) => {
    const rep = reportMap.get(driverId);
    const waves = [...d.waves.entries()]
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([waveNo, w]) => {
        const topCity = [...w.cities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const allDone = w.remaining === 0 && w.total > 0;
        return {
          waveNo,
          area: topCity,
          total: w.total,
          completed: w.completed,
          allDone,
          waveDoneAt: allDone ? w.lastAt : null,
        };
      });
    return {
      driverId,
      driverName: d.name,
      vehicleNo: d.vehicleNo,
      warehouseArrivalAt: rep?.warehouseArrivalAt ?? null,
      finishedAt: rep?.finishedReportedAt ?? null,
      waves,
    };
  });

  return NextResponse.json({
    date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
    drivers: result,
  });
}
