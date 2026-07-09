import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./config";

// H4対策：ログイン総当りの簡易レート制限（メール単位・インメモリ）。
// ※サーバーレスはインスタンス毎のため完全ではない（分散制限には Upstash 等が必要）が、
//   ウォームインスタンスへの連続総当りを抑える多層防御。
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10分
const LOGIN_MAX_FAILS = 8;
const loginAttempts = new Map<string, { fails: number; first: number }>();
function loginBlocked(email: string): boolean {
  const rec = loginAttempts.get(email);
  if (!rec) return false;
  if (Date.now() - rec.first > LOGIN_WINDOW_MS) {
    loginAttempts.delete(email);
    return false;
  }
  return rec.fails >= LOGIN_MAX_FAILS;
}
function recordLoginFail(email: string): void {
  const rec = loginAttempts.get(email);
  if (!rec || Date.now() - rec.first > LOGIN_WINDOW_MS) loginAttempts.set(email, { fails: 1, first: Date.now() });
  else rec.fails++;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
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

        // レート制限：短時間の連続失敗が上限を超えたら受け付けない
        if (loginBlocked(email)) {
          console.error("[auth] rate limited");
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email },
            include: { driver: { select: { id: true } } },
          });

          if (!user) {
            console.error("[auth] user not found");
            recordLoginFail(email);
            return null;
          }

          const isValid = await bcryptjs.compare(password, user.passwordHash);
          if (!isValid) {
            console.error("[auth] password invalid");
            recordLoginFail(email);
            return null;
          }

          loginAttempts.delete(email); // 成功でリセット
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
