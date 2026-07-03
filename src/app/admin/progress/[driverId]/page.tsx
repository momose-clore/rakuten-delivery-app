import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ASSIGNED:      { label: "未完了",     className: "bg-blue-100 text-blue-700" },
  IN_DELIVERY:   { label: "配送中",     className: "bg-blue-100 text-blue-700" },
  COMPLETED:     { label: "完了",       className: "bg-green-100 text-green-700" },
  ABSENT:        { label: "不在",       className: "bg-orange-100 text-orange-700" },
  RETURNED:      { label: "持戻り",     className: "bg-red-100 text-red-700" },
  SKIPPED:       { label: "スキップ",   className: "bg-gray-100 text-gray-500" },
  ADDRESS_ERROR: { label: "住所エラー", className: "bg-red-50 text-red-500" },
};

function statusOf(s: string) {
  return STATUS_CONFIG[s] ?? STATUS_CONFIG.ASSIGNED;
}

export default async function DriverProgressDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ driverId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdmin();

  const { driverId } = await params;
  const { date: dateParam } = await searchParams;

  const targetDate = dateParam ? new Date(dateParam) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const dateStr = targetDate.toISOString().split("T")[0];

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { name: true, companyName: true, area: true, vehicleId: true },
  });
  if (!driver) notFound();

  const assignments = await prisma.assignment.findMany({
    where: {
      driverId,
      deliveryItem: {
        dispatchImage: {
          deliveryDate: { gte: targetDate, lt: nextDate },
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
          address: true,
          totalCount: true,
          deliveryStatus: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { routeOrder: "asc" },
  });

  const total = assignments.length;
  const count = (statuses: string[]) =>
    assignments.filter((a) => statuses.includes(a.deliveryItem.deliveryStatus)).length;
  const completed = count(["COMPLETED"]);
  const absent = count(["ABSENT"]);
  const returned = count(["RETURNED"]);
  const skipped = count(["SKIPPED"]);
  const inProgress = total - completed - absent - returned - skipped;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href={`/admin/progress`}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            ← 配送進捗一覧へ
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{driver.name}</h1>
          <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500 mt-0.5">
            <span>{driver.companyName ?? "—"}</span>
            <span>·</span>
            <span>{driver.area ?? "—"}</span>
            <span>·</span>
            <span>号車 {driver.vehicleId ?? "—"}</span>
          </div>
        </div>
        <form className="shrink-0">
          <label className="block text-xs text-gray-500 mb-1">配送日</label>
          <input
            type="date"
            name="date"
            defaultValue={dateStr}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="ml-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
          >
            表示
          </button>
        </form>
      </div>

      {/* 集計サマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SumCard label="担当件数" value={total} unit="件" />
        <SumCard label="未完了" value={inProgress} unit="件" highlight />
        <SumCard label="完了" value={completed} unit="件" green />
        <SumCard label="不在" value={absent} unit="件" orange />
        <SumCard label="持戻り" value={returned} unit="件" red />
        <SumCard label="スキップ" value={skipped} unit="件" />
      </div>

      {/* 進捗バー */}
      {total > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>進捗</span>
            <span>{completed} / {total} 件完了（{rate}%）</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
            <div className="h-full bg-green-500" style={{ width: `${(completed / total) * 100}%` }} />
            <div className="h-full bg-orange-400" style={{ width: `${(absent / total) * 100}%` }} />
            <div className="h-full bg-red-400" style={{ width: `${(returned / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* 明細テーブル */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500 px-4 py-8 text-center">
            この日の担当配送はありません
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["順", "配車No", "W番号", "住所", "数量", "ステータス", "更新"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assignments.map((a) => {
                const item = a.deliveryItem;
                const sc = statusOf(item.deliveryStatus);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-gray-700">{a.routeOrder ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{item.dispatchKey ?? "—"}</td>
                    <td className="px-3 py-2">{item.waveNo ?? "—"}</td>
                    <td className="px-3 py-2 max-w-[240px] truncate text-gray-700">{item.address ?? "—"}</td>
                    <td className="px-3 py-2">{item.totalCount ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sc.className}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {new Date(item.updatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SumCard({ label, value, unit, highlight, green, orange, red }:
  { label: string; value: number; unit: string; highlight?: boolean; green?: boolean; orange?: boolean; red?: boolean }) {
  const color = green ? "text-green-700" : orange ? "text-orange-600" : red ? "text-red-600" : highlight ? "text-blue-700" : "text-gray-900";
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}<span className="text-sm font-normal ml-1">{unit}</span></p>
    </div>
  );
}
