import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { assessMobileImageQuality } from "@/lib/ocr/mobile/mobile-quality-check";
import type { CaptureMode } from "@/types/import";

export const maxDuration = 30;

/** 画像品質だけチェック（Blob保存・OCR実行なし） */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const captureMode = (formData.get("captureMode") as CaptureMode | null) ?? "paper";

  if (!file) return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const quality = await assessMobileImageQuality(buffer, captureMode);

  return NextResponse.json({
    level: quality.level,
    score: quality.score,
    canProceedToOcr: quality.canProceedToOcr,
    warnings: quality.warnings,
    blockingReasons: quality.blockingReasons,
    resolution: quality.resolution,
    blur: quality.blur,
    brightness: quality.brightness,
    contrast: quality.contrast,
  });
}
