"use client";

/**
 * クルーアプリ 新レイアウト（採用案）— ホーム / 配達 / フォロー
 *
 * フロー:
 *   ホーム(ログイン後) … 日付・ドライバー名/ID・号車 + [到着連絡][カメラ(配送表)][PDF(配送表)][配達]
 *     └ 配達 → Next Stop 配送画面（下部アクションバー: 本日/地図/カメラ/応援）
 *         └ 応援 → フォロー画面（他号車の配送を応援に取り込む）
 *   カメラ/PDF は配送予定表の読み込み（プレビューではサンプル反映）
 *
 * DB / 認証 不要。middleware 対象外パス（/driver-lab）。本番には影響しない。
 */

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, FileText, Truck, Navigation, Check, Users, List, Map, PackageCheck, ChevronRight, ShieldCheck, Clock, Flag } from "lucide-react";

const NAVY = "#26324F";
const NAVY_DARK = "#1b2438";
const GOLD = "#b8923f";

type Status = "ASSIGNED" | "IN_DELIVERY" | "COMPLETED" | "ABSENT" | "RETURNED";
type Conf = "approved" | "estimated" | "missing";

interface Item {
  id: string; wave: string; vehicle: string; seq: number; company: string; driverName: string;
  address: string; normal: number; cooler: number; caseN: number; total: number;
  status: Status; conf: Conf; caution?: string; entrance?: string;
}

const DRIVER = { name: "田中 太郎", id: "CARIO-001", vehicle: "3", company: "田中運輸" };
const WAVES = ["W1", "W2", "W3", "W4", "W5", "W6"];

// 自分の配送デモ生成（3号車・田中運輸）
function o(wave: string, seq: number, over: Partial<Item> = {}): Item {
  return {
    id: `${wave}-${seq}`, wave, vehicle: "3", seq, company: "田中運輸", driverName: "田中 太郎",
    address: "埼玉県さいたま市南区別所7-1-1", normal: 2, cooler: 1, caseN: 0, total: 3,
    status: "ASSIGNED", conf: "approved", ...over,
  };
}
// W1〜W6 デモ。W1 は W1-3-1〜W1-3-4 の4件
const OWN_INIT: Item[] = [
  o("W1", 1, { status: "COMPLETED", address: "埼玉県さいたま市南区別所7-1-1 コーポ美女木201", normal: 3, cooler: 1, total: 4, entrance: "建物裏の階段から2階" }),
  o("W1", 2, { conf: "estimated", address: "東京都板橋区高島平3-12-8", normal: 2, cooler: 2, caseN: 1, total: 5, caution: "インターホン故障・ノックで対応" }),
  o("W1", 3, { address: "東京都板橋区徳丸2-4-6", normal: 1, cooler: 0, caseN: 2, total: 3 }),
  o("W1", 4, { conf: "missing", address: "ハイツ緑ヶ丘 A棟", normal: 1, cooler: 0, total: 1 }),
  o("W2", 1, { address: "埼玉県戸田市美女木2-8-5", normal: 4, cooler: 0, caseN: 2, total: 6 }),
  o("W2", 2, { conf: "estimated", address: "埼玉県戸田市新曽1234", normal: 2, cooler: 1, total: 3 }),
  o("W3", 1, { address: "埼玉県和光市白子3-5-7", normal: 3, cooler: 0, total: 3 }),
  o("W3", 2, { address: "東京都練馬区大泉学園町6-1", normal: 1, cooler: 2, total: 3 }),
  o("W4", 1, { address: "東京都板橋区赤塚8-2-1", normal: 2, cooler: 0, caseN: 1, total: 3 }),
  o("W5", 1, { conf: "estimated", address: "埼玉県朝霞市本町2-9-4", normal: 2, cooler: 1, total: 3 }),
  o("W6", 1, { address: "東京都練馬区石神井町5-3-2", normal: 1, cooler: 0, total: 1 }),
];

