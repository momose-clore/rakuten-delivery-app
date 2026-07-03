import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { storageProvider } from "@/lib/storage";
import { assessMobileImageQuality } from "@/lib/ocr/mobile/mobile-quality-check";
import { normalizeToJpeg } from "@/lib/ocr/normalize-image";
import type { CaptureMode } from "@/types/import";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DRIVER")) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const captureMode = (formData.get("captureMode") as CaptureMode | null) ?? "paper";

  if (!file) return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });

  // iPhoneのHEIC等を JPEG に正規化（EXIF回転も焼き込み）
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const buffer = await normalizeToJpeg(rawBuffer);

  // 品質チェック
  const quality = await assessMobileImageQuality(buffer, captureMode);

  // Vercel Blob に保存
  const filename = `camera/${Date.now()}.jpg`;
  const { url } = await storageProvider.save(buffer, filename);

  return NextResponse.json({
    imageUrl: url,
    quality: {
      level: quality.level,
      score: quality.score,
      canProceedToOcr: quality.canProceedToOcr,
      warnings: quality.warnings,
      blockingReasons: quality.blockingReasons,
    },
  });
}
