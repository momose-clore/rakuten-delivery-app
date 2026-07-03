import { requireDriver } from "@/lib/auth/permissions";

// 新デザインは各ページが自前のフルスクリーンヘッダーを持つため、
// レイアウトは認証ガードのみ（ヘッダー/余白はページ側に委譲）
export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDriver();
  return <>{children}</>;
}
