import { requireAdmin } from "@/lib/auth/permissions";
import { LiveMapClient } from "./LiveMapClient";

/**
 * 号車 GPS リアルタイム地図（管理者・本番）
 * 認証は admin layout（requireAdmin）＋本ページでも二重ガード。
 */
export default async function LiveMapPage() {
  await requireAdmin();
  return <LiveMapClient />;
}
