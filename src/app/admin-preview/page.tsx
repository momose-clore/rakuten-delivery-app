"use client";

/**
 * 管理者画面レイアウト・プレビュー（楽天スーパー配送 / 美女木デポ）
 * localhost:3001/admin-preview で確認。
 * DB / 認証 不要・middleware 対象外・サンプルデータのみ。本番には影響しない。
 *
 * ⚠ レイアウト検証専用。実データ接続前の「形」確認用。
 * 他ターミナルの src/app/admin/* / Sidebar.tsx には一切触れていない。
 * 本番の GPS リアルタイム地図は /admin/live-map（認証必須）に実装済み。
 *
 * 用語は実仕様に準拠：
 *   拠点 = 美女木 積み込み拠点（埼玉県戸田市美女木）
 *   号車 = 1人1号車 / 配車No = W番号-号車-順（例 W1-3-1）
 *   Wave = W1〜W6 / ステータス = 未完了・配送中・完了・不在
 *   荷物種別 = 常温・クーラー・ケース
 */

import { useState } from "react";
import {
  LayoutDashboard,
  Truck,
  CalendarDays,
  Route as RouteIcon,
  MapPin,
  ScanLine,
  Settings2,
  LifeBuoy,
  Bell,
  UserCircle2,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Download,
  AlertTriangle,
  ChevronUp,
} from "lucide-react";
import { LiveVehicleMap, type MapPin as VehiclePin } from "@/components/map/LiveVehicleMap";

/* ============ ブランドカラー ============ */
const NAVY = "#26324F"; // CLORE ブランドネイビー（上部ナビ）
const GOLD = "#b8923f"; // アクセント（下線・タグ）
const TEAL = "#0f7b6c"; // 進捗バー（配送済）
const BLUE = "#2f6fdb"; // 進捗バー（見込み）
const AMBER = "#d97706"; // 遅延・要注意
const RED = "#dc2626"; // 未出発・危険

// 美女木 積み込み拠点（src/lib/maps/warehouse.ts と同値）
const DEPOT = { name: "美女木 積み込み拠点", lat: 35.824005, lng: 139.636612, subtitle: "埼玉県戸田市美女木7-18-6" };

// 号車の現在地（プレビュー用の仮座標。本番は /admin/live-map が GPS 実データを表示）
const PINS: VehiclePin[] = [
  { id: "1号車", label: "1号車", color: TEAL, lat: 35.862, lng: 139.618, popupHtml: "<b>1号車</b> 田中 太郎<br/>完了 66/66" },
  { id: "2号車", label: "2号車", color: BLUE, lat: 35.802, lng: 139.686, popupHtml: "<b>2号車</b> 佐藤 次郎<br/>配送中 48/72" },
  { id: "3号車", label: "3号車", color: AMBER, lat: 35.752, lng: 139.802, popupHtml: "<b>3号車</b> 鈴木 三郎<br/>遅延 38/89" },
  { id: "5号車", label: "5号車", color: TEAL, lat: 35.792, lng: 139.724, popupHtml: "<b>5号車</b> 山本 健<br/>完了 90/90" },
  { id: "6号車", label: "6号車", color: BLUE, lat: 35.824, lng: 139.582, popupHtml: "<b>6号車</b> 中村 誠<br/>到着連絡 28/71" },
  { id: "10号車", label: "10号車", color: RED, lat: 35.833, lng: 139.652, popupHtml: "<b>10号車</b> 小林 大和<br/>未出発 0/67" },
  { id: "11号車", label: "11号車", color: BLUE, lat: 35.844, lng: 139.7, popupHtml: "<b>11号車</b> 渡辺 花<br/>配送中 32/58" },
  { id: "12号車", label: "12号車", color: AMBER, lat: 35.722, lng: 139.752, popupHtml: "<b>12号車</b> 加藤 陽菜<br/>不在対応 47/78" },
  { id: "15号車", label: "15号車", color: BLUE, lat: 35.852, lng: 139.664, popupHtml: "<b>15号車</b> 吉田 匠<br/>配送中 38/71" },
];

/* ============ サンプルデータ ============ */
const NAV = [
  { label: "ダッシュボード", icon: LayoutDashboard, active: true },
  { label: "号車・配車", icon: Truck },
  { label: "シフト", icon: CalendarDays },
  { label: "ルート", icon: RouteIcon },
  { label: "住所・ピン", icon: MapPin },
  { label: "取込・OCR", icon: ScanLine },
  { label: "設定", icon: Settings2 },
  { label: "サポート", icon: LifeBuoy },
];

