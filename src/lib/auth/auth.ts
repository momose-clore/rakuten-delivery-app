import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
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

        try {
          const user = await prisma.user.findUnique({
            where: { email },
            include: { driver: { select: { id: true } } },
          });

          if (!user) {
            console.error("[auth] user not found");
            return null;
          }

          const isValid = await bcryptjs.compare(password, user.passwordHash);
          if (!isValid) {
            console.error("[auth] password invalid");
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            driverId: user.driver?.id ?? null,
          };
        } catch (err) {
          console.error("[auth] authorize error:", err instanceof Error ? err.message : err);
          return null;
        }
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
  },
});
