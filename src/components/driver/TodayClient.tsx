"use client";

import { useEffect, useState, useCallback } from "react";
import { DeliveryCard, type DeliveryCardItem, type DeliveryStatus } from "./DeliveryCard";

interface ApiItem {
  assignmentId: string;
  routeOrder: number | null;
  deliveryItemId: string;
  dispatchKey: string | null;
  waveNo: string | null;
  vehicleNo: string | null;
  address: string | null;
  normalOriconCount: number | null;
  coolerBoxCount: number | null;
  caseCount: number | null;
  totalCount: number | null;
  memo: string | null;
  lat: number | null;
  lng: number | null;
  deliveryStatus: DeliveryStatus;
}

const STATUS_CHIP: { key: DeliveryStatus[]; label: string; color: string }[] = [
  { key: ["ASSIGNED", "IN_DELIVERY"], label: "未完了", color: "bg-blue-100 text-blue-700" },
  { key: ["COMPLETED"],               label: "完了",   color: "bg-green-100 text-green-700" },
  { key: ["ABSENT"],                  label: "不在",   color: "bg-orange-100 text-orange-700" },
  { key: ["RETURNED"],                label: "持戻り", color: "bg-red-100 text-red-700" },
  { key: ["SKIPPED"],                 label: "スキップ", color: "bg-gray-100 text-gray-500" },
];

export function TodayClient() {
  const [items, setItems] = useState<DeliveryCardItem[]>([]);
  const [mapsUrls, setMapsUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchToday = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/driver/today");
    setLoading(false);
    if (!res.ok) {
      setError("配送情報の取得に失敗しました");
      return;
    }
    const body = await res.json();
    const apiItems: ApiItem[] = body.items ?? [];
    const urls: string[] = body.mapsUrls ?? [];

    // 各アイテムに対応する Maps URL を割り当て
    // 複数 URL の場合、ルート順に沿って最初の URL をデフォルトとして使用
    const cardItems: DeliveryCardItem[] = apiItems.map((item, idx) => ({
      ...item,
      mapsUrl: urls[Math.floor(idx / 10)] ?? urls[0] ?? undefined,
    }));

    setItems(cardItems);
    setMapsUrls(urls);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchToday(); }, [fetchToday]);

  async function handleStatusChange(deliveryItemId: string, status: DeliveryStatus) {
    const res = await fetch(`/api/driver/delivery-items/${deliveryItemId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => i.deliveryItemId === deliveryItemId ? { ...i, deliveryStatus: status } : i)
      );
    }
  }

  async function handleMemoSave(deliveryItemId: string, memo: string) {
    const res = await fetch(`/api/driver/delivery-items/${deliveryItemId}/memo`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => i.deliveryItemId === deliveryItemId ? { ...i, memo } : i)
      );
    }
  }

  const today = new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });

  if (loading) return <p className="text-center text-gray-400 py-12">読み込み中...</p>;
  if (error) return <p className="text-center text-red-500 py-12">{error}</p>;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* 日付・件数 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">本日の配送</h1>
        <p className="text-sm text-gray-500">{today}  計 {items.length} 件</p>
      </div>

      {/* 集計チップ */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIP.map(({ key, label, color }) => {
            const count = items.filter((i) => key.includes(i.deliveryStatus)).length;
            if (count === 0) return null;
            return (
              <span key={label} className={`text-xs px-3 py-1 rounded-full font-medium ${color}`}>
                {label} {count}件
              </span>
            );
          })}
        </div>
      )}

      {/* 全ルート Maps URL（複数の場合） */}
      {mapsUrls.length > 1 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">本日のルート（{mapsUrls.length}分割）</p>
          <div className="flex flex-wrap gap-2">
            {mapsUrls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full"
              >
                ルート {idx + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 配送先カード一覧 */}
      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">本日の配送先はまだ割り当てられていません</p>
          <p className="text-gray-400 text-xs mt-1">管理者に確認してください</p>
        </div>
      ) : (
        items.map((item) => (
          <DeliveryCard
            key={item.deliveryItemId}
            item={item}
            onStatusChange={handleStatusChange}
            onMemoSave={handleMemoSave}
          />
        ))
      )}
    </div>
  );
}
