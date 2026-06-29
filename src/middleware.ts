import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const role = session?.user?.role;

  const isAdminPath = nextUrl.pathname.startsWith("/admin");
  const isDriverPath = nextUrl.pathname.startsWith("/driver");

  // 未認証 → /login へ
  if (!isLoggedIn && (isAdminPath || isDriverPath)) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // DRIVER が /admin/* にアクセス → /driver/today へ
  if (isLoggedIn && role === "DRIVER" && isAdminPath) {
    return NextResponse.redirect(new URL("/driver/today", nextUrl));
  }

  // ADMIN が /driver/* にアクセス → /admin/dashboard へ
  if (isLoggedIn && role === "ADMIN" && isDriverPath) {
    return NextResponse.redirect(new URL("/admin/dashboard", nextUrl));
  }

  // ログイン済みで /login にアクセス → ロール別トップへ
  if (isLoggedIn && nextUrl.pathname === "/login") {
    if (role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/dashboard", nextUrl));
    }
    return NextResponse.redirect(new URL("/driver/today", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*", "/login"],
};
