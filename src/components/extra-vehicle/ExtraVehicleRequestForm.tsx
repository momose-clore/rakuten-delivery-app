"use client";

import { useState, useEffect } from "react";
import type { ExtraVehicleRequestDTO } from "@/types/extra-vehicle-request";
import { waveReasonVariants } from "@/lib/extra-vehicle/reason-templates";

interface DriverOption { id: string; name: string }

const DEPOT_OPTIONS = ["美女木デポ"];
const WAVES = [1, 2, 3, 4, 5, 6];
const VEHICLE_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const OTHER = "__other__";

interface Props {
  onCreated?: (created: ExtraVehicleRequestDTO) => void;
  defaultDepot?: string;
}

export function ExtraVehicleRequestForm({ onCreated, defaultDepot = "美女木デポ" }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [requestDate, setRequestDate] = useState(today);
  const [depotSel, setDepotSel] = useState(defaultDepot);
  const [depotOther, setDepotOther] = useState("");
  const [waves, setWaves] = useState<number[]>([]);
  const [vehicleCount, setVehicleCount] = useState(1);
  const [driverSel, setDriverSel] = useState("");
  const [driverOther, setDriverOther] = useState("");
  const [reason, setReason] = useState("");
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [areasByWave, setAreasByWave] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    fetch("/api/drivers")
      .then((res) => (res.ok ? res.json() : { drivers: [] }))
      .then((b) => setDrivers(b.drivers ?? []))
      .catch(() => {});
  }, []);

  // 対象日の配達伝票から Wave別エリア（市区町村）を取得（テンプレのエリア自動差し込み用）
  useEffect(() => {
    if (!requestDate) return;
    fetch(`/api/extra-vehicle-requests/wave-areas?date=${requestDate}`)
      .then((res) => (res.ok ? res.json() : { areasByWave: {} }))
      .then((b) => setAreasByWave(b.areasByWave ?? {}))
      .catch(() => {});
  }, [requestDate]);

  const depot = depotSel === OTHER ? depotOther.trim() : depotSel;
  const driverName = driverSel === OTHER ? driverOther.trim() : driverSel;

  function toggleWave(w: number) {
    setWaves((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w].sort((a, b) => a - b)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (!requestDate || !depot || waves.length === 0 || !reason.trim()) {
      setError("対象日・対象デポ・該当便（1つ以上）・申請理由は必須です");
      return;
    }
    setSubmitting(true);
    try {
      const created: ExtraVehicleRequestDTO[] = [];
      // 該当便を複数選んだ場合は、便ごとに1件ずつ申請を作成する
      for (const w of waves) {
        const res = await fetch("/api/extra-vehicle-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestDate,
            depot,
            waveNo: `W${w}`,
            vehicleCount,
            assignedDriverName: driverName || null,
            reason: reason.trim(),
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? `W${w} の申請に失敗しました`);
          setSubmitting(false);
          return;
        }
        created.push(body.request as ExtraVehicleRequestDTO);
      }
      created.forEach((c) => onCreated?.(c));
      setDone(`${created.length}件の増便申請を送信しました（${waves.map((w) => `W${w}`).join(" / ")}）`);
      setWaves([]);
      setVehicleCount(1);
      setReason("");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls = "block text-sm font-medium text-gray-700 mb-1";
  const inputCls =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 対象日 */}
        <div>
          <label className={labelCls}>対象日 <span className="text-red-500">*</span></label>
          <input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} className={inputCls} />
        </div>
        {/* 対象デポ（プルダウン＋その他） */}
        <div>
          <label className={labelCls}>対象デポ <span className="text-red-500">*</span></label>
          <select value={depotSel} onChange={(e) => setDepotSel(e.target.value)} className={inputCls}>
            {DEPOT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value={OTHER}>その他（手入力）</option>
          </select>
          {depotSel === OTHER && (
            <input type="text" value={depotOther} onChange={(e) => setDepotOther(e.target.value)}
              placeholder="デポ名を入力" className={`${inputCls} mt-2`} />
          )}
        </div>
      </div>

      {/* 該当便（W1〜W6 複数選択） */}
      <div>
        <label className={labelCls}>該当便（複数選択可） <span className="text-red-500">*</span></label>
        <div className="flex flex-wrap gap-2">
          {WAVES.map((w) => {
            const on = waves.includes(w);
            return (
              <button type="button" key={w} onClick={() => toggleWave(w)}
                className={"px-3 py-1.5 rounded-md text-sm border font-medium " +
                  (on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50")}>
                W{w}
              </button>
            );
          })}
        </div>
      </div>

      {/* 台数（1〜10 選択） */}
      <div>
        <label className={labelCls}>台数 <span className="text-red-500">*</span></label>
        <div className="flex flex-wrap gap-2">
          {VEHICLE_COUNTS.map((n) => {
            const on = vehicleCount === n;
            return (
              <button type="button" key={n} onClick={() => setVehicleCount(n)}
                className={"w-10 py-1.5 rounded-md text-sm border font-medium " +
                  (on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50")}>
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ドライバー名（シフト/登録ドライバー選択＋その他手入力） */}
      <div>
        <label className={labelCls}>ドライバー名（任意）</label>
        <select value={driverSel} onChange={(e) => setDriverSel(e.target.value)} className={inputCls}>
          <option value="">選択しない</option>
          {drivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          <option value={OTHER}>その他（手入力）</option>
        </select>
        {driverSel === OTHER && (
          <input type="text" value={driverOther} onChange={(e) => setDriverOther(e.target.value)}
            placeholder="ドライバー名を入力（例: 石毛）" className={`${inputCls} mt-2`} />
        )}
      </div>

      {/* 申請理由（テンプレート＋編集可） */}
      <div>
        <label className={labelCls}>申請理由 <span className="text-red-500">*</span></label>
        {waves.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {waves.map((w) => {
              const areas = areasByWave[`W${w}`] ?? [];
              return (
                <div key={w} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-600 self-center w-8">W{w}</span>
                  {areas.length > 0 && (
                    <span className="text-[11px] text-gray-400 self-center">{areas.join("・")}</span>
                  )}
                  {waveReasonVariants(w, areas).map((t) => (
                    <button type="button" key={t.label} onClick={() => setReason(t.text)}
                      className="px-2 py-1 rounded border border-blue-300 text-blue-700 text-xs hover:bg-blue-50">
                      {t.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={7}
          placeholder="該当便を選ぶとテンプレートが表示されます。選択後に自由に編集できます。"
          className={`${inputCls} resize-y leading-relaxed`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={submitting}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50">
          {submitting ? "送信中..." : waves.length > 1 ? `増便を申請する（${waves.length}便）` : "増便を申請する"}
        </button>
      </div>
    </form>
  );
}
