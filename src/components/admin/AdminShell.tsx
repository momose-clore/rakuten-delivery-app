"use client";

/**
 * 管理画面の共通シェル（新レイアウト）。
 * /admin-preview の意匠（NAVY トップバー＋GOLD アクセント）を本番の全 /admin/* に適用する。
 * App Router の layout から使うため、全 admin ページが自動でこのチェームを纏う。
 *
 * ⚠ 既存の `Sidebar.tsx`（別ターミナル WIP）には一切触れない。
 *    ナビの実ルートは Sidebar.tsx と同一集合をここに複製（リンク漏れ防止）。
 */

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
  LogOut,
  UserCircle2,
  type LucideIcon,
} from "lucide-react";

/* CLORE ブランドカラー（/admin-preview と同値） */
const NAVY = "#26324F";
const GOLD = "#b8923f";

type NavItem = { href: string; label: string; icon: LucideIcon; external?: boolean };

const navItems: NavItem[] = [
  { href: "/admin/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/admin/dispatch-import", label: "配送表取込", icon: FolderInput },
  { href: "/admin/dispatch-images", label: "画像アップロード", icon: ImageIcon },
  { href: "/admin/ocr-review", label: "取込確認", icon: ScanText },
  { href: "/admin/shifts", label: "シフト取込", icon: CalendarDays },
  { href: "/admin/assignments", label: "割当", icon: ClipboardList },
  { href: "/admin/routes", label: "ルート確認", icon: MapPin },
  { href: "/admin/location-overrides", label: "住所補正", icon: MapPinOff },
  { href: "/admin/import-accuracy", label: "取込精度", icon: BarChart3 },
  { href: "/admin/progress", label: "配送進捗", icon: TruckIcon },
  { href: "/admin/live-map", label: "号車リアルタイム地図", icon: MapPinned },
  { href: "/admin/extra-vehicle-requests", label: "増便申請", icon: PlusSquare },
  // 外部: CARIO（楽天）美女木シフトページ。新規タブで開く（CARIOログインが必要）。
  { href: "https://cario-app-two.vercel.app/manager/shifts", label: "CARIOシフト", icon: ExternalLink, external: true },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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

          <nav className="flex items-center overflow-x-auto no-scrollbar">
            {navItems.map(({ href, label, icon: Icon, external }) => {
              const active = !external && (pathname === href || pathname.startsWith(href + "/"));
              const className =
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] transition " +
                (active ? "text-white" : "border-transparent text-gray-300 hover:text-white");
              const style = active ? { borderColor: GOLD } : undefined;
              const inner = (
                <>
                  <Icon size={15} className="shrink-0" />
                  <span className="hidden xl:inline">{label}</span>
                </>
              );
              // 外部リンク（CARIO 等）は新規タブで開く
              return external ? (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${label}（外部・新規タブ）`}
                  className={className}
                  style={style}
                >
                  {inner}
                </a>
              ) : (
                <Link key={href} href={href} title={label} className={className} style={style}>
                  {inner}
                </Link>
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
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-gray-200 hover:bg-white/10"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===== ページ本体 ===== */}
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
