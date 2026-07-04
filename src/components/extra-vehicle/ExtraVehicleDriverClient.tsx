"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExtraVehicleRequestForm } from "./ExtraVehicleRequestForm";
import {
  type ExtraVehicleRequestDTO,
  type ExtraVehicleRequestStatus,
  STATUS_LABEL,
} from "@/types/extra-vehicle-request";

const STATUS_STYLE: Record<ExtraVehicleRequestStatus, string> = {
  pending: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-gray-200 text-gray-600",
};

export function ExtraVehicleDriverClient() {
  const router = useRouter();
  const [requests, setRequests] = useState<ExtraVehicleRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/extra-vehicle-requests");
    setLoading(false);
    if (res.ok) {
      const body = await res.json();
      setRequests(body.requests ?? []);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#26324F] text-white px-4 py-4 flex items-center justify-between">
        <button onClick={() => router.push("/driver/today")} className="text-sm text-gray-200">
          ← 本日画面へ
        </button>
        <h1 className="text-base font-semibold">増便申請</h1>
        <span className="w-16" />
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-5">
        <p className="text-sm text-gray-600">
          配送体制が逼迫している場合に増便を申請できます。申請内容はCARIOが取得し、CARIO公式LINEから専用グループへ報告されます。
        </p>

        <ExtraVehicleRequestForm onCreated={(created) => setRequests((prev) => [created, ...prev])} />

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">自分の申請履歴</h2>
          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-500">まだ申請はありません</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    <span className="font-medium text-gray-900">{r.depot}</span>
                    <span className="text-sm text-gray-700">該当便 {r.waveNo} · {r.vehicleCount}台</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">対象日 {r.requestDate}</p>
                  {r.status === "rejected" && r.rejectedReason && (
                    <p className="text-xs text-gray-500 mt-1">却下理由: {r.rejectedReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
