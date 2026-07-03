"use client";

/**
 * クルー（ドライバー）画面レイアウト プレビュー（デザイン確認用）
 *
 * 前提：1人=1号車。1日の配送は W1〜W6（ウェーブ）で構成。
 *
 * 画面フロー：
 *   トップ … 到着連絡 / カメラ起動 / フォロー + 進捗(W1〜W6) + フォロー中の配送
 *     ├ ウェーブを押す → そのウェーブの配送カード一覧
 *     └ フォロー → 応援できる号車一覧 → 号車の配送 → 各カードで「フォローする」
 *   ・カードの「フォローする」を押すと、その配送が自分のトップ進捗に反映される（号車単位でなく配送単位）
 *
 * DB / 認証 不要。サンプル。middleware 対象外パス。本番には影響しない。
 */

import { useState } from "react";
import Image from "next/image";
import { Bell, Camera, Users, ChevronRight, CheckCircle2, Layers } from "lucide-react";
import { DeliveryCardV2 } from "@/components/driver/DeliveryCardV2";
import type { DeliveryCardItem, DeliveryStatus } from "@/components/driver/DeliveryCard";

const NAVY = "#26324F";
const GOLD = "#b8923f";
const OWN_VEHICLE = "3";
const OWN_COMPANY = "田中運輸";
const WAVES = ["W1", "W2", "W3", "W4", "W5", "W6"];

type PItem = DeliveryCardItem & { companyName?: string | null };

// 配車No は W{ウェーブ}-{号車}-{順}。dispatchKey には「{号車}-{順}」を入れ、カード側で waveNo を前置する
function mk(id: string, wave: string, vehicle: string, seq: number, company: string, over: Partial<PItem> = {}): PItem {
  return {
    assignmentId: `a-${id}`, routeOrder: seq, deliveryItemId: id,
    dispatchKey: `${vehicle}-${seq}`, waveNo: wave, vehicleNo: vehicle, companyName: company,
    address: "埼玉県さいたま市南区別所7丁目1-1", normalOriconCount: 3, coolerBoxCount: 1,
    caseCount: 0, totalCount: 4, memo: null, lat: 35.86, lng: 139.65, deliveryStatus: "ASSIGNED",
    mapsUrl: "https://www.google.com/maps/dir/?api=1&destination=35.86,139.65&travelmode=driving",
    addressNavUrl: "https://www.google.com/maps/search/?api=1&query=...",
    coordinateBadge: "estimated", coordinateStatus: "ESTIMATED",
    ...over,
  };
}

// 自分（3号車・田中運輸）の配送 → W1-3-1 のような配車No
const OWN_INIT: PItem[] = [
  mk("1", "W1", OWN_VEHICLE, 1, OWN_COMPANY, { deliveryStatus: "COMPLETED", coordinateBadge: "approved", coordinateStatus: "ADMIN_APPROVED", hasOverride: true, entranceMemo: "建物裏の階段から2階" }),
  mk("2", "W1", OWN_VEHICLE, 2, OWN_COMPANY, { address: "東京都板橋区高島平3-12-8", cautionMemo: "インターホン故障・ノックで対応" }),
  mk("3", "W2", OWN_VEHICLE, 1, OWN_COMPANY, { address: "埼玉県戸田市美女木2-8-5" }),
  mk("4", "W3", OWN_VEHICLE, 1, OWN_COMPANY, { address: "ハイツ緑ヶ丘", lat: null, lng: null, coordinateBadge: "missing", coordinateStatus: null }),
];

// 他ドライバー（共有データ）。号車単位で応援可能
interface CrewMeta { vehicle: string; company: string; driverName: string }
const CREWS: CrewMeta[] = [
  { vehicle: "5", company: "鈴木配送", driverName: "鈴木 三郎" },
  { vehicle: "6", company: "佐藤運輸", driverName: "佐藤 次郎" },
];
const CREW_INIT: PItem[] = [
  mk("51", "W1", "5", 1, "鈴木配送", { address: "東京都練馬区北町1-2-3", deliveryStatus: "COMPLETED", coordinateBadge: "approved" }),
  mk("52", "W2", "5", 1, "鈴木配送", { address: "東京都練馬区田柄5-6-7" }),
  mk("61", "W2", "6", 1, "佐藤運輸", { address: "埼玉県和光市本町8-9" }),
];

const isDone = (s: DeliveryStatus) => ["COMPLETED", "ABSENT", "RETURNED", "SKIPPED"].includes(s);
const crewMeta = (vehicle: string) => CREWS.find((c) => c.vehicle === vehicle);