const CREW_INIT: Item[] = [
  { id: "51", wave: "W1", vehicle: "5", seq: 1, company: "鈴木配送", driverName: "鈴木 三郎", address: "東京都練馬区北町1-2-3", normal: 2, cooler: 0, caseN: 0, total: 2, status: "ASSIGNED", conf: "approved" },
  { id: "52", wave: "W2", vehicle: "5", seq: 1, company: "鈴木配送", driverName: "鈴木 三郎", address: "東京都練馬区田柄5-6-7", normal: 1, cooler: 1, caseN: 0, total: 2, status: "ASSIGNED", conf: "estimated" },
  { id: "61", wave: "W2", vehicle: "6", seq: 1, company: "佐藤運輸", driverName: "佐藤 次郎", address: "埼玉県和光市本町8-9", normal: 3, cooler: 0, caseN: 1, total: 4, status: "ASSIGNED", conf: "approved" },
];

const isDone = (s: Status) => s === "COMPLETED" || s === "ABSENT" || s === "RETURNED";
const dkey = (i: Item) => `${i.wave}-${i.vehicle}-${i.seq}`;

const STATUS_PILL: Record<Status, { label: string; bg: string; icon: string }> = {
  ASSIGNED:    { label: "未完了",   bg: NAVY,      icon: "•" },
  IN_DELIVERY: { label: "配送中",   bg: "#1d4ed8", icon: "▶" },
  COMPLETED:   { label: "完了",     bg: "#157347", icon: "✓" },
  ABSENT:      { label: "不在",     bg: "#B45309", icon: "×" },
  RETURNED:    { label: "持戻り",   bg: "#C81E1E", icon: "↩" },
};
const CONF_BADGE: Record<Conf, { label: string; bg: string }> = {
  approved:  { label: "✓ 確認済みピン", bg: "#157347" },
  estimated: { label: "⚠ ピン位置注意", bg: "#B45309" },
  missing:   { label: "📍 住所確認",   bg: "#B91C1C" },
};

export default function DriverLabPage() {
  const [view, setView] = useState<"home" | "delivery" | "follow">("home");
  const [own, setOwn] = useState<Item[]>(OWN_INIT);
  const [crew, setCrew] = useState<Item[]>(CREW_INIT);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [reported, setReported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const followed = crew.filter((i) => followedIds.includes(i.id));
  const deliveryItems = [...own, ...followed];
  const allDone = deliveryItems.length > 0 && deliveryItems.every((i) => isDone(i.status));
  const advance = (id: string, status: Status) => {
    setOwn((p) => p.map((i) => (i.id === id ? { ...i, status } : i)));
    setCrew((p) => p.map((i) => (i.id === id ? { ...i, status } : i)));
  };
  const toggleFollow = (id: string) => setFollowedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const flash = (m: string) => { setToast(m); };

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      {view === "home" && <Home driver={DRIVER} onDeliver={() => setView("delivery")} onFlash={flash} fileRef={fileRef}
        allDone={allDone} reported={reported} onReport={() => { setReported(true); flash("本日の配送 終了報告を送信しました"); }} />}
      {view === "delivery" && (
        <Delivery items={deliveryItems} onDone={(id) => advance(id, "COMPLETED")}
          onHome={() => setView("home")} onFollow={() => setView("follow")} followedIds={followedIds} />
      )}
      {view === "follow" && (
        <Follow crew={crew} followedIds={followedIds} onToggle={toggleFollow} onBack={() => setView("delivery")} />
      )}

      {toast && <Toast msg={toast} onClose={() => setToast("")} />}
    </div>
  );
}

