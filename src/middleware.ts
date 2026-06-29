import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

// Prisma を使わない軽量設定で auth を生成 → Edge Runtime で動作する
// ルーティングロジックは authConfig の authorized コールバックで処理
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*", "/login"],
};
