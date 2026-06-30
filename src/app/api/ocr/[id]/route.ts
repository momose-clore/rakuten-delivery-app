import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { runOcr } from "@/lib/ocr";

// OCR.space + 前処理のため最大60秒まで許容
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const forceReOcr = body?.forceReOcr === true;

  const image = await prisma.dispatchImage.findUnique({ where: { id } });
  if (!image) {
    return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });
  }

  if (image.ocrStatus === "PROCESSING") {
    return NextResponse.json({ error: "OCR処理中です" }, { status: 409 });
  }
  if (image.ocrStatus === "CONFIRMED" && !forceReOcr) {
    return NextResponse.json({ error: "OCR確定済みです" }, { status: 409 });
  }

  try {
    const result = await runOcr(id, session.user.id, { forceReOcr });
    return NextResponse.json({
      success: true,
      itemCount: result.itemCount,
      reviewCount: result.reviewCount,
    });
  } catch (err) {
    console.error("[OCR Error] id=%s message=%s", id, err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "OCR処理に失敗しました。再度試してください。" },
      { status: 500 }
    );
  }
}
