import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// .env.local を優先（Next.js と同じ挙動）
config({ path: ".env.local", override: true });
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
