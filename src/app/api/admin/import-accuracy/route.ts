import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { calculateImportAccuracy, type ImportAccuracyMetrics } from "@/lib/import-accuracy/calculate";

const MAX_IMAGES = 30;

export interface ImportAccuracyRow extends ImportAccuracyMetrics {
  deliveryDate: string;
  area: string | null;
  waveNo: string | null;
  ocrStatus: string;
  createdAt: string;
}

/**
 * 取込精度レポート（delivery_items から毎回再集計）
 * ?date=YYYY-MM-DD で対象日を絞り込み。未指定は最新 MAX_IMAGES 件。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const images = await prisma.dispatchImage.findMany({
    where: date ? { deliveryDate: new Date(date) } : undefined,
    orderBy: { createdAt: "desc" },
    take: MAX_IMAGES,
    select: {
      id: true,
      deliveryDate: true,
      area: true,
      waveNo: true,
      ocrStatus: true,
      ocrProvider: true,
      createdAt: true,
    },
  });

  const rows: ImportAccuracyRow[] = [];
  for (const img of images) {
    const metrics = await calculateImportAccuracy(img.id);
    rows.push({
      ...metrics,
      deliveryDate: img.deliveryDate.toISOString().split("T")[0]!,
      area: img.area,
      waveNo: img.waveNo,
      ocrStatus: img.ocrStatus,
      createdAt: img.createdAt.toISOString(),
    });
  }

  // 全体集計
  const totals = rows.reduce(
    (acc, r) => ({
      imageCount:              acc.imageCount + 1,
      totalItemCount:          acc.totalItemCount + r.totalItemCount,
      totalFieldCount:         acc.totalFieldCount + r.totalFieldCount,
      confirmedFieldCount:     acc.confirmedFieldCount + r.confirmedFieldCount,
      autoRescuedFieldCount:   acc.autoRescuedFieldCount + r.autoRescuedFieldCount,
      manualFixedFieldCount:   acc.manualFixedFieldCount + r.manualFixedFieldCount,
      adminApprovedFieldCount: acc.adminApprovedFieldCount + r.adminApprovedFieldCount,
      needsReviewFieldCount:   acc.needsReviewFieldCount + r.needsReviewFieldCount,
      lowConfidenceFieldCount: acc.lowConfidenceFieldCount + r.lowConfidenceFieldCount,
      estimatedFieldCount:     acc.estimatedFieldCount + r.estimatedFieldCount,
      noMetadataItemCount:     acc.noMetadataItemCount + r.noMetadataItemCount,
    }),
    {
      imageCount: 0, totalItemCount: 0, totalFieldCount: 0,
      confirmedFieldCount: 0, autoRescuedFieldCount: 0, manualFixedFieldCount: 0,
      adminApprovedFieldCount: 0, needsReviewFieldCount: 0, lowConfidenceFieldCount: 0,
      estimatedFieldCount: 0, noMetadataItemCount: 0,
    }
  );

  const confirmedTotal =
    totals.confirmedFieldCount + totals.manualFixedFieldCount + totals.adminApprovedFieldCount;
  const overallAccuracyPercent = totals.totalFieldCount > 0
    ? Math.round((confirmedTotal / totals.totalFieldCount) * 100)
    : 0;
  const rescueRate = totals.totalFieldCount > 0
    ? Math.round((totals.autoRescuedFieldCount / totals.totalFieldCount) * 100) : 0;
  const needsReviewRate = totals.totalFieldCount > 0
    ? Math.round((totals.needsReviewFieldCount / totals.totalFieldCount) * 100) : 0;

  // 明細スキャン：要確認理由TOP・取込方式別・W番号別（個人情報は集計のみ）
  const imageIds = images.map((i) => i.id);
  const items = imageIds.length > 0
    ? await prisma.deliveryItem.findMany({ where: { dispatchImageId: { in: imageIds } }, select: { ocrNotes: true, waveNo: true } })
    : [];

  const reasonCounts: Record<string, number> = {};
  const waveCounts: Record<string, number> = {};
  for (const it of items) {
    const wave = it.waveNo ?? "不明";
    waveCounts[wave] = (waveCounts[wave] ?? 0) + 1;
    if (!it.ocrNotes) continue;
    try {
      for (const r of JSON.parse(it.ocrNotes) as string[]) reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
    } catch { /* skip */ }
  }
  const reasonTop = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));
  const waveBreakdown = Object.entries(waveCounts).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([wave, count]) => ({ wave, count }));

  const sourceCounts: Record<string, number> = {};
  for (const img of images) {
    const s = img.ocrProvider ?? "unknown";
    sourceCounts[s] = (sourceCounts[s] ?? 0) + 1;
  }
  const sourceBreakdown = Object.entries(sourceCounts).map(([source, count]) => ({ source, count }));

  return NextResponse.json({
    rows,
    totals: { ...totals, overallAccuracyPercent, rescueRate, needsReviewRate },
    reasonTop,
    waveBreakdown,
    sourceBreakdown,
  });
}