type Stat = { value: number; label: string; tone?: "default" | "warn" | "muted" };

const VEHICLE_STATS: Stat[] = [
  { value: 12, label: "合計号車" },
  { value: 1, label: "遅延", tone: "warn" },
  { value: 3, label: "未サインイン", tone: "muted" },
  { value: 8, label: "稼働中" },
];
const CREW_STATS: Stat[] = [
  { value: 0, label: "オフライン" },
  { value: 16, label: "稼働中" },
  { value: 0, label: "休止中" },
];
const RISK_STATS: Stat[] = [
  { value: 0, label: "高" },
  { value: 2, label: "中", tone: "warn" },
  { value: 5, label: "低", tone: "muted" },
];
const PACKAGE_STATS: Stat[] = [
  { value: 11, label: "不在" },
  { value: 5, label: "持ち戻り" },
  { value: 7, label: "未着手" },
];
const PROGRESS = [
  { pct: 99, label: "配達完了率" },
  { pct: 99, label: "Wave進捗" },
  { pct: 99, label: "経路進捗" },
  { pct: 98, label: "全体進捗" },
];

type Route = {
  vehicle: string; // 号車
  company: string; // 運送会社
  area: string; // 担当エリア
  driver: string;
  status: string;
  statusTone?: "ok" | "warn" | "danger";
  wave: string; // 実施中Wave
  done: number;
  total: number;
};

const ROUTES: Route[] = [
  { vehicle: "1号車", company: "田中運輸", area: "埼玉北", driver: "田中 太郎", status: "完了 ｜ 全Wave終了", wave: "W6", done: 66, total: 66 },
  { vehicle: "2号車", company: "田中運輸", area: "埼玉南", driver: "佐藤 次郎", status: "配送中 ｜ 平均 12件/時", wave: "W4", done: 48, total: 72 },
  { vehicle: "3号車", company: "鈴木配送", area: "東京東", driver: "鈴木 三郎", status: "遅延 ｜ 残り40分見込み", statusTone: "warn", wave: "W3", done: 38, total: 89 },
  { vehicle: "5号車", company: "鈴木配送", area: "東京北", driver: "山本 健", status: "完了 ｜ 全Wave終了", wave: "W6", done: 90, total: 90 },
  { vehicle: "6号車", company: "佐藤運輸", area: "埼玉西", driver: "中村 誠", status: "到着連絡受信 ｜ 14:02", wave: "W3", done: 28, total: 71 },
  { vehicle: "10号車", company: "佐藤運輸", area: "東京西", driver: "小林 大和", status: "未出発 ｜ 未サインイン", statusTone: "danger", wave: "—", done: 0, total: 67 },
  { vehicle: "11号車", company: "田中運輸", area: "埼玉東", driver: "渡辺 花", status: "配送中 ｜ 平均 15件/時", wave: "W2", done: 32, total: 58 },
  { vehicle: "12号車", company: "鈴木配送", area: "東京南", driver: "加藤 陽菜", status: "不在再配達 2件 ｜ 対応中", statusTone: "warn", wave: "W5", done: 47, total: 78 },
  { vehicle: "15号車", company: "佐藤運輸", area: "埼玉中央", driver: "吉田 匠", status: "配送中 ｜ 平均 11件/時", wave: "W3", done: 38, total: 71 },
];

// 号車のステータス分類（絞り込み用）
type Category = "delivering" | "delayed" | "undeparted" | "completed";
function catOf(r: Route): Category {
  if (r.statusTone === "danger" || r.wave === "—") return "undeparted";
  if (r.statusTone === "warn") return "delayed";
  if (r.total > 0 && r.done >= r.total) return "completed";
  return "delivering";
}
const FILTERS: { key: "all" | Category; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "delivering", label: "配送中" },
  { key: "delayed", label: "遅延・不在" },
  { key: "undeparted", label: "未出発" },
  { key: "completed", label: "完了" },
];

/* ============ 小物コンポーネント ============ */

