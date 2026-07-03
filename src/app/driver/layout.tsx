import Link from "next/link";
import { requireDriver } from "@/lib/auth/permissions";
import { DriverLocationTracker } from "@/components/driver/DriverLocationTracker";

// 新デザインは各ページが自前のフルスクリーンヘッダーを持つため、
// レイアウトは認証ガードのみ（ヘッダー/余白はページ側に委譲）
export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDriver();
  return (
    <>
      {/* GPS 現在地トラッカー（不可視・レイアウト非干渉） */}
      <DriverLocationTracker />
      {children}
      {/* 画面最下部にプライバシーポリシーへの控えめなリンク */}
      <footer className="py-4 text-center bg-[#f4f5f7]">
        <Link href="/privacy" className="text-[11px] text-gray-400 underline underline-offset-2">
          プライバシーポリシー
        </Link>
      </footer>
    </>
  );
}
