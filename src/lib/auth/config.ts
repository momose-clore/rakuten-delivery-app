import type { NextAuthConfig } from "next-auth";

// Edge Runtime で動作する軽量設定（Prisma を使わない）
// middleware.ts から import される
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session;
      const role = session?.user?.role as string | undefined;
      const isAdminPath = nextUrl.pathname.startsWith("/admin");
      const isDriverPath = nextUrl.pathname.startsWith("/driver");
      const isLoginPage = nextUrl.pathname === "/login";

      if (!isLoggedIn && (isAdminPath || isDriverPath)) return false;

      if (isLoggedIn && role === "DRIVER" && isAdminPath)
        return Response.redirect(new URL("/driver/today", nextUrl));

      if (isLoggedIn && role === "ADMIN" && isDriverPath)
        return Response.redirect(new URL("/admin/dashboard", nextUrl));

      if (isLoggedIn && isLoginPage)
        return Response.redirect(
          new URL(role === "ADMIN" ? "/admin/dashboard" : "/driver/today", nextUrl)
        );

      return true;
    },
  },
} satisfies NextAuthConfig;
