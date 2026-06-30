import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/** GET: 正解セット詳細 + OCR結果との比較 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;
  const set = await prisma.ocrGroundTruthSet.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // OCR結果を取得
  const ocrItems = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: set.dispatchImageId },
    orderBy: [{ waveNo: "asc" }, { vehicleNo: "asc" }, { deliverySeq: "asc" }],
  });

  // 評価（各フィールドの一致率）
  const total = Math.min(set.items.length, ocrItems.length);
  const metrics = {
    rowCount: { ground: set.items.length, ocr: ocrItems.length, match: total === ocrItems.length },
    dispatchKey: 0, invoiceNo: 0, address: 0, phone: 0, totalCount: 0,
  };

  for (let i = 0; i < total; i++) {
    const gt = set.items[i];
    const ocr = ocrItems[i];
    if (gt.dispatchKey && gt.dispatchKey === ocr.dispatchKey) metrics.dispatchKey++;
    if (gt.invoiceNo && gt.invoiceNo === ocr.invoiceNo) metrics.invoiceNo++;
    if (gt.address && ocr.address?.includes(gt.address)) metrics.address++;
    if (gt.customerPhone && gt.customerPhone === ocr.customerPhone) metrics.phone++;
    if (gt.totalCount && gt.totalCount === ocr.totalCount) metrics.totalCount++;
  }

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return NextResponse.json({
    set,
    ocrItemCount: ocrItems.length,
    accuracy: {
      dispatchKey: pct(metrics.dispatchKey),
      invoiceNo: pct(metrics.invoiceNo),
      address: pct(metrics.address),
      phone: pct(metrics.phone),
      totalCount: pct(metrics.totalCount),
    },
  });
}
