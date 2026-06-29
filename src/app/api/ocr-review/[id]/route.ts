import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const dispatchImage = await prisma.dispatchImage.findUnique({ where: { id } });
  if (!dispatchImage) return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });

  const deliveryItems = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: id },
    orderBy: [{ waveNo: "asc" }, { vehicleNo: "asc" }, { deliverySeq: "asc" }],
  });

  return NextResponse.json({ dispatchImage, deliveryItems });
}
