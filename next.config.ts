import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // ローカル /uploads/ の画像を最適化なしで配信
    // Vercel Blob / S3 に切り替える際はここにドメインを追加する
    // Vercel Blob URL を含む外部画像を許可
    unoptimized: true,
  },
};

export default nextConfig;
