import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const images = await prisma.dispatchImage.findMany({
    where: { deliveryDate: { gte: today, lt: tomorrow } },
  });
  const imageIds = images.map((i) => i.id);

  const [deliveryItems, activeDriverCount] = await Promise.all([
    prisma.deliveryItem.findMany({
      where: { dispatchImageId: { in: imageIds } },
      select: {
        deliveryStatus: true,
        ocrNotes: true,
        assignments: { select: { id: true } },
      },
    }),
    prisma.shift.count({
      where: { workDate: { gte: today, lt: tomorrow }, status: { not: "ABSENT" } },
    }),
  ]);

  const ocrPending = images.filter((i) =>
    ["PENDING", "PROCESSING", "REVIEW_REQUIRED", "ERROR"].includes(i.ocrStatus)
  ).length;

  const countMismatch = deliveryItems.filter((i) => {
    try { return (JSON.parse(i.ocrNotes ?? "[]") as string[]).includes("COUNT_MISMATCH"); }
    catch { return false; }
  }).length;

  return {
    date: today.toLocaleDateString("ja-JP"),
    dispatchImageCount: images.length,
    ocrPending,
    addressError: deliveryItems.filter((i) => i.deliveryStatus === "ADDRESS_ERROR").length,
    countMismatch,
    unassigned: deliveryItems.filter((i) => i.assignments.length === 0).length,
    activeDriverCount,
    assigned: deliveryItems.filter((i) => i.deliveryStatus === "ASSIGNED").length,
    completed: deliveryItems.filter((i) => i.deliveryStatus === "COMPLETED").length,
    absent: deliveryItems.filter((i) => i.deliveryStatus === "ABSENT").length,
    returned: deliveryItems.filter((i) => i.deliveryStatus === "RETURNED").length,
    skipped: deliveryItems.filter((i) => i.deliveryStatus === "SKIPPED").length,
    inProgress: deliveryItems.filter((i) =>
      ["ASSIGNED", "IN_DELIVERY"].includes(i.deliveryStatus)
    ).length,
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const cards = [
    { label: "取込済み配車表", value: stats.dispatchImageCount, color: "" },
    { label: "OCR未確認", value: stats.ocrPending, color: stats.ocrPending > 0 ? "text-orange-600" : "" },
    { label: "住所エラー", value: stats.addressError, color: stats.addressError > 0 ? "text-red-600" : "" },
    { label: "数量エラー", value: stats.countMismatch, color: stats.countMismatch > 0 ? "text-orange-600" : "" },
    { label: "未割当", value: stats.unassigned, color: stats.unassigned > 0 ? "text-orange-600" : "" },
    { label: "稼働予定ドライバー", value: stats.activeDriverCount, color: "" },
    { label: "割当済み", value: stats.assigned, color: "" },
    { label: "配送完了", value: stats.completed, color: "text-green-700" },
    { label: "不在", value: stats.absent, color: stats.absent > 0 ? "text-orange-600" : "" },
    { label: "持戻り", value: stats.returned, color: stats.returned > 0 ? "text-red-600" : "" },
    { label: "スキップ", value: stats.skipped, color: "" },
    { label: "未完了", value: stats.inProgress, color: stats.inProgress > 0 ? "text-blue-700" : "" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.date} の配送状況</p>
        </div>
        <Link
          href="/admin/progress"
          className="text-sm px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          詳細進捗を見る →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color || "text-gray-900"}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
