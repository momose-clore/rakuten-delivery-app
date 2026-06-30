import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { getTodayStats } from "@/lib/ocr/usage";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // OCR使用統計
  const usageStats = await getTodayStats();

  // 明細の信頼度統計（対象日）
  const images = await prisma.dispatchImage.findMany({
    where: { deliveryDate: { gte: targetDate, lt: nextDate } },
    select: { id: true },
  });
  const imageIds = images.map((i) => i.id);

  const items = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: { in: imageIds } },
    select: { ocrNotes: true, ocrStatus: true },
  });

  const parseNotes = (notes: string | null): string[] => {
    if (!notes) return [];
    try { return JSON.parse(notes) as string[]; } catch { return []; }
  };

  const totalItems = items.length;
  const allNotes = items.flatMap((i) => parseNotes(i.ocrNotes));

  const stats = {
    date: targetDate.toISOString().split("T")[0],
    totalItems,
    addressEmpty: allNotes.filter((n) => n === "ADDRESS_EMPTY").length,
    addressSuspect: allNotes.filter((n) => n === "ADDRESS_SUSPECT").length,
    countMismatch: allNotes.filter((n) => n === "COUNT_MISMATCH").length,
    phoneInvalid: allNotes.filter((n) => n === "PHONE_INVALID").length,
    invoiceMissing: allNotes.filter((n) => n === "INVOICE_MISSING").length,
    autoCorrected: allNotes.filter((n) => n === "AUTO_CORRECTED_BY_HISTORY").length,
    confirmed: items.filter((i) => i.ocrStatus === "CONFIRMED").length,
    reviewRequired: items.filter((i) => i.ocrStatus === "REVIEW_REQUIRED").length,
    ocrUsage: usageStats,
  };

  return NextResponse.json(stats);
}
