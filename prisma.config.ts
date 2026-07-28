import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// シェル環境変数（DATABASE_URL など）が最優先。
// 未設定の場合のみ .env.local / .env から補完する。
config({ path: ".env.local", override: false });
config({ path: ".env", override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // マイグレーションは Session pooler / 直結（DIRECT_URL）を優先する。
    // 実行時(DATABASE_URL)は Transaction pooler(6543) を使う想定で、そちらは DDL/advisory lock 非対応のため。
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
