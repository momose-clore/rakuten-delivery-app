import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { driver: { select: { id: true } } },
        });

        if (!user) return null;

        const isValid = await bcryptjs.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          driverId: user.driver?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.driverId = user.driverId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "ADMIN" | "DRIVER";
      session.user.driverId = (token.driverId as string | null) ?? null;
      return session;
    },
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session;
      const role = session?.user?.role;
      const isAdminPath = nextUrl.pathname.startsWith("/admin");
      const isDriverPath = nextUrl.pathname.startsWith("/driver");
      const isLoginPage = nextUrl.pathname === "/login";

      if (!isLoggedIn && (isAdminPath || isDriverPath)) return false;
      if (isLoggedIn && role === "DRIVER" && isAdminPath)
        return Response.redirect(new URL("/driver/today", nextUrl));
      if (isLoggedIn && role === "ADMIN" && isDriverPath)
        return Response.redirect(new URL("/admin/dashboard", nextUrl));
      if (isLoggedIn && isLoginPage)
        return Response.redirect(new URL(role === "ADMIN" ? "/admin/dashboard" : "/driver/today", nextUrl));

      return true;
    },
  },
});
