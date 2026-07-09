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
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
