import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** 本番では SSL(sslmode=require) を強制。未指定の接続文字列にも付与する（M2 対策）。ローカルは非強制。 */
function ensureSsl(url: string): string {
  if (process.env.NODE_ENV !== "production") return url;
  if (/[?&]sslmode=/.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "sslmode=require";
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: ensureSsl(process.env.DATABASE_URL!),
    // サーバーレス多重起動でも pooler を枯渇させないよう、1インスタンスの接続数を抑える。
    // 実行時は Transaction pooler(6543) 前提（接続は都度返却されるため少数で十分）。
    max: 3,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