function StatGroup({ stats }: { stats: Stat[] }) {
  return (
    <div className="flex items-end gap-4">
      {stats.map((s) => (
        <div key={s.label} className="min-w-0">
          <div
            className={
              "text-2xl font-bold leading-none " +
              (s.tone === "warn"
                ? "text-amber-600"
                : s.tone === "muted"
                  ? "text-gray-400"
                  : "text-gray-900")
            }
          >
            {s.value}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 whitespace-nowrap">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Donut({ pct, label }: { pct: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={TEAL}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">
          {pct}%
        </div>
      </div>
      <div className="text-[10px] text-gray-500 text-center leading-tight">{label}</div>
    </div>
  );
}

function MetricCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 text-[11px] font-semibold text-gray-500">{title}</div>
      {children}
    </div>
  );
}

function RouteRow({
  r,
  selected,
  onSelect,
}: {
  r: Route;
  selected: boolean;
  onSelect: () => void;
}) {
  const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
  return (
    <button
      onClick={onSelect}
      className={
        "flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 " +
        (selected ? "bg-blue-50" : "")
      }
    >
      {/* 号車 */}
      <div className="w-20 shrink-0">
        <div className="text-sm font-bold text-gray-900">{r.vehicle}</div>
        <div className="text-[10px] text-gray-400">{r.company}</div>
        <div className="text-[10px] text-gray-400">{r.area}</div>
      </div>
      {/* ドライバー + ステータス */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-gray-800">{r.driver}</span>
          {r.wave !== "—" && (
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
              {r.wave}
            </span>
          )}
          {r.statusTone === "warn" && <AlertTriangle size={13} className="shrink-0 text-amber-500" />}
          {r.statusTone === "danger" && <AlertTriangle size={13} className="shrink-0 text-red-500" />}
        </div>
        <div className="truncate text-[11px] text-gray-400">{r.status}</div>
      </div>
      {/* 進捗バー */}
      <div className="w-32 shrink-0">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? TEAL : BLUE }} />
        </div>
        <div className="mt-1 text-right text-[10px] text-gray-500">
          {r.done}/{r.total} 配送
        </div>
      </div>
    </button>
  );
}

/* ============ ページ本体 ============ */

