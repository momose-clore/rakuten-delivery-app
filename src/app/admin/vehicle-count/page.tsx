"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface WaveRow {
  wave: string; label: string; window: string;
  planned: number; completed: number; follows: number;
}
interface Progress {
  date: string; now: string;
  waves: WaveRow[];
  totals: { planned: number; completed: number; follows: number };
}

export default function VehicleCountPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async (d: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vehicle-count?date=${d}`);
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "取得に失敗しました"); return; }
      setData(await res.json()); setError("");
    } catch { setError("取得に失敗しました"); }
    finally { setLoading(false); inFlight.current = false; }
  }, []);

  // 初回＋30秒ごと自動更新（リアルタイム消化進捗）
  useEffect(() => {
    const run = () => load(date);
    const first = setTimeout(run, 0);
    const timer = setInterval(run, 30_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [date, load]);

  const pct = (c: number, p: number) => (p > 0 ? Math.round((c / p) * 100) : 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">台数管理表（wave別 消化進捗）</h1>
        <p className="mt-1 text-sm text-gray-500">
          実績から自動集計：貼付=通常稼働（予定台数）／増車=フォロー。waveを消化（全明細完了）したクルー数を「完了台数」として加算します。
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">対象日</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" /></span>
          30秒ごと自動更新
        </span>
        {data && <span className="text-xs text-gray-400">最終更新 {new Date(data.now).toLocaleTimeString("ja-JP")}</span>}
        {loading && <span className="text-xs text-gray-400">更新中…</span>}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

      {data && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{["便", "時間帯", "予定台数", "完了台数", "消化率", "増車(フォロー)"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.waves.map((w) => {
                const p = pct(w.completed, w.planned);
                return (
                  <tr key={w.wave} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{w.wave}（{w.label}）</td>
                    <td className="px-4 py-3 text-gray-500">{w.window}</td>
                    <td className="px-4 py-3 text-gray-700">{w.planned} 台</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{w.completed} / {w.planned}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full ${p >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${p}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{p}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{w.follows > 0 ? `${w.follows} 台` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200 font-medium">
              <tr>
                <td className="px-4 py-3 text-gray-900" colSpan={2}>合計</td>
                <td className="px-4 py-3 text-gray-700">{data.totals.planned} 台</td>
                <td className="px-4 py-3 text-gray-900">{data.totals.completed} / {data.totals.planned}</td>
                <td className="px-4 py-3 text-gray-600">{pct(data.totals.completed, data.totals.planned)}%</td>
                <td className="px-4 py-3 text-gray-700">{data.totals.follows > 0 ? `${data.totals.follows} 台` : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data && data.totals.planned === 0 && (
        <p className="text-sm text-gray-500">この日の割当データがありません（配送明細の取込・割当後に表示されます）。</p>
      )}
    </div>
  );
}
