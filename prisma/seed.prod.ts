/**
 * 本番用 seed
 * テスト用ドライバーアカウントは含まない。
 * 管理者アカウントのみ作成する。
 *
 * 実行: npx tsx prisma/seed.prod.ts
 * または package.json の "db:seed:prod" スクリプトから実行
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcryptjs from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@your-domain.com";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD 環境変数を設定してください（本番パスワード）");
  }

  const passwordHash = await bcryptjs.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, role: "ADMIN" },
  });

  console.log("✅ 本番管理者アカウント作成:", admin.email);
  console.log("⚠️  パスワードは環境変数 ADMIN_PASSWORD から設定されました");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
