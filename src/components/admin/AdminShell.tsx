"use client";

/**
 * 管理画面の共通シェル（新レイアウト）。
 * /admin-preview の意匠（NAVY トップバー＋GOLD アクセント）を本番の全 /admin/* に適用する。
 * App Router の layout から使うため、全 admin ページが自動でこのテーマを纏う。
 *
 * ナビは「似た機能」を5グループのドロップダウンに集約（ボタン過多の解消）:
 *   ホーム / 取込 / 配車 / 地図・住所 / 連携
 * 各ページ(URL)は不変。⚠ 既存の `Sidebar.tsx`（別ターミナル WIP）には触れない。
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FolderInput,
  ImageIcon,
  ScanText,
  CalendarDays,
  ClipboardList,
  MapPin,
  MapPinOff,
  BarChart3,
  TruckIcon,
  MapPinned,
  PlusSquare,
  ExternalLink,
  Share2,
  ChevronDown,
  LogOut,
  UserCircle2,
  Users,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

/* CLORE ブランドカラー（/admin-preview と同値） */
const NAVY = "#26324F";
const GOLD = "#b8923f";

type NavItem = { href: string; label: string; icon: LucideIcon; external?: boolean };
type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };

/* トップの単独リンク */
const HOME: NavItem = { href: "/admin/dashboard", label: "ホーム", icon: LayoutDashboard };

/* 似た機能を集約した5グループ（各ページURLは従来どおり） */
const GROUPS: NavGroup[] = [
  {
    id: "import",
    label: "取込",
    icon: FolderInput,
    items: [
      { href: "/admin/dispatch-import", label: "配送表取込", icon: FolderInput },
      { href: "/admin/dispatch-images", label: "画像アップロード", icon: ImageIcon },
      { href: "/admin/ocr-review", label: "取込確認", icon: ScanText },
      { href: "/admin/import-accuracy", label: "取込精度", icon: BarChart3 },
    ],
  },
  {
    id: "dispatch",
    label: "配車",
    icon: TruckIcon,
    items: [
      { href: "/admin/shifts", label: "シフト取込", icon: CalendarDays },
      { href: "/admin/assignments", label: "割当", icon: ClipboardList },
      { href: "/admin/routes", label: "ルート確認", icon: MapPin },
      { href: "/admin/progress", label: "配送進捗", icon: TruckIcon },
      { href: "/admin/drivers", label: "ドライバー管理", icon: Users },
    ],
  },
  {
    id: "map",
    label: "地図・住所",
    icon: MapPinned,
    items: [
      { href: "/admin/live-map", label: "号車リアルタイム地図", icon: MapPinned },
      { href: "/admin/location-overrides", label: "住所補正", icon: MapPinOff },
    ],
  },
  {
    id: "link",
    label: "連携",
    icon: Share2,
    items: [
      { href: "/admin/extra-vehicle-requests", label: "増便申請", icon: PlusSquare },
      // 外部: CARIO（楽天）美女木シフトページ。新規タブで開く（CARIOログインが必要）。
      { href: "https://cario-app-two.vercel.app/manager/shifts", label: "CARIOシフト", icon: ExternalLink, external: true },
    ],
  },
];

