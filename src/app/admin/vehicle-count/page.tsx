"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";

interface WaveRow {
  wave: string; label: string; window: string;
  planned: number; completed: number; sp: number; follows: number;
}
interface Progress {
  date: string; now: string;
  waves: WaveRow[];
  totals: { planned: number; completed: number; sp: number; follows: number };
  carioActive: boolean;
}

interface MonthlyCell { haritsuke: number; sp: number; zosha: number; ov?: { haritsuke: boolean; zosha: boolean } }
const CAT_LABEL = { haritsuke: "貼付", sp: "SP", zosha: "増車" } as const;
type CatField = keyof typeof CAT_LABEL;
interface Monthly {
  month: string;
  days: string[];
  cells: Record<string, Record<number, MonthlyCell>>;
}

const WAVES = [1, 2, 3, 4, 5, 6];
const WD = ["日", "月", "火", "水", "木", "金", "土"];

/** wave文字列 "W3" → 3 */
function waveNoOf(wave: string): number {
  const m = wave.match(/([1-6])/);
  return m ? Number(m[1]) : 0;
}

/** "YYYY-MM-DD" → 曜日1文字 */
function weekdayJa(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WD[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
}

export default function VehicleCountPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [data, setData] = useState<Progress | null>(null);
  const [monthly, setMonthly] = useState<Monthly | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // SP編集中の値（wave → 文字列）。保存前のローカル入力を保持。
  const [spDraft, setSpDraft] = useState<Record<string, string>>({});
  const [savingWave, setSavingWave] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  // 月次一覧・Excelの「表示月」。日次(date)とは独立してボタンで切替。
  const [viewMonth, setViewMonth] = useState(today.slice(0, 7)); // "YYYY-MM"
  // 月次グリッドのセル編集（キー: date|wave|field）
  const [cellDraft, setCellDraft] = useState<Record<string, string>>({});
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const inFlight = useRef(false);

  const month = viewMonth;

  /** "YYYY-MM" を offset ヶ月ずらす */
  const shiftMonth = (mo: string, offset: number): string => {
    const [y, m] = mo.split("-").map(Number);
    const d = new Date(y!, m! - 1 + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const monthLabel = (mo: string): string => {
    const [y, m] = mo.split("-").map(Number);
    return `${y}年${m}月`;
  };

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

  const loadMonthly = useCallback(async (mo: string) => {
    try {
      const res = await fetch(`/api/admin/vehicle-count/monthly?month=${mo}`);
      if (res.ok) setMonthly(await res.json());
    } catch { /* 月次はベストエフォート */ }
  }, []);

  // 初回＋30秒ごと自動更新（リアルタイム消化進捗）
  useEffect(() => {
    const run = () => { load(date); loadMonthly(month); };
    const first = setTimeout(run, 0);
    const timer = setInterval(run, 30_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [date, month, load, loadMonthly]);

  // SP欄の表示値は spDraft を優先し、未編集waveはサーバー値へフォールバック（描画側で解決）。
  const pct = (c: number, p: number) => (p > 0 ? Math.round((c / p) * 100) : 0);

  const saveSp = useCallback(async (wave: string) => {
    const raw = spDraft[wave] ?? "0";
    const sp = Math.max(0, Math.floor(Number(raw) || 0));
    setSavingWave(wave);
    try {
      const res = await fetch("/api/admin/vehicle-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, waveNo: waveNoOf(wave), sp }),
      });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "SPの保存に失敗しました"); return; }
      setData(await res.json()); setError("");
      setSpDraft((prev) => ({ ...prev, [wave]: String(sp) }));
      loadMonthly(month); // 月次一覧にも反映
    } catch { setError("SPの保存に失敗しました"); }
    finally { setSavingWave(null); }
  }, [date, spDraft, month, loadMonthly]);

  const syncCario = useCallback(async () => {
    setSyncing(true); setSyncMsg("");
    try {
      const res = await fetch("/api/admin/vehicle-count/sync-cario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setSyncMsg(body.error ?? "取込に失敗しました"); return; }
      if (body.progress) setData(body.progress);
      loadMonthly(month);
      if (body.sync?.available) setSyncMsg(`CARIO取込完了：${body.sync.inserted}件`);
      else setSyncMsg("CARIO側の終了報告APIが未提供です（提供され次第ここから取り込めます）");
    } catch { setSyncMsg("取込に失敗しました"); }
    finally { setSyncing(false); }
  }, [date, month, loadMonthly]);

  const importLine = useCallback(async (file: File) => {
    setImporting(true); setImportMsg("");
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/vehicle-count/import-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setImportMsg(body.error ?? "取込に失敗しました"); return; }
      setImportMsg(`LINE取込完了：${body.dates?.length ?? 0}日分・${body.inserted ?? 0}台を反映しました（${(body.dates ?? []).join(", ")}）`);
      load(date); loadMonthly(month);
    } catch { setImportMsg("取込に失敗しました"); }
    finally { setImporting(false); }
  }, [date, month, load, loadMonthly]);

  /** 月次グリッドのセル保存（date×wave×field） */
  const saveCell = useCallback(async (dk: string, no: number, field: CatField, raw: string, current: number) => {
    const key = `${dk}|${no}|${field}`;
    const val = Math.max(0, Math.floor(Number(raw) || 0));
    if (val === current) { setCellDraft((p) => { const n = { ...p }; delete n[key]; return n; }); return; }
    setSavingCell(key);
    try {
      const res = await fetch("/api/admin/vehicle-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dk, waveNo: no, category: CAT_LABEL[field], count: val }),
      });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "保存に失敗しました"); return; }
      setCellDraft((p) => { const n = { ...p }; delete n[key]; return n; });
      await loadMonthly(viewMonth);
      if (dk === date) load(date);
    } catch { setError("保存に失敗しました"); }
    finally { setSavingCell(null); }
  }, [viewMonth, date, load, loadMonthly]);

  /** 数値セル（0は薄く） */
  const num = (n: number) => (
    <span className={n > 0 ? "text-gray-900 font-medium" : "text-gray-300"}>{n}</span>
  );

  /** 編集可能セル（月次グリッド） */
  const editCell = (dk: string, no: number, field: CatField, value: number, isOv: boolean) => {
    const key = `${dk}|${no}|${field}`;
    const draft = cellDraft[key] ?? String(value);
    return (
      <input
        type="number" min={0} value={draft}
        onChange={(e) => setCellDraft((p) => ({ ...p, [key]: e.target.value }))}
        onBlur={() => saveCell(dk, no, field, draft, value)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={`w-9 text-center text-xs rounded border tabular-nums ${isOv ? "bg-amber-50 border-amber-300" : "border-transparent hover:border-gray-300"} ${savingCell === key ? "opacity-50" : ""} ${value > 0 ? "text-gray-900" : "text-gray-300"} focus:border-blue-500 focus:bg-white focus:outline-none`}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">台数確認表（wave別 消化進捗）</h1>
          <p className="mt-1 text-sm text-gray-500">
            実績から自動集計：貼付=通常稼働の完了台数／増車=フォロー。waveを消化（全明細完了）したクルーを「終了報告1件＝1台」として加算します。SPのみ手入力です。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={syncCario}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
          >
            <span aria-hidden>↻</span> {syncing ? "取込中…" : "CARIO終了報告を取込（当日）"}
          </button>
          <label className={`inline-flex items-center gap-2 rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 cursor-pointer ${importing ? "opacity-60 pointer-events-none" : ""}`}>
            <span aria-hidden>⬆</span> {importing ? "取込中…" : "LINE報告を取込（過去日）"}
            <input
              type="file" accept=".txt,text/plain" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importLine(f); e.target.value = ""; }}
            />
          </label>
          <a
            href={`/api/admin/vehicle-count/export?month=${month}`}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <span aria-hidden>⬇</span> Excelダウンロード（{month}）
          </a>
        </div>
      </div>

      {syncMsg && <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-md">{syncMsg}</p>}
      {importMsg && <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-md">{importMsg}</p>}

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
        {data?.carioActive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 border border-blue-200">
            CARIO終了報告 反映中
          </span>
        )}
        {data && <span className="text-xs text-gray-400">最終更新 {new Date(data.now).toLocaleTimeString("ja-JP")}</span>}
        {loading && <span className="text-xs text-gray-400">更新中…</span>}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

      {data && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{["便", "時間帯", "予定台数", "貼付（完了台数）", "消化率", "SP（手入力）", "増車（フォロー）"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.waves.map((w) => {
                const p = pct(w.completed, w.planned);
                const draft = spDraft[w.wave] ?? String(w.sp);
                const dirty = String(w.sp) !== draft;
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0} value={draft}
                          onChange={(e) => setSpDraft((prev) => ({ ...prev, [w.wave]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveSp(w.wave); }}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => saveSp(w.wave)}
                          disabled={!dirty || savingWave === w.wave}
                          className={`text-xs px-2 py-1 rounded ${dirty ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400"} disabled:opacity-60`}
                        >
                          {savingWave === w.wave ? "保存中…" : "保存"}
                        </button>
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
                <td className="px-4 py-3 text-gray-700">{data.totals.sp} 台</td>
                <td className="px-4 py-3 text-gray-700">{data.totals.follows > 0 ? `${data.totals.follows} 台` : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data && data.totals.planned === 0 && (
        <p className="text-sm text-gray-500">この日の割当データがありません（配送明細の取込・割当後に表示されます）。</p>
      )}

      {/* 月次一覧（Excelと同じ並び・貼付/SP/増車 × 日付） */}
      {monthly && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">月次一覧</h2>
            {/* 月切替 */}
            <div className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white">
              <button
                onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-l-md" aria-label="前の月"
              >◀</button>
              <span className="px-2 text-sm font-medium text-gray-900 min-w-[6rem] text-center">{monthLabel(viewMonth)}</span>
              <button
                onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-r-md" aria-label="次の月"
              >▶</button>
            </div>
            <button
              onClick={() => setViewMonth(today.slice(0, 7))}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
            >今月</button>
            <input
              type="month" value={viewMonth} onChange={(e) => e.target.value && setViewMonth(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700"
            />
            <span className="text-xs text-gray-500">各セルを直接編集できます（貼付/SP/増車）。自動集計を手入力で上書きすると<span className="bg-amber-50 border border-amber-300 px-1 rounded">黄色</span>表示。横スクロール可。</span>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600 border-r border-gray-200" rowSpan={2}>便</th>
                  {monthly.days.map((d) => {
                    const wd = weekdayJa(d);
                    const sat = wd === "土", sun = wd === "日";
                    return (
                      <th key={d} colSpan={3} className={`px-2 py-1 text-center font-semibold border-l border-gray-200 ${sun ? "text-red-600" : sat ? "text-blue-600" : "text-gray-700"}`}>
                        {Number(d.slice(8, 10))}({wd})
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-gray-50 text-gray-500">
                  {monthly.days.map((d) => (
                    ["貼付", "SP", "増車"].map((h, k) => (
                      <th key={d + k} className={`px-2 py-1 font-normal whitespace-nowrap ${k === 0 ? "border-l border-gray-200" : ""}`}>{h}</th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {WAVES.map((no) => (
                  <tr key={no} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-gray-900 border-r border-gray-200">W{no}</td>
                    {monthly.days.map((d) => {
                      const c = monthly.cells[d]?.[no] ?? { haritsuke: 0, sp: 0, zosha: 0 };
                      return (
                        <Fragment key={d}>
                          <td className="px-1 py-1 text-center border-l border-gray-100">{editCell(d, no, "haritsuke", c.haritsuke, !!c.ov?.haritsuke)}</td>
                          <td className="px-1 py-1 text-center">{editCell(d, no, "sp", c.sp, c.sp > 0)}</td>
                          <td className="px-1 py-1 text-center">{editCell(d, no, "zosha", c.zosha, !!c.ov?.zosha)}</td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-medium border-t border-gray-200">
                <tr>
                  <td className="sticky left-0 z-10 bg-gray-50 px-3 py-1.5 text-gray-900 border-r border-gray-200">合計</td>
                  {monthly.days.map((d) => {
                    let h = 0, s = 0, z = 0;
                    for (const no of WAVES) {
                      const c = monthly.cells[d]?.[no];
                      if (c) { h += c.haritsuke; s += c.sp; z += c.zosha; }
                    }
                    return (
                      <Fragment key={d}>
                        <td className="px-2 py-1.5 text-center border-l border-gray-200">{num(h)}</td>
                        <td className="px-2 py-1.5 text-center">{num(s)}</td>
                        <td className="px-2 py-1.5 text-center">{num(z)}</td>
                      </Fragment>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
