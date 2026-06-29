/**
 * デフォルト seed エントリポイント（npm run db:seed / prisma db seed から呼ばれる）
 * 開発・動作確認用。本番環境では seed.prod.ts を直接実行すること:
 *   npx tsx prisma/seed.prod.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcryptjs from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── 管理者アカウント ──────────────────────────
  const adminHash = await bcryptjs.hash("admin1234", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@delivery-app.local" },
    update: {},
    create: {
      email: "admin@delivery-app.local",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });
  console.log("✅ 管理者アカウント:", admin.email);

  // ── テスト用DRIVERアカウント ──────────────────
  const driverHash = await bcryptjs.hash("driver1234", 12);

  const driverUsers = [
    { email: "tanaka@delivery-app.local", name: "田中 太郎", carioDriverId: "CARIO-001", company: "田中運輸", area: "埼玉北", vehicle: "001" },
    { email: "sato@delivery-app.local",   name: "佐藤 次郎", carioDriverId: "CARIO-002", company: "田中運輸", area: "埼玉南", vehicle: "002" },
    { email: "suzuki@delivery-app.local", name: "鈴木 三郎", carioDriverId: "CARIO-003", company: "鈴木配送", area: "東京東", vehicle: "003" },
  ];

  for (const d of driverUsers) {
    const user = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email,
        passwordHash: driverHash,
        role: "DRIVER",
      },
    });

    await prisma.driver.upsert({
      where: { carioDriverId: d.carioDriverId },
      update: { name: d.name, companyName: d.company, area: d.area, vehicleId: d.vehicle },
      create: {
        userId: user.id,
        carioDriverId: d.carioDriverId,
        name: d.name,
        companyName: d.company,
        area: d.area,
        vehicleId: d.vehicle,
      },
    });

    console.log("✅ ドライバーアカウント:", d.email, "/ パスワード: driver1234");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