function isItemActive(pathname: string, it: NavItem): boolean {
  return !it.external && (pathname === it.href || pathname.startsWith(it.href + "/"));
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openId]);

  // ルート変更でメニューを閉じる（モバイルドロワー・PCドロップダウン。意図的な同期setState）
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMobileOpen(false);
    setOpenId(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname]);

  const homeActive = isItemActive(pathname, HOME);

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-gray-900 flex flex-col">
      {/* ===== 上部ナビ（NAVY） ===== */}
      <header className="text-white" style={{ background: NAVY }}>
        <div className="flex items-center gap-1 px-4">
          <Link
            href="/admin/dashboard"
            className="mr-3 shrink-0 py-3 text-[15px] font-bold tracking-[0.14em]"
          >
            CLORE <span className="font-normal text-gray-300">DELIVERY</span>
          </Link>

          <nav ref={navRef} className="hidden md:flex items-center">
            {/* ホーム（単独） */}
            <Link
              href={HOME.href}
              onClick={() => setOpenId(null)}
              className={
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] transition " +
                (homeActive ? "text-white" : "border-transparent text-gray-300 hover:text-white")
              }
              style={homeActive ? { borderColor: GOLD } : undefined}
            >
              <HOME.icon size={15} className="shrink-0" />
              <span className="hidden sm:inline">{HOME.label}</span>
            </Link>

            {/* グループ（ドロップダウン） */}
            {GROUPS.map((g) => {
              const GroupIcon = g.icon;
              const groupActive = g.items.some((it) => isItemActive(pathname, it));
              const open = openId === g.id;
              return (
                <div key={g.id} className="relative">
                  <button
                    onClick={() => setOpenId(open ? null : g.id)}
                    className={
                      "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] transition " +
                      (groupActive || open ? "text-white" : "border-transparent text-gray-300 hover:text-white")
                    }
                    style={groupActive || open ? { borderColor: GOLD } : undefined}
                    aria-expanded={open}
                  >
                    <GroupIcon size={15} className="shrink-0" />
                    <span className="hidden sm:inline">{g.label}</span>
                    <ChevronDown
                      size={13}
                      className={"shrink-0 transition-transform " + (open ? "rotate-180" : "")}
                    />
                  </button>

                  {open && (
                    <div className="absolute left-0 top-full z-[1000] mt-1 min-w-[210px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-gray-800 shadow-lg">
                      {g.items.map((it) => {
                        const ItemIcon = it.icon;
                        const active = isItemActive(pathname, it);
                        const cls =
                          "flex items-center gap-2 px-3 py-2 text-[13px] transition hover:bg-gray-50 " +
                          (active ? "bg-blue-50 font-semibold text-blue-700" : "text-gray-700");
                        return it.external ? (
                          <a
                            key={it.href}
                            href={it.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cls}
                            onClick={() => setOpenId(null)}
                          >
                            <ItemIcon size={15} className="shrink-0 text-gray-400" />
                            <span className="flex-1">{it.label}</span>
                            <ExternalLink size={12} className="shrink-0 text-gray-400" />
                          </a>
                        ) : (
                          <Link
                            key={it.href}
                            href={it.href}
                            className={cls}
                            onClick={() => setOpenId(null)}
                          >
                            <ItemIcon size={15} className={"shrink-0 " + (active ? "text-blue-600" : "text-gray-400")} />
                            <span className="flex-1">{it.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
            <span className="hidden sm:flex items-center gap-1 text-gray-300">
              <UserCircle2 size={20} />
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="ログアウト"
              className="hidden md:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-gray-200 hover:bg-white/10"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
            {/* モバイル用ハンバーガー */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden rounded-md p-2 text-gray-100 hover:bg-white/10"
              aria-label="メニュー"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* ===== モバイル用ドロワー ===== */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[2000] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85%] overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: NAVY }}>
              <span className="text-sm font-bold tracking-wider">メニュー</span>
              <button onClick={() => setMobileOpen(false)} aria-label="閉じる" className="rounded-md p-1 hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <nav className="py-2">
              {/* ホーム */}
              <Link
                href={HOME.href}
                className={
                  "flex items-center gap-2 px-4 py-2.5 text-sm " +
                  (homeActive ? "bg-blue-50 font-semibold text-blue-700" : "text-gray-700 hover:bg-gray-50")
                }
              >
                <HOME.icon size={17} className="shrink-0" />
                {HOME.label}
              </Link>
              {/* グループごとに見出し＋項目 */}
              {GROUPS.map((g) => (
                <div key={g.id} className="mt-1">
                  <div className="flex items-center gap-1.5 px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    <g.icon size={13} /> {g.label}
                  </div>
                  {g.items.map((it) => {
                    const ItemIcon = it.icon;
                    const active = isItemActive(pathname, it);
                    const cls =
                      "flex items-center gap-2 px-4 py-2.5 text-sm " +
                      (active ? "bg-blue-50 font-semibold text-blue-700" : "text-gray-700 hover:bg-gray-50");
                    return it.external ? (
                      <a key={it.href} href={it.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => setMobileOpen(false)}>
                        <ItemIcon size={17} className="shrink-0 text-gray-400" />
                        <span className="flex-1">{it.label}</span>
                        <ExternalLink size={13} className="shrink-0 text-gray-400" />
                      </a>
                    ) : (
                      <Link key={it.href} href={it.href} className={cls}>
                        <ItemIcon size={17} className={"shrink-0 " + (active ? "text-blue-600" : "text-gray-400")} />
                        <span className="flex-1">{it.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
              {/* ログアウト */}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="mt-2 flex w-full items-center gap-2 border-t border-gray-100 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogOut size={17} className="shrink-0 text-gray-400" />
                ログアウト
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* ===== ページ本体 ===== */}
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
