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
    url: process.env["DATABASE_URL"],
  },
});
