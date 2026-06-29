import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const image = await prisma.dispatchImage.findUnique({ where: { id } });
  if (!image) return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });

  if (image.ocrStatus === "PENDING" || image.ocrStatus === "PROCESSING") {
    return NextResponse.json({ error: "OCRが完了していません" }, { status: 409 });
  }

  // dispatch_images を CONFIRMED に
  await prisma.dispatchImage.update({
    where: { id },
    data: { ocrStatus: "CONFIRMED" },
  });

  // delivery_items を全て CONFIRMED に（ERROR は除く）
  await prisma.deliveryItem.updateMany({
    where: { dispatchImageId: id, ocrStatus: { not: "ERROR" } },
    data: { ocrStatus: "CONFIRMED" },
  });

  // 監査ログ
  const itemCount = await prisma.deliveryItem.count({ where: { dispatchImageId: id } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CONFIRM_OCR",
      targetType: "dispatch_images",
      targetId: id,
      afterData: { itemCount },
    },
  });

  return NextResponse.json({ success: true });
}
