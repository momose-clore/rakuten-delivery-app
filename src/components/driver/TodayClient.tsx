"use client";

/**
 * ドライバー（クルー）本日画面 — 新デザイン採用版（実データ接続）
 *
 * ホーム: 日付・ドライバー名/ID/号車・倉庫到着時刻・配送表読込(カメラ/PDF)・配達・終了報告
 * 配達: W別タブ + 大型配送カード（ナビ/誤配なし/完了）
 *
 * データ: GET /api/driver/today（配送一覧・ドライバー情報）
 * 完了:   PATCH /api/driver/delivery-items/[id]/status
 *
 * Phase A: 配送取得・完了は実API接続。
 * Phase B(未接続): 倉庫到着時刻・終了報告・誤配なし・カメラ/PDF取込・フォローはUIのみ（バックエンド未実装）。
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { Camera, FileText, Truck, Navigation, Check, Users, List, Map as MapIcon, PackageCheck, ChevronRight, ShieldCheck, Clock, Flag, Trash2, Pencil } from "lucide-react";

const NAVY = "#26324F";
const NAVY_DARK = "#1b2438";
const GOLD = "#b8923f";
const WAVES = ["W1", "W2", "W3", "W4", "W5", "W6"];

interface ApiItem {
  assignmentId: string;
  routeOrder: number | null;
  waveNo: string | null;
  deliveryItemId: string;
  dispatchKey: string | null;
  vehicleNo: string | null;
  address: string | null;
  normalOriconCount: number | null;
  coolerBoxCount: number | null;
  caseCount: number | null;
  totalCount: number | null;
  memo: string | null;
  lat: number | null;
  lng: number | null;
  deliveryStatus: string;
  noMisdelivery?: boolean;
  follow?: { vehicle: string; company: string; driverName: string } | null;
  hasOverride?: boolean;
  entranceMemo?: string | null;
  cautionMemo?: string | null;
  mapsUrl?: string;
  addressNavUrl?: string | null;
  coordinateBadge?: "approved" | "estimated" | "missing" | "none";
}

interface DriverInfo { name: string; driverId: string; vehicleId: string }

const isDone = (s: string) => ["COMPLETED", "ABSENT", "RETURNED", "SKIPPED"].includes(s);

function pillOf(s: string): { label: string; bg: string; icon: string } {
  switch (s) {
    case "COMPLETED":   return { label: "完了",   bg: "#157347", icon: "✓" };
    case "IN_DELIVERY": return { label: "配送中", bg: "#1d4ed8", icon: "▶" };
    case "ABSENT":      return { label: "不在",   bg: "#B45309", icon: "×" };
    case "RETURNED":    return { label: "持戻り", bg: "#C81E1E", icon: "↩" };
    case "SKIPPED":     return { label: "スキップ", bg: "#6b7280", icon: "→" };
    default:            return { label: "未完了", bg: NAVY, icon: "•" };
  }
}
function confOf(b?: string): { label: string; bg: string } | null {
  switch (b) {
    case "approved":  return { label: "✓ 確認済みピン", bg: "#157347" };
    case "estimated": return { label: "⚠ ピン位置注意", bg: "#B45309" };
    case "missing":   return { label: "📍 住所確認",   bg: "#B91C1C" };
    default:          return null;
  }
}
function fullKey(i: ApiItem): string {
  if (!i.dispatchKey) return i.waveNo ?? "—";
  if (i.waveNo && !i.dispatchKey.startsWith(i.waveNo)) return `${i.waveNo}-${i.dispatchKey}`;
  return i.dispatchKey;
}

export function TodayClient() {
  const router = useRouter();
  const [items, setItems] = useState<ApiItem[]>([]);
  const [mapsUrls, setMapsUrls] = useState<string[]>([]);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [warehouseAt, setWarehouseAt] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"home" | "delivery" | "follow">("home");
  const [toast, setToast] = useState("");

  const fetchToday = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/driver/today");
    setLoading(false);
    if (!res.ok) { setError("配送情報の取得に失敗しました"); return; }
    const body = await res.json();
    setItems(body.items ?? []);
    setMapsUrls(body.mapsUrls ?? []);
    setDriver(body.driver ?? null);
    setWarehouseAt(body.report?.warehouseArrivalAt ?? null);
    setFinishedAt(body.report?.finishedReportedAt ?? null);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchToday(); }, [fetchToday]);

  const complete = async (deliveryItemId: string) => {
    const res = await fetch(`/api/driver/delivery-items/${deliveryItemId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => (i.deliveryItemId === deliveryItemId ? { ...i, deliveryStatus: "COMPLETED" } : i)));
    } else {
      setToast("完了の更新に失敗しました");
    }
  };

  const toggleNoMis = async (deliveryItemId: string, value: boolean) => {
    const res = await fetch(`/api/driver/delivery-items/${deliveryItemId}/no-misdelivery`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => (i.deliveryItemId === deliveryItemId ? { ...i, noMisdelivery: value } : i)));
    } else {
      setToast("誤配なしの更新に失敗しました");
    }
  };

  const remove = async (deliveryItemId: string) => {
    const res = await fetch(`/api/driver/delivery-items/${deliveryItemId}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.deliveryItemId !== deliveryItemId));
      setToast("配送を削除しました");
    } else {
      const b = await res.json().catch(() => ({}));
      setToast(b.error ?? "削除に失敗しました");
    }
  };

  const editAddress = async (deliveryItemId: string, address: string) => {
    const res = await fetch(`/api/driver/delivery-items/${deliveryItemId}/address`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => (i.deliveryItemId === deliveryItemId ? { ...i, address, coordinateStatus: "MANUAL_FIXED", lat: null, lng: null } : i)));
      setToast("住所を修正しました");
    } else {
      const b = await res.json().catch(() => ({}));
      setToast(b.error ?? "住所修正に失敗しました");
    }
  };

  const submitWarehouse = async (time: string) => {
    const res = await fetch("/api/driver/warehouse-arrival", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ time }),
    });
    if (res.ok) { const b = await res.json(); setWarehouseAt(b.warehouseArrivalAt); setToast(`倉庫到着 ${time} を送信しました`); }
    else setToast("倉庫到着の送信に失敗しました");
  };

  const submitFinish = async () => {
    const res = await fetch("/api/driver/finish-report", { method: "POST" });
    if (res.ok) { const b = await res.json(); setFinishedAt(b.finishedReportedAt); setToast("本日の配送 終了報告を送信しました"); }
    else { const b = await res.json().catch(() => ({})); setToast(b.error ?? "終了報告の送信に失敗しました"); }
  };

  const importPdf = async (file: File) => {
    setToast("PDFを読み込み中...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/dispatch-import/pdf", { method: "POST", body: fd });
    if (res.ok) {
      const b = await res.json();
      await fetchToday();
      const upd = b.updatedCount ? `・更新${b.updatedCount}件` : "";
      const neo = b.createdCount ? `・新規${b.createdCount}件` : "";
      setToast(`PDFを本日の配送に反映しました（計${b.itemCount ?? 0}件${neo}${upd}）`);
    } else {
      const b = await res.json().catch(() => ({}));
      setToast(b.error ?? "PDF取込に失敗しました");
    }
  };

  const allDone = items.length > 0 && items.every((i) => isDone(i.deliveryStatus));
  const hhmm = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "";

  if (loading) return <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center text-gray-400">読み込み中...</div>;
  if (error)   return <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      {view === "home" && (
        <Home driver={driver} allDone={allDone} warehouseSaved={hhmm(warehouseAt)} finishedSaved={!!finishedAt}
          onDeliver={() => setView("delivery")} onSubmitWarehouse={submitWarehouse} onSubmitFinish={submitFinish} onCamera={() => router.push("/driver/camera")} onPdf={importPdf} />
      )}
      {view === "delivery" && (
        <Delivery items={items} mapsUrls={mapsUrls} onComplete={complete} onToggleNoMis={toggleNoMis} onDelete={remove} onEditAddress={editAddress} onHome={() => setView("home")} onFlash={setToast} onCamera={() => router.push("/driver/camera")} onFollow={() => setView("follow")} />
      )}
      {view === "follow" && (
        <Follow onBack={() => { setView("delivery"); void fetchToday(); }} onFlash={setToast} />
      )}
      {toast && (
        <button onClick={() => setToast("")} className="fixed bottom-24 inset-x-0 z-30 mx-auto max-w-xs px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg" style={{ background: NAVY }}>
          {toast}
        </button>
      )}
    </div>
  );
}

function Header() {
  return (
    <header style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}>
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
        <span className="bg-white rounded-lg p-0.5"><Image src="/brand/clore-logo-full.png" alt="CLORE" width={1254} height={1254} className="h-8 w-8 object-contain" /></span>
        <span className="text-sm font-bold tracking-[0.15em] text-white">DELIVERY</span>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="ml-auto text-xs text-white/70 hover:text-white">ログアウト</button>
      </div>
      <div className="h-[2px]" style={{ background: "linear-gradient(90deg, #d8b45c, #b8923f)" }} />
    </header>
  );
}

function Home({ driver, allDone, warehouseSaved, finishedSaved, onDeliver, onSubmitWarehouse, onSubmitFinish, onCamera, onPdf }: {
  driver: DriverInfo | null; allDone: boolean; warehouseSaved: string; finishedSaved: boolean;
  onDeliver: () => void; onSubmitWarehouse: (time: string) => void; onSubmitFinish: () => void; onCamera: () => void; onPdf: (file: File) => void;
}) {
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  const [warehouseTime, setWarehouseTime] = useState("");
  const warehouseSubmitted = warehouseSaved;
  const reported = finishedSaved;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <Header />
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* ドライバー情報 */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-gray-400">{today}</p>
          <div className="flex items-end justify-between mt-1">
            <div>
              <p className="text-xl font-bold" style={{ color: NAVY }}>{driver?.name ?? "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">ID: {driver?.driverId ?? "—"}</p>
            </div>
            <span className="text-white text-sm font-bold px-3 py-1 rounded-lg" style={{ background: NAVY }}>{driver?.vehicleId ?? "—"}号車</span>
          </div>
        </div>

        {/* 倉庫到着時刻 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${NAVY}12`, color: NAVY }}><Clock size={24} /></span>
            <div className="flex-1">
              <p className="text-[15px] font-bold" style={{ color: NAVY }}>倉庫到着時刻</p>
              <p className="text-[11px] text-gray-400 mt-0.5">朝一で倉庫に到着した時間を入力</p>
            </div>
            {warehouseSubmitted && <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg shrink-0">記録済み {warehouseSubmitted}</span>}
          </div>
          <div className="flex gap-2">
            <input type="time" value={warehouseTime} onChange={(e) => setWarehouseTime(e.target.value)}
              className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-base font-bold focus:outline-none focus:border-[#26324F]" style={{ color: NAVY }} />
            <button onClick={() => { if (warehouseTime) onSubmitWarehouse(warehouseTime); }}
              disabled={!warehouseTime}
              className="px-6 rounded-xl text-white font-bold text-base disabled:opacity-40" style={{ background: NAVY, minHeight: 48 }}>送信</button>
          </div>
        </div>

        {/* 配送予定表の読み込み */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">配送予定表を読み込む</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onCamera} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 text-left active:scale-[0.98] transition">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#BF000014", color: "#BF0000" }}><Camera size={26} /></span>
              <div><p className="text-[15px] font-bold" style={{ color: NAVY }}>カメラ起動</p><p className="text-[11px] text-gray-400 mt-0.5">配送表を撮影</p></div>
            </button>
            <button onClick={() => fileRef.current?.click()} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 text-left active:scale-[0.98] transition">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${NAVY}14`, color: NAVY }}><FileText size={26} /></span>
              <div><p className="text-[15px] font-bold" style={{ color: NAVY }}>PDF読み込み</p><p className="text-[11px] text-gray-400 mt-0.5">配送表ファイル</p></div>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdf(f); e.target.value = ""; }} />
        </div>

        {/* 配達 */}
        <button onClick={onDeliver} className="w-full flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-lg shadow-md active:scale-[0.99] transition"
          style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, minHeight: 72 }}>
          <Truck size={24} /> 配達をはじめる
        </button>

        {/* 終了報告 */}
        <button onClick={() => { if (allDone) onSubmitFinish(); }} disabled={!allDone || reported}
          className="w-full flex items-center justify-center gap-2 rounded-2xl font-bold text-base transition"
          style={reported ? { background: "#157347", color: "#fff", minHeight: 64 }
            : allDone ? { background: GOLD, color: "#fff", minHeight: 64 }
            : { background: "#eef0f3", color: "#9aa2b1", minHeight: 64 }}>
          <Flag size={20} /> {reported ? "終了報告 送信済み" : "終了報告（本日の配送終了）"}
        </button>
        {!allDone && !reported && <p className="text-[11px] text-gray-400 text-center">全ウェーブの配送が完了すると押せます</p>}
      </div>
    </div>
  );
}