// ────────────────── ホーム ──────────────────
function Home({ driver, onDeliver, onFlash, fileRef, allDone, reported, onReport }: { driver: typeof DRIVER; onDeliver: () => void; onFlash: (m: string) => void; fileRef: React.RefObject<HTMLInputElement | null>; allDone: boolean; reported: boolean; onReport: () => void }) {
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  const [warehouseTime, setWarehouseTime] = useState("");
  const [warehouseSubmitted, setWarehouseSubmitted] = useState("");
  return (
    <div>
      <header style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <span className="bg-white rounded-lg p-0.5"><Image src="/brand/clore-logo-full.png" alt="CLORE" width={1254} height={1254} className="h-8 w-8 object-contain" /></span>
          <span className="text-sm font-bold tracking-[0.15em] text-white">DELIVERY</span>
        </div>
        <div className="h-[2px]" style={{ background: "linear-gradient(90deg, #d8b45c, #b8923f)" }} />
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* ドライバー情報 */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-gray-400">{today}</p>
          <div className="flex items-end justify-between mt-1">
            <div>
              <p className="text-xl font-bold" style={{ color: NAVY }}>{driver.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">ID: {driver.id} ・ {driver.company}</p>
            </div>
            <span className="text-white text-sm font-bold px-3 py-1 rounded-lg" style={{ background: NAVY }}>{driver.vehicle}号車</span>
          </div>
        </div>

        {/* 倉庫到着時刻の入力（朝一） */}
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
            <button
              onClick={() => { if (warehouseTime) { setWarehouseSubmitted(warehouseTime); onFlash(`倉庫到着 ${warehouseTime} を送信しました`); } }}
              disabled={!warehouseTime}
              className="px-6 rounded-xl text-white font-bold text-base disabled:opacity-40" style={{ background: NAVY, minHeight: 48 }}>
              送信
            </button>
          </div>
        </div>

        {/* 配送予定表の読み込み */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">配送予定表を読み込む</p>
          <div className="grid grid-cols-2 gap-3">
            <ActionTile icon={<Camera size={26} />} title="カメラ起動" sub="配送表を撮影" accent="#BF0000" onClick={() => onFlash("配送予定表をカメラで読み込みました（サンプル）")} />
            <ActionTile icon={<FileText size={26} />} title="PDF読み込み" sub="配送表ファイル" accent={NAVY} onClick={() => fileRef.current?.click()} />
          </div>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={() => onFlash("PDF/ファイルを読み込みました（サンプル）")} />
        </div>

        {/* 配達（メイン導線）*/}
        <button onClick={onDeliver}
          className="w-full flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-lg shadow-md active:scale-[0.99] transition"
          style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, minHeight: 72 }}>
          <Truck size={24} /> 配達をはじめる
        </button>
        <p className="text-[11px] text-gray-400 text-center">読み込んだ配送予定表の内容が「配達」画面に表示されます</p>

        {/* 終了報告（全ウェーブ完了後）*/}
        <button onClick={onReport} disabled={!allDone || reported}
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

function ActionTile({ icon, title, sub, accent, onClick }: { icon: React.ReactNode; title: string; sub: string; accent: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 text-left active:scale-[0.98] transition">
      <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}>{icon}</span>
      <div><p className="text-[15px] font-bold" style={{ color: NAVY }}>{title}</p><p className="text-[11px] text-gray-400 mt-0.5">{sub}</p></div>
    </button>
  );
}
// ────────────────── 配達（Next Stop）──────────────────
function Delivery({ items, onDone, onHome, onFollow, followedIds }: {
  items: Item[]; onDone: (id: string) => void; onHome: () => void; onFollow: () => void; followedIds: string[];
}) {
  // 自分の配送とフォロー（応援）分を分離
  const ownItems = items.filter((i) => !followedIds.includes(i.id));
  const followItems = items.filter((i) => followedIds.includes(i.id));
  // 全件表示はしない。常に1ウェーブを表示（初期は未完了が残る先頭ウェーブ）
  const defaultWave = ownItems.find((i) => !isDone(i.status))?.wave ?? ownItems[0]?.wave ?? WAVES[0];
  const [selectedWave, setSelectedWave] = useState<string>(defaultWave);
  const ownScoped = ownItems.filter((i) => i.wave === selectedWave);
  const scoped = [...ownScoped, ...followItems];
  const done = scoped.filter((i) => isDone(i.status)).length;
  const remaining = scoped.length - done;
  const next = scoped.find((i) => !isDone(i.status)) ?? null;

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}>
        <div className="max-w-lg mx-auto px-4 pt-2 pb-2">
          <div className="flex items-center justify-between">
            <button onClick={onHome} className="flex items-center gap-1 text-white text-sm"><ChevronRight className="rotate-180" size={16} />ホーム</button>
            <p className="text-sm text-white"><span className="font-bold text-[#e7c877]">残 {remaining}</span> / 完了 {done}</p>
          </div>
          {/* W1〜W6：タブでウェーブを切り替え */}
          <div className="mt-2 flex gap-1">
            {WAVES.map((w) => {
              const wItems = ownItems.filter((i) => i.wave === w);
              const wDone = wItems.filter((i) => isDone(i.status)).length;
              const empty = wItems.length === 0;
              const allDone = !empty && wDone === wItems.length;
              const selected = selectedWave === w;
              return (
                <button key={w} disabled={empty} onClick={() => setSelectedWave(w)}
                  className={`flex-1 text-center rounded-md pt-1 pb-0.5 transition ${empty ? "opacity-40" : "active:bg-white/10"}`}
                  style={selected ? { background: "rgba(255,255,255,0.16)" } : undefined}>
                  <div className="h-1.5 rounded-full mx-0.5" style={{ background: allDone ? GOLD : selected ? "#e7c877" : "rgba(255,255,255,0.22)" }} />
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

        <p className="text-xs font-bold text-gray-500">{selectedWave} の配送（{ownScoped.length}件{followItems.length > 0 ? ` ＋フォロー ${followItems.length}件` : ""}）</p>
        {scoped.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400">このウェーブの配送はありません</div>
        ) : scoped.map((i) => (
          <DeliveryFullCard key={i.id} item={i}
            follow={followedIds.includes(i.id) ? { vehicle: i.vehicle, company: i.company } : undefined}
            current={next != null && i.id === next.id}
            onDone={() => onDone(i.id)} />
        ))}

        {/* フォロー（応援）ボタン */}
        <button onClick={onFollow}
          className="w-full flex items-center gap-3 rounded-2xl bg-white border-2 shadow-sm px-4 active:bg-gray-50 transition"
          style={{ borderColor: `${GOLD}80`, minHeight: 60 }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${GOLD}18`, color: GOLD }}><Users size={20} /></span>
          <div className="flex-1 text-left">
            <p className="text-[15px] font-bold" style={{ color: NAVY }}>フォロー（他号車を応援）</p>
            <p className="text-[11px] text-gray-400">他号車の配送を取り込んで応援する{followedIds.length > 0 ? ` ・ ${followedIds.length}件 応援中` : ""}</p>
          </div>
          <ChevronRight size={20} className="text-gray-300" />
        </button>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-lg mx-auto grid grid-cols-4 gap-1 px-2 py-1.5">
          <BarBtn icon={<List size={20} />} label="本日" onClick={onHome} />
          <BarBtn icon={<Map size={20} />} label="地図" />
          <BarBtn icon={<Camera size={20} />} label="カメラ" />
          <BarBtn icon={<Users size={20} />} label="フォロー" accent onClick={onFollow} />
        </div>
      </nav>
    </div>
  );
}

function DeliveryFullCard({ item, follow, current, onDone }: {
  item: Item; follow?: { vehicle: string; company: string }; current?: boolean; onDone: () => void;
}) {
  const conf = CONF_BADGE[item.conf];
  const done = isDone(item.status);
  const pill = STATUS_PILL[item.status];
  const [noMis, setNoMis] = useState(false);
  return (
    <div className={`rounded-2xl shadow-lg overflow-hidden bg-white ${done ? "opacity-70" : ""} ${current ? "ring-2 ring-blue-600" : "border border-gray-100"}`}>
      {/* フォロー（応援）明示バナー */}
      {follow && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 text-white text-[12px] font-bold" style={{ background: GOLD }}>
          <Users size={14} /> フォロー中 ・ {follow.vehicle}号車（{follow.company}）を応援
        </div>
      )}
      {/* 配車No 特大ヘッダー */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})` }}>
        <div>
          <p className="text-[10px] text-white/60 leading-none mb-1">{current ? "▶ 対応中 ・ 配車No" : "配車No"}</p>
          <p className="text-[40px] font-mono font-black text-white leading-none tracking-tight">{dkey(item)}</p>
        </div>
        <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded-full shrink-0" style={{ background: pill.bg === NAVY ? "rgba(255,255,255,0.2)" : pill.bg }}>{pill.icon} {pill.label}</span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <span className="inline-block text-white text-[11px] font-bold px-2 py-0.5 rounded-md mb-1" style={{ background: conf.bg }}>{conf.label}</span>
          <p className="text-lg font-bold text-gray-900 leading-snug">{item.address}</p>
        </div>
        {item.caution && <p className="text-sm text-white font-medium px-2.5 py-1.5 rounded-lg" style={{ background: "#B91C1C" }}>⚠️ {item.caution}</p>}
        {item.entrance && <p className="text-sm px-2.5 py-1.5 rounded-lg" style={{ background: `${NAVY}0d`, color: NAVY }}>🚪 入口: {item.entrance}</p>}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 text-center">
          <div><p className="text-[11px] text-gray-500">常温</p><p className="font-bold text-gray-900">{item.normal}</p></div>
          <div><p className="text-[11px] text-gray-500">クーラー</p><p className="font-bold text-gray-900">{item.cooler}</p></div>
          <div><p className="text-[11px] text-gray-500">ケース</p><p className="font-bold text-gray-900">{item.caseN}</p></div>
          <div className="border-l border-gray-200 pl-4"><p className="text-[11px] text-gray-500">総数</p><p className="text-lg font-black" style={{ color: NAVY }}>{item.total}</p></div>
        </div>

        {done ? (
          <p className="text-center text-sm font-bold py-2 rounded-xl" style={{ background: `${pill.bg}14`, color: pill.bg }}>{pill.icon} {pill.label}</p>
        ) : (
          <>
            <a href="#" className="flex items-center justify-center gap-2 w-full rounded-xl text-white font-bold text-base" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, minHeight: 60 }}>
              <Navigation size={20} /> ここへナビ
            </a>
            {/* 誤配なし確認 */}
            <button onClick={() => setNoMis((v) => !v)}
              className="flex items-center justify-center gap-1.5 w-full rounded-xl border-2 font-bold text-base"
              style={noMis ? { borderColor: "#157347", color: "#157347", background: "#15734714", minHeight: 52 } : { borderColor: "#e5e7eb", color: NAVY, minHeight: 52 }}>
              <ShieldCheck size={18} /> {noMis ? "誤配なし 確認済み ✓" : "誤配なし"}
            </button>
            <button onClick={onDone} className="flex items-center justify-center gap-2 w-full rounded-xl font-bold text-base text-white bg-[#157347]" style={{ minHeight: 60 }}>
              <Check size={22} /> 完了
            </button>
            {item.conf !== "approved" && <a href="#" className="block text-center text-xs font-medium" style={{ color: "#B45309" }}>📍 住所でMapを開く（フォールバック）</a>}
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────── フォロー（応援）──────────────────
function Follow({ crew, followedIds, onToggle, onBack }: { crew: Item[]; followedIds: string[]; onToggle: (id: string) => void; onBack: () => void }) {
  const vehicles = [...new Set(crew.map((i) => i.vehicle))];
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
        <p className="text-sm text-gray-500">他の号車の配送を応援に取り込めます。「応援する」を押すと配達画面に追加されます。</p>
        {vehicles.map((v) => {
          const vItems = crew.filter((i) => i.vehicle === v);
          const meta = vItems[0];
          return (
            <div key={v} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <div className="px-4 py-3 flex items-center gap-2" style={{ background: `${GOLD}12` }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}22`, color: GOLD }}><Users size={18} /></span>
                <div>
                  <p className="text-[15px] font-bold" style={{ color: NAVY }}>{v}号車 <span className="font-normal text-sm text-gray-400">/ {meta.company}</span></p>
                  <p className="text-[11px] text-gray-400">{meta.driverName} ・ {vItems.length}件</p>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {vItems.map((i) => {
                  const on = followedIds.includes(i.id);
                  return (
                    <div key={i.id} className="flex items-center gap-2 px-3 py-3">
                      <span className="font-mono font-black text-xs w-[70px] shrink-0" style={{ color: NAVY }}>{dkey(i)}</span>
                      <span className="flex-1 text-sm text-gray-800 truncate">{i.address}</span>
                      <button onClick={() => onToggle(i.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 ${on ? "text-white" : "border"}`}
                        style={on ? { background: GOLD } : { borderColor: `${GOLD}80`, color: GOLD }}>
                        {on ? "応援中 ✓" : "＋応援する"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <button onClick={onClose} className="fixed bottom-24 inset-x-0 z-30 mx-auto max-w-xs px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg" style={{ background: NAVY }}>
      {msg}
    </button>
  );
}