export default function DriverPreviewPage() {
  const [ownItems, setOwnItems] = useState<PItem[]>(OWN_INIT);
  const [crewItems, setCrewItems] = useState<PItem[]>(CREW_INIT);
  const [followedIds, setFollowedIds] = useState<string[]>(["52"]); // 応援に取り込んだ配送（デモで1件）
  const [view, setView] = useState<{ t: "hub" } | { t: "ownWave"; wave: string } | { t: "follow" } | { t: "followCrew"; vehicle: string }>({ t: "hub" });

  const toggleItemFollow = (id: string) => setFollowedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const setStatus = (setter: React.Dispatch<React.SetStateAction<PItem[]>>) =>
    async (id: string, status: DeliveryStatus) => setter((prev) => prev.map((i) => (i.deliveryItemId === id ? { ...i, deliveryStatus: status } : i)));
  const setMemo = (setter: React.Dispatch<React.SetStateAction<PItem[]>>) =>
    async (id: string, memo: string) => setter((prev) => prev.map((i) => (i.deliveryItemId === id ? { ...i, memo } : i)));

  const today = new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
  const doneCount = ownItems.filter((i) => isDone(i.deliveryStatus)).length;
  const progressPct = ownItems.length > 0 ? Math.round((doneCount / ownItems.length) * 100) : 0;
  const followedItems = crewItems.filter((i) => followedIds.includes(i.deliveryItemId));

  // ── 自分のウェーブ配送 ──
  if (view.t === "ownWave") {
    const items = ownItems.filter((i) => i.waveNo === view.wave);
    return (
      <Shell>
        <BackBtn onClick={() => setView({ t: "hub" })} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">{view.wave} の配送</h1>
          <p className="text-sm text-gray-500">{OWN_VEHICLE}号車 ・ {today} ・ {items.length}件</p>
        </div>
        {items.map((item) => (
          <DeliveryCardV2 key={item.deliveryItemId} item={item} onStatusChange={setStatus(setOwnItems)} onMemoSave={setMemo(setOwnItems)} />
        ))}
      </Shell>
    );
  }

  // ── フォロー：応援できる号車一覧 ──
  if (view.t === "follow") {
    return (
      <Shell>
        <BackBtn onClick={() => setView({ t: "hub" })} />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">フォロー</h1>
            <Badge>応援</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">他ドライバーが取り込んだ配送から応援できます（号車を選ぶ → 配送ごとにフォロー）</p>
        </div>
        <div className="space-y-2">
          {CREWS.map((c) => {
            const items = crewItems.filter((i) => i.vehicleNo === c.vehicle);
            const followedHere = items.filter((i) => followedIds.includes(i.deliveryItemId)).length;
            return (
              <button key={c.vehicle} onClick={() => setView({ t: "followCrew", vehicle: c.vehicle })}
                className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 active:bg-gray-50 transition">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${GOLD}18`, color: GOLD }}><Users size={20} /></span>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[15px] font-bold text-[#26324F] truncate">{c.vehicle}号車 <span className="font-normal text-sm text-gray-400">/ {c.company}</span></p>
                  <p className="text-[11px] text-gray-400 truncate">{c.driverName} ・ 配送{items.length}件{followedHere > 0 ? ` ・ ${followedHere}件フォロー中` : ""}</p>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </button>
            );
          })}
        </div>
      </Shell>
    );
  }

  // ── フォロー先の号車の配送（各カードでフォロー）──
  if (view.t === "followCrew") {
    const meta = crewMeta(view.vehicle);
    const items = crewItems.filter((i) => i.vehicleNo === view.vehicle);
    return (
      <Shell>
        <BackBtn onClick={() => setView({ t: "follow" })} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{view.vehicle}号車</h1>
            <Badge>フォロー可</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.company} ・ {meta?.driverName} ・ {today} ・ {items.length}件</p>
          <p className="text-[11px] text-gray-400 mt-1">応援する配送の「フォローする」を押すと、あなたのトップに反映されます</p>
        </div>
        {items.map((item) => (
          <DeliveryCardV2
            key={item.deliveryItemId} item={item}
            onStatusChange={setStatus(setCrewItems)} onMemoSave={setMemo(setCrewItems)}
            isFollowed={followedIds.includes(item.deliveryItemId)}
            onFollowToggle={() => toggleItemFollow(item.deliveryItemId)}
          />
        ))}
      </Shell>
    );
  }

  // ── トップ（ハブ）──
  return (
    <Shell>
      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300" /> レイアウトプレビュー（サンプル）
      </div>

      <div>
        <p className="text-xs text-gray-400">{today}</p>
        <h1 className="text-2xl font-bold text-[#26324F] mt-0.5">本日の配送</h1>
        <p className="text-sm text-gray-500 mt-0.5">あなたの担当：<span className="font-semibold text-[#26324F]">{OWN_VEHICLE}号車</span> / {OWN_COMPANY}</p>
      </div>

      {/* 主要アクション */}
      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={<Bell size={24} strokeWidth={2.2} />} title="到着連絡" subtitle="到着をお知らせ" accent={NAVY} />
        <ActionTile icon={<Camera size={24} strokeWidth={2.2} />} title="カメラ起動" subtitle="配送表を撮影" accent="#BF0000" />
      </div>
      <button onClick={() => setView({ t: "follow" })}
        className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 active:bg-gray-50 transition">
        <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${GOLD}18`, color: GOLD }}><Users size={24} strokeWidth={2.2} /></span>
        <div className="flex-1 text-left">
          <p className="text-[15px] font-bold text-[#26324F]">フォロー</p>
          <p className="text-[11px] text-gray-400 mt-0.5">他ドライバーの配送を応援する（読み込み不要）</p>
        </div>
        {followedIds.length > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${GOLD}22`, color: GOLD }}>{followedIds.length}件 応援中</span>}
        <ChevronRight size={20} className="text-gray-300" />
      </button>

      {/* 進捗状況：W1〜W6 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#26324F]">進捗状況</h2>
          <span className="text-xs text-gray-400"><span className="text-green-600 font-bold">{doneCount}</span> / {ownItems.length} 完了</span>
        </div>
        <div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${NAVY}, #3a4a72)` }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 text-right">{progressPct}% 完了</p>
        </div>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {WAVES.map((wave) => {
            const wItems = ownItems.filter((i) => i.waveNo === wave);
            const wDone = wItems.filter((i) => isDone(i.deliveryStatus)).length;
            const empty = wItems.length === 0;
            const allDone = !empty && wDone === wItems.length;
            return (
              <button key={wave} disabled={empty} onClick={() => setView({ t: "ownWave", wave })}
                className={`w-full flex items-center gap-3 px-3 py-3 transition ${empty ? "opacity-40" : "active:bg-gray-50"}`}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: allDone ? "#f0fdf4" : `${NAVY}0d`, color: allDone ? "#16a34a" : NAVY }}><Layers size={18} strokeWidth={2.1} /></span>
                <div className="flex-1 text-left">
                  <p className="text-[15px] font-bold text-[#26324F]">{wave}</p>
                  <p className="text-[11px] text-gray-400">{empty ? "配送なし" : `${wDone}/${wItems.length} 完了`}</p>
                </div>
                {allDone && <CheckCircle2 size={18} className="text-green-500 shrink-0" />}
                {!empty && <ChevronRight size={18} className="text-gray-300 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* フォロー中の配送（自分のページに反映されたもの）*/}
      {followedItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge>フォロー中の配送</Badge>
            <span className="text-[11px] text-gray-400">{followedItems.length}件 応援</span>
          </div>
          {followedItems.map((item) => (
            <DeliveryCardV2
              key={item.deliveryItemId} item={item}
              onStatusChange={setStatus(setCrewItems)} onMemoSave={setMemo(setCrewItems)}
              isFollowed onFollowToggle={() => toggleItemFollow(item.deliveryItemId)}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center gap-3">
          <Image src="/brand/clore-logo-full.png" alt="CLORE" width={1254} height={1254} priority className="h-11 w-11 object-contain" />
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-px bg-gray-200" />
            <span className="text-sm font-semibold tracking-[0.18em] text-[#26324F]">DELIVERY</span>
          </div>
        </div>
        <div className="h-[2px]" style={{ background: "linear-gradient(90deg, #d8b45c, #b8923f)" }} />
      </header>
      <div className="space-y-5 max-w-lg mx-auto p-4">{children}</div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-sm font-medium text-[#26324F]">
      <ChevronRight className="rotate-180" size={16} /> 戻る
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${GOLD}22`, color: GOLD }}>
      <Users size={12} /> {children}
    </span>
  );
}

function ActionTile({ icon, title, subtitle, accent }: { icon: React.ReactNode; title: string; subtitle: string; accent: string }) {
  return (
    <button className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 text-left active:scale-[0.98] transition">
      <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}>{icon}</span>
      <div>
        <p className="text-[15px] font-bold text-[#26324F]">{title}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </button>
  );
}
