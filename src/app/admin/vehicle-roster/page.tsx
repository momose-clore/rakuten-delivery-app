"use client";

import { useState, useEffect, useCallback } from "react";

interface Candidate { driverId: string; name: string; vehicleId: string | null; }
interface Row { vehicleNo: string; driverId: string; }

export default function VehicleRosterPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (d: string) => {
    setMsg(""); setErr("");
    const res = await fetch(`/api/admin/vehicle-roster?date=${d}`);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "取得に失敗しました"); return; }
    const body = await res.json();
    const cands: Candidate[] = body.candidates ?? [];
    setCandidates(cands);
    const r: Row[] = (body.roster ?? []).map((x: { vehicleNo: string; driverId: string }) => ({ vehicleNo: x.vehicleNo, driverId: x.driverId }));
    if (r.length) { setRows(r); return; }
    // 保存済み配置が無ければ、候補ドライバーの号車(vehicleId "N号車")から自動プリフィル
    const seen = new Set<string>();
    const prefill: Row[] = cands
      .map((c) => ({ n: c.vehicleId?.match(/(\d+)\s*号車/)?.[1] ?? "", driverId: c.driverId }))
      .filter((x) => x.n && !seen.has(x.n) && seen.add(x.n))
      .sort((a, b) => Number(a.n) - Number(b.n))
      .map((x) => ({ vehicleNo: x.n, driverId: x.driverId }));
    setRows(prefill.length ? prefill : [1, 2, 3, 4].map((n) => ({ vehicleNo: String(n), driverId: "" })));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(date), 0); // effect内の同期setStateを避ける
    return () => clearTimeout(t);
  }, [date, load]);

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { vehicleNo: String(rs.length + 1), driverId: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    const res = await fetch("/api/admin/vehicle-roster", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, entries: rows.filter((r) => r.vehicleNo.trim() && r.driverId) }),
    });
    setSaving(false);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "保存に失敗しました"); return; }
    const body = await res.json();
    setMsg(`保存しました（${body.count} 台）`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">当日の号車配置</h1>
        <p className="mt-1 text-sm text-gray-500">
          日ごとに「号車 → 担当ドライバー」を設定します（例：今日は1号車=牧田、翌日は牧田休みで飯田が1号車…とシフトで変わる）。号車は1〜4＋今後増える分を「行を追加」で。自動割当のベースに使えます。
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">対象日</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <span className="text-xs text-gray-500">その日シフトのドライバー：{candidates.length}名</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <input value={r.vehicleNo} onChange={(e) => setRow(i, { vehicleNo: e.target.value })}
                className="w-16 px-2 py-2 border border-gray-300 rounded-md text-sm text-center" />
              <span className="text-sm text-gray-600">号車</span>
            </div>
            <select value={r.driverId} onChange={(e) => setRow(i, { driverId: e.target.value })}
              className="flex-1 min-w-[220px] px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
              <option value="">— 未割当 —</option>
              {candidates.map((c) => (
                <option key={c.driverId} value={c.driverId}>{c.name}{c.vehicleId ? `（CARIO:${c.vehicleId}）` : ""}</option>
              ))}
              {/* シフト外だが既に配置済みのドライバーも選択維持 */}
              {r.driverId && !candidates.some((c) => c.driverId === r.driverId) && (
                <option value={r.driverId}>（シフト外の割当済みドライバー）</option>
              )}
            </select>
            <button type="button" onClick={() => removeRow(i)} className="text-sm text-red-500 hover:text-red-700">削除</button>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={addRow} className="text-sm text-blue-600 hover:text-blue-800">＋ 行を追加（号車を増やす）</button>
        </div>
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "保存中…" : "この日の配置を保存"}
          </button>
          {msg && <span className="text-sm text-green-700">{msg}</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>

      {candidates.length === 0 && (
        <p className="text-sm text-gray-500">この日のシフトが未取込です。先に「CARIOシフト取込」を行うと候補ドライバーが表示されます（手動で号車番号＋ドライバー選択も可）。</p>
      )}
    </div>
  );
}