export default function AdminPreview() {
  const [tab, setTab] = useState<"vehicle" | "crew">("vehicle");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Category>("all");

  const filteredRoutes = filter === "all" ? ROUTES : ROUTES.filter((r) => catOf(r) === filter);
  const visibleIds = new Set(filteredRoutes.map((r) => r.vehicle));
  const visiblePins = PINS.filter((p) => visibleIds.has(p.id));

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-gray-900">
      {/* ===== 上部ナビ ===== */}
      <header className="text-white" style={{ background: NAVY }}>
        <div className="flex items-center gap-1 px-4">
          <div className="mr-4 py-3 text-[15px] font-bold tracking-[0.14em]">
            CLORE <span className="font-normal text-gray-300">DELIVERY</span>
          </div>
          <nav className="flex items-center">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <button
                  key={n.label}
                  className={
                    "flex items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] transition " +
                    (n.active ? "text-white" : "border-transparent text-gray-300 hover:text-white")
                  }
                  style={n.active ? { borderColor: GOLD } : undefined}
                >
                  <Icon size={15} />
                  <span className="hidden lg:inline">{n.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button className="rounded-full p-1.5 hover:bg-white/10">
              <Bell size={18} />
            </button>
            <button className="rounded-full p-1 hover:bg-white/10">
              <UserCircle2 size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* ===== サブヘッダー ===== */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <div>
          <div className="text-sm font-semibold text-gray-900">美女木 積み込み拠点</div>
          <div className="text-[11px] text-gray-400">埼玉県戸田市美女木 ・ 現地時間 18:34 GMT+9</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            defaultValue="2026/07/03"
            className="w-28 rounded-md border border-gray-300 px-2 py-1 text-[13px]"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="rounded-md border border-blue-500 px-3 py-1.5 text-[13px] font-medium text-blue-600 hover:bg-blue-50">
            号車の割り当てを編集
          </button>
          <button className="rounded-md px-3 py-1.5 text-[13px] text-gray-500 hover:bg-gray-100">
            ヘルプ
          </button>
        </div>
      </div>

      {/* ===== メトリクスカード行 ===== */}
      <div className="grid grid-cols-1 gap-3 px-4 pt-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="号車">
          <StatGroup stats={VEHICLE_STATS} />
        </MetricCard>
        <MetricCard title="クルー稼働状況">
          <StatGroup stats={CREW_STATS} />
        </MetricCard>
        <MetricCard title="リスクレベル">
          <StatGroup stats={RISK_STATS} />
        </MetricCard>
        <MetricCard title="実行の進行状況">
          <div className="flex justify-between gap-1">
            {PROGRESS.map((p) => (
              <Donut key={p.label} pct={p.pct} label={p.label} />
            ))}
          </div>
        </MetricCard>
        <MetricCard title="荷物ステータス">
          <StatGroup stats={PACKAGE_STATS} />
        </MetricCard>
      </div>

      {/* ===== 持ち戻り・返品 ===== */}
      <div className="px-4 pt-3">
        <div className="inline-block rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="mb-2 text-[11px] font-semibold text-gray-500">持ち戻り・返品</div>
          <StatGroup
            stats={[
              { value: 1, label: "受付" },
              { value: 1, label: "対応中" },
              { value: 0, label: "完了", tone: "muted" },
            ]}
          />
        </div>
      </div>

      {/* ===== メイン：号車一覧 + 地図 ===== */}
      <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[minmax(0,540px)_1fr]">
        {/* 左：号車一覧 */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {/* ツールバー */}
          <div className="flex items-center gap-2 border-b border-gray-200 p-2">
            <div className="flex overflow-hidden rounded-md border border-gray-300 text-[13px]">
              <button
                onClick={() => setTab("vehicle")}
                className={"px-3 py-1.5 " + (tab === "vehicle" ? "bg-blue-600 text-white" : "bg-white text-gray-600")}
              >
                号車
              </button>
              <button
                onClick={() => setTab("crew")}
                className={"px-3 py-1.5 " + (tab === "crew" ? "bg-blue-600 text-white" : "bg-white text-gray-600")}
              >
                クルー
              </button>
            </div>
            <div className="flex flex-1 items-center gap-1.5 rounded-md border border-gray-300 px-2">
              <Search size={15} className="text-gray-400" />
              <input
                placeholder="号車・ドライバー・伝票No・住所で検索…"
                className="w-full py-1.5 text-[13px] outline-none"
              />
            </div>
            <button className="rounded-md border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50">
              <SlidersHorizontal size={15} />
            </button>
            <button className="rounded-md border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50">
              <ArrowUpDown size={15} />
            </button>
            <button className="rounded-md border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50">
              <Download size={15} />
            </button>
          </div>
          {/* ステータス絞り込みチップ */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 px-2 py-2">
            {FILTERS.map((f) => {
              const count = f.key === "all" ? ROUTES.length : ROUTES.filter((r) => catOf(r) === f.key).length;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={
                    "rounded-full px-2.5 py-1 text-[12px] font-medium transition " +
                    (active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                  }
                >
                  {f.label} <span className={active ? "text-blue-100" : "text-gray-400"}>{count}</span>
                </button>
              );
            })}
          </div>
          {/* リスト（クリックで地図が追従） */}
          <div className="max-h-[520px] overflow-auto">
            {filteredRoutes.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">該当する号車はありません</div>
            ) : (
              filteredRoutes.map((r) => (
                <RouteRow
                  key={r.vehicle}
                  r={r}
                  selected={selected === r.vehicle}
                  onSelect={() => setSelected(r.vehicle)}
                />
              ))
            )}
          </div>
          {/* フッター */}
          <button className="flex items-center justify-center gap-1 border-t border-gray-200 py-2 text-[13px] text-blue-600 hover:bg-gray-50">
            <ChevronUp size={15} /> トップに戻る
          </button>
        </div>

        {/* 右：地図（OSM + Leaflet・完全無料・キー不要） */}
        <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-sm">
          <LiveVehicleMap pins={visiblePins} depot={DEPOT} follow={selected} />
        </div>
      </div>

      {/* ===== 注記 ===== */}
      <div className="px-4 pb-8 text-center text-[11px] text-gray-400">
        レイアウトプレビュー ・ 楽天スーパー配送 / 美女木デポ ・ サンプルデータ ・ 本番には影響しません（/admin-preview）
        <br />
        本番の GPS リアルタイム地図は <span className="font-mono">/admin/live-map</span>（管理者ログイン必須）
      </div>
    </div>
  );
}
