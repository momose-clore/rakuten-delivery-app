import type { NextConfig } from "next";

// 全レスポンスに付与するセキュリティヘッダー。
// クリックジャッキング / MIMEスニッフィング / 平文降格 / リファラ漏洩を防ぐ。
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // CSP: frame 埋め込み禁止＋既定は自オリジン。画像は blob/data とHTTPSを許可、
  // Google Maps 等の外部埋め込みに合わせて必要に応じて調整する。
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https:",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    // ローカル /uploads/ の画像を最適化なしで配信
    // Vercel Blob / S3 に切り替える際はここにドメインを追加する
    // Vercel Blob URL を含む外部画像を許可
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
