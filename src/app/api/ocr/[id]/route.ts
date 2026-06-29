import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { runOcr } from "@/lib/ocr";

export async function POST(
  _req: NextRequest,
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

  // 対象レコードの存在確認
  const image = await prisma.dispatchImage.findUnique({ where: { id } });
  if (!image) {
    return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });
  }

  // 処理中・確定済みはスキップ
  if (image.ocrStatus === "PROCESSING") {
    return NextResponse.json({ error: "OCR処理中です" }, { status: 409 });
  }
  if (image.ocrStatus === "CONFIRMED") {
    return NextResponse.json({ error: "OCR確定済みです" }, { status: 409 });
  }

  // 非同期で実行（202 を即時返す）
  runOcr(id, session.user.id).catch((err) => {
    console.error("[OCR Error] id=%s message=%s", id, err instanceof Error ? err.message : err);
  });

  return NextResponse.json({ success: true, message: "OCR処理を開始しました" }, { status: 202 });
}