function Delivery({ items, mapsUrls, onComplete, onToggleNoMis, onDelete, onEditAddress, onHome, onFlash, onCamera, onFollow }: { items: ApiItem[]; mapsUrls: string[]; onComplete: (id: string) => void; onToggleNoMis: (id: string, value: boolean) => void; onDelete: (id: string) => Promise<void>; onEditAddress: (id: string, address: string) => Promise<void>; onHome: () => void; onFlash: (m: string) => void; onCamera: () => void; onFollow: () => void }) {
  const defaultWave = items.find((i) => !isDone(i.deliveryStatus))?.waveNo ?? items[0]?.waveNo ?? WAVES[0];
  const [selectedWave, setSelectedWave] = useState<string>(defaultWave ?? WAVES[0]);
  const scoped = items.filter((i) => (i.waveNo ?? WAVES[0]) === selectedWave);
  const done = scoped.filter((i) => isDone(i.deliveryStatus)).length;
  const remaining = scoped.length - done;
  const next = scoped.find((i) => !isDone(i.deliveryStatus)) ?? null;

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}>
        <div className="max-w-lg mx-auto px-4 pt-2 pb-2">
          <div className="flex items-center justify-between">
            <button onClick={onHome} className="flex items-center gap-1 text-white text-sm"><ChevronRight className="rotate-180" size={16} />ホーム</button>
            <p className="text-sm text-white"><span className="font-bold text-[#e7c877]">残 {remaining}</span> / 完了 {done}</p>
          </div>
          <div className="mt-2 flex gap-1">
            {WAVES.map((w) => {
              const wItems = items.filter((i) => (i.waveNo ?? WAVES[0]) === w);
              const wDone = wItems.filter((i) => isDone(i.deliveryStatus)).length;
              const empty = wItems.length === 0;
              const allW = !empty && wDone === wItems.length;
              const selected = selectedWave === w;
              return (
                <button key={w} disabled={empty} onClick={() => setSelectedWave(w)}
                  className={`flex-1 text-center rounded-md pt-1 pb-0.5 transition ${empty ? "opacity-40" : "active:bg-white/10"}`}
                  style={selected ? { background: "rgba(255,255,255,0.16)" } : undefined}>
                  <div className="h-1.5 rounded-full mx-0.5" style={{ background: allW ? GOLD : selected ? "#e7c877" : "rgba(255,255,255,0.22)" }} />
                  <span className={`text-[10px] ${selected ? "text-[#e7c877] font-bold" : "text-white/60"}`}>{w}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {remaining === 0 && scoped.length > 0 && (
          <div className="rounded-2xl border-2 border-dashed border-green-300 bg-green-50 p-6 text-center">
            <PackageCheck className="mx-auto text-green-600" size={28} />
            <p className="mt-1 font-bold text-green-700">{selectedWave} の配送はすべて完了しました</p>
          </div>
        )}

        <p className="text-xs font-bold text-gray-500">{selectedWave} の配送（{scoped.length}件）</p>
        {scoped.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400">このウェーブの配送はありません</div>
        ) : scoped.map((i) => (
          <DeliveryCard key={i.deliveryItemId} item={i} current={next != null && i.deliveryItemId === next.deliveryItemId}
            onComplete={() => onComplete(i.deliveryItemId)} onToggleNoMis={(v) => onToggleNoMis(i.deliveryItemId, v)} onDelete={() => onDelete(i.deliveryItemId)} onEditAddress={(a) => onEditAddress(i.deliveryItemId, a)} />
        ))}

        <button onClick={onFollow}
          className="w-full flex items-center gap-3 rounded-2xl bg-white border-2 shadow-sm px-4 active:bg-gray-50 transition" style={{ borderColor: `${GOLD}80`, minHeight: 60 }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${GOLD}18`, color: GOLD }}><Users size={20} /></span>
          <div className="flex-1 text-left"><p className="text-[15px] font-bold" style={{ color: NAVY }}>フォロー（他号車を応援）</p><p className="text-[11px] text-gray-400">他ドライバーの配送を選んで応援</p></div>
          <ChevronRight size={20} className="text-gray-300" />
        </button>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-lg mx-auto grid grid-cols-4 gap-1 px-2 py-1.5">
          <BarBtn icon={<List size={20} />} label="本日" onClick={onHome} />
          <BarBtn icon={<MapIcon size={20} />} label="地図" onClick={() => { if (mapsUrls[0]) window.open(mapsUrls[0], "_blank"); else onFlash("ルートがありません"); }} />
          <BarBtn icon={<Camera size={20} />} label="カメラ" onClick={onCamera} />
          <BarBtn icon={<Users size={20} />} label="フォロー" accent onClick={onFollow} />
        </div>
      </nav>
    </div>
  );
}

function DeliveryCard({ item, current, onComplete, onToggleNoMis, onDelete, onEditAddress }: { item: ApiItem; current?: boolean; onComplete: () => void; onToggleNoMis: (value: boolean) => void; onDelete?: () => Promise<void>; onEditAddress?: (address: string) => Promise<void> }) {
  const conf = confOf(item.coordinateBadge);
  const done = isDone(item.deliveryStatus);
  const pill = pillOf(item.deliveryStatus);
  const [noMis, setNoMis] = useState(!!item.noMisdelivery);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingAddr, setEditingAddr] = useState(false);
  const [addrDraft, setAddrDraft] = useState(item.address ?? "");
  const [savingAddr, setSavingAddr] = useState(false);
  return (
    <div className={`rounded-2xl shadow-lg overflow-hidden bg-white ${done ? "opacity-70" : ""} ${current ? "ring-2 ring-blue-600" : "border border-gray-100"}`}>
      {item.follow && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 text-white text-[12px] font-bold" style={{ background: GOLD }}>
          <Users size={14} /> フォロー中 ・ {item.follow.vehicle}号車（{item.follow.company}）を応援
        </div>
      )}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}>
        <div>
          <p className="text-[10px] text-white/60 leading-none mb-1">{current ? "▶ 対応中 ・ 配車No" : "配車No"}</p>
          <p className="text-[40px] font-mono font-black text-white leading-none tracking-tight">{fullKey(item)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded-full" style={{ background: pill.bg === NAVY ? "rgba(255,255,255,0.2)" : pill.bg }}>{pill.icon} {pill.label}</span>
          {onDelete && !confirmDel && (
            <button onClick={() => setConfirmDel(true)} aria-label="この配送を削除"
              className="p-1.5 rounded-lg bg-white/15 text-white/90 active:scale-95 transition">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {onDelete && confirmDel && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between gap-2">
          <span className="text-sm text-red-700 font-medium">この配送を削除しますか？</span>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDel(false)} disabled={deleting} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 bg-white">やめる</button>
            <button onClick={async () => { setDeleting(true); await onDelete(); }} disabled={deleting} className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold disabled:opacity-50">{deleting ? "削除中..." : "削除する"}</button>
          </div>
        </div>
      )}
      <div className="p-4 space-y-3">
        <div>
          {conf && <span className="inline-block text-white text-[11px] font-bold px-2 py-0.5 rounded-md mb-1" style={{ background: conf.bg }}>{conf.label}</span>}
          {editingAddr && onEditAddress ? (
            <div className="space-y-2">
              <textarea
                value={addrDraft}
                onChange={(e) => setAddrDraft(e.target.value)}
                rows={2}
                className="w-full text-base font-bold text-gray-900 border-2 border-blue-400 rounded-lg px-3 py-2 leading-snug focus:outline-none"
                placeholder="正しい住所を入力"
              />
              <div className="flex gap-2">
                <button onClick={() => { setAddrDraft(item.address ?? ""); setEditingAddr(false); }} disabled={savingAddr}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium">やめる</button>
                <button onClick={async () => { setSavingAddr(true); await onEditAddress(addrDraft); setSavingAddr(false); setEditingAddr(false); }}
                  disabled={savingAddr || !addrDraft.trim()}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50" style={{ background: NAVY }}>
                  {savingAddr ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-bold text-gray-900 leading-snug flex-1">{item.address ?? "住所未登録"}</p>
              {onEditAddress && !done && (
                <button onClick={() => { setAddrDraft(item.address ?? ""); setEditingAddr(true); }}
                  aria-label="住所を修正" className="shrink-0 mt-0.5 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:scale-95 transition">
                  <Pencil size={16} />
                </button>
              )}
            </div>
          )}
        </div>
        {item.cautionMemo && <p className="text-sm text-white font-medium px-2.5 py-1.5 rounded-lg" style={{ background: "#B91C1C" }}>⚠️ {item.cautionMemo}</p>}
        {item.entranceMemo && <p className="text-sm px-2.5 py-1.5 rounded-lg" style={{ background: `${NAVY}0d`, color: NAVY }}>🚪 入口: {item.entranceMemo}</p>}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 text-center">
          <div><p className="text-[11px] text-gray-500">常温</p><p className="font-bold text-gray-900">{item.normalOriconCount ?? 0}</p></div>
          <div><p className="text-[11px] text-gray-500">クーラー</p><p className="font-bold text-gray-900">{item.coolerBoxCount ?? 0}</p></div>
          <div><p className="text-[11px] text-gray-500">ケース</p><p className="font-bold text-gray-900">{item.caseCount ?? 0}</p></div>
          <div className="border-l border-gray-200 pl-4"><p className="text-[11px] text-gray-500">総数</p><p className="text-lg font-black" style={{ color: NAVY }}>{item.totalCount ?? 0}</p></div>
        </div>

        {done ? (
          <p className="text-center text-sm font-bold py-2 rounded-xl" style={{ background: `${pill.bg}14`, color: pill.bg }}>{pill.icon} {pill.label}</p>
        ) : (
          <>
            {item.mapsUrl && (
              <a href={item.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full rounded-xl text-white font-bold text-base" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, minHeight: 60 }}>
                <Navigation size={20} /> ここへナビ
              </a>
            )}
            <button onClick={() => { const v = !noMis; setNoMis(v); onToggleNoMis(v); }}
              className="flex items-center justify-center gap-1.5 w-full rounded-xl border-2 font-bold text-base"
              style={noMis ? { borderColor: "#157347", color: "#157347", background: "#15734714", minHeight: 52 } : { borderColor: "#e5e7eb", color: NAVY, minHeight: 52 }}>
              <ShieldCheck size={18} /> {noMis ? "誤配なし 確認済み ✓" : "誤配なし"}
            </button>
            <button onClick={onComplete} className="flex items-center justify-center gap-2 w-full rounded-xl font-bold text-base text-white bg-[#157347]" style={{ minHeight: 60 }}>
              <Check size={22} /> 完了
            </button>
            {item.coordinateBadge !== "approved" && item.addressNavUrl && (
              <a href={item.addressNavUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-medium" style={{ color: "#B45309" }}>📍 住所でMapを開く（フォールバック）</a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface FollowItem { deliveryItemId: string; dispatchKey: string | null; waveNo: string | null; vehicleNo: string | null; address: string | null; totalCount: number | null; deliveryStatus: string; followedByMe: boolean }
interface FollowCrew { driverName: string; company: string; vehicle: string; items: FollowItem[] }

function keyStr(waveNo: string | null, dispatchKey: string | null): string {
  if (!dispatchKey) return waveNo ?? "—";
  if (waveNo && !dispatchKey.startsWith(waveNo)) return `${waveNo}-${dispatchKey}`;
  return dispatchKey;
}

function Follow({ onBack, onFlash }: { onBack: () => void; onFlash: (m: string) => void }) {
  const [crews, setCrews] = useState<FollowCrew[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/driver/followable");
    setLoading(false);
    if (res.ok) { const b = await res.json(); setCrews(b.crews ?? []); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const toggle = async (deliveryItemId: string, follow: boolean) => {
    const res = await fetch("/api/driver/follow", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliveryItemId, follow }),
    });
    if (res.ok) {
      setCrews((prev) => prev.map((c) => ({ ...c, items: c.items.map((it) => it.deliveryItemId === deliveryItemId ? { ...it, followedByMe: follow } : it) })));
      onFlash(follow ? "応援に追加しました" : "応援を解除しました");
    } else {
      const b = await res.json().catch(() => ({}));
      onFlash(b.error ?? "更新に失敗しました");
    }
  };

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1 text-white text-sm"><ChevronRight className="rotate-180" size={16} />配達へ</button>
          <span className="text-sm font-bold tracking-[0.1em] text-white ml-1">フォロー（応援）</span>
        </div>
        <div className="h-[2px]" style={{ background: "linear-gradient(90deg, #d8b45c, #b8923f)" }} />
      </header>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <p className="text-sm text-gray-500">他の号車の配送を1件ずつ選んで応援できます（元ドライバーと共同で担当）</p>
        {loading ? (
          <p className="text-center text-gray-400 py-8">読み込み中...</p>
        ) : crews.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400">応援できる配送がありません</div>
        ) : crews.map((c, ci) => (
          <div key={ci} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <div className="px-4 py-3 flex items-center gap-2" style={{ background: `${GOLD}12` }}>
              <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}22`, color: GOLD }}><Users size={18} /></span>
              <div>
                <p className="text-[15px] font-bold" style={{ color: NAVY }}>{c.vehicle}号車 <span className="font-normal text-sm text-gray-400">/ {c.company}</span></p>
                <p className="text-[11px] text-gray-400">{c.driverName} ・ {c.items.length}件</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {c.items.map((it) => (
                <div key={it.deliveryItemId} className="flex items-center gap-2 px-3 py-3">
                  <span className="font-mono font-black text-xs w-[70px] shrink-0" style={{ color: NAVY }}>{keyStr(it.waveNo, it.dispatchKey)}</span>
                  <span className="flex-1 text-sm text-gray-800 truncate">{it.address ?? "住所未登録"}</span>
                  <button onClick={() => toggle(it.deliveryItemId, !it.followedByMe)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 ${it.followedByMe ? "text-white" : "border"}`}
                    style={it.followedByMe ? { background: GOLD } : { borderColor: `${GOLD}80`, color: GOLD }}>
                    {it.followedByMe ? "応援中 ✓" : "＋応援する"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarBtn({ icon, label, accent, onClick }: { icon: React.ReactNode; label: string; accent?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl" style={{ minHeight: 56, color: accent ? GOLD : NAVY }}>
      {icon}<span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}
