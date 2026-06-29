import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import type { DashboardStats } from "@/types/progress";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // 対象日の dispatch_images
  const images = await prisma.dispatchImage.findMany({
    where: { deliveryDate: { gte: targetDate, lt: nextDate } },
  });
  const imageIds = images.map((i) => i.id);

  const ocrPendingCount = images.filter((i) =>
    ["PENDING", "PROCESSING", "REVIEW_REQUIRED", "ERROR"].includes(i.ocrStatus)
  ).length;

  // delivery_items（対象日）
  const deliveryItems = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: { in: imageIds } },
    select: {
      id: true,
      deliveryStatus: true,
      ocrNotes: true,
      assignments: { select: { id: true } },
    },
  });

  const addressErrorCount = deliveryItems.filter((i) => i.deliveryStatus === "ADDRESS_ERROR").length;
  const countMismatchCount = deliveryItems.filter((i) => {
    try { return (JSON.parse(i.ocrNotes ?? "[]") as string[]).includes("COUNT_MISMATCH"); }
    catch { return false; }
  }).length;
  const unassignedCount = deliveryItems.filter((i) => i.assignments.length === 0).length;
  const assignedCount = deliveryItems.filter((i) => i.deliveryStatus === "ASSIGNED").length;
  const completedCount = deliveryItems.filter((i) => i.deliveryStatus === "COMPLETED").length;
  const absentCount = deliveryItems.filter((i) => i.deliveryStatus === "ABSENT").length;
  const returnedCount = deliveryItems.filter((i) => i.deliveryStatus === "RETURNED").length;
  const skippedCount = deliveryItems.filter((i) => i.deliveryStatus === "SKIPPED").length;
  const inProgressCount = deliveryItems.filter((i) =>
    ["ASSIGNED", "IN_DELIVERY"].includes(i.deliveryStatus)
  ).length;

  // 稼働予定ドライバー数
  const activeDriverCount = await prisma.shift.count({
    where: { workDate: { gte: targetDate, lt: nextDate }, status: { not: "ABSENT" } },
  });

  const stats: DashboardStats = {
    date: targetDate.toISOString().split("T")[0],
    dispatchImageCount: images.length,
    ocrPendingCount,
    addressErrorCount,
    countMismatchCount,
    unassignedCount,
    activeDriverCount,
    assignedCount,
    completedCount,
    absentCount,
    returnedCount,
    skippedCount,
    inProgressCount,
  };

  return NextResponse.json(stats);
}
