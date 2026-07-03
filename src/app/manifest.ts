import type { MetadataRoute } from "next";

/**
 * Web App Manifest（PWA / スマホ「ホーム画面に追加」対応）
 * - Android/Chrome のホーム追加アイコン・起動画面に会社ロゴ(CLORE)を使用
 * - iOS のホーム追加アイコンは src/app/apple-icon.png を Next が自動リンク
 * - Next.js が <link rel="manifest"> を自動で head に付与する
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CLORE DELIVERY",
    short_name: "CLORE",
    description: "楽天スーパー配送 クルー・管理アプリ",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#26324F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
