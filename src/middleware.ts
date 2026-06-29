import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Edge Runtime で動作する軽量 middleware（Prisma を使わない）
export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = req.nextUrl;
  const isAdminPath = pathname.startsWith("/admin");
  const isDriverPath = pathname.startsWith("/driver");
  const isLoginPage = pathname === "/login";
  const role = token?.role as string | undefined;

  // 未認証 → /login へ
  if (!token && (isAdminPath || isDriverPath)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // DRIVER が /admin/* にアクセス → /driver/today へ
  if (token && role === "DRIVER" && isAdminPath) {
    return NextResponse.redirect(new URL("/driver/today", req.url));
  }

  // ADMIN が /driver/* にアクセス → /admin/dashboard へ
  if (token && role === "ADMIN" && isDriverPath) {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  // ログイン済みで /login → ロール別トップへ
  if (token && isLoginPage) {
    return NextResponse.redirect(
      new URL(role === "ADMIN" ? "/admin/dashboard" : "/driver/today", req.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*", "/login"],
};
