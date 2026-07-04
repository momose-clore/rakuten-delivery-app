"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ImageIcon,
  ScanText,
  CalendarDays,
  ClipboardList,
  MapPin,
  TruckIcon,
  LogOut,
  FolderInput,
  MapPinOff,
  BarChart3,
  PlusSquare,
  MapPinned,
  Users,
} from "lucide-react";

const navItems = [
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
  { href: "/admin/drivers", label: "ドライバー管理", icon: Users },
  { href: "/admin/extra-vehicle-requests", label: "増便申請", icon: PlusSquare },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-4 py-5 border-b border-gray-700">
        <p className="text-xs text-gray-400">楽天スーパー配送</p>
        <p className="text-sm font-semibold mt-0.5">管理者画面</p>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-4 border-t border-gray-700">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
