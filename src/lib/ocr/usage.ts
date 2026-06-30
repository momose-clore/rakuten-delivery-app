import { prisma } from "@/lib/prisma";
import type { Confidence } from "./confidence";

const DAILY_LIMIT = parseInt(process.env.OCR_DAILY_LIMIT ?? "180", 10);

/** 本日のOCR.space実行回数を取得 */
export async function getTodayUsage(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.ocrUsageLog.count({
    where: {
      provider: "ocrspace",
      status: { not: "skipped" },
      createdAt: { gte: today, lt: tomorrow },
    },
  });
}

/** 日次上限チェック */
export async function checkDailyLimit(): Promise<{ ok: boolean; used: number; limit: number }> {
  const used = await getTodayUsage();
  return { ok: used < DAILY_LIMIT, used, limit: DAILY_LIMIT };
}

/** OCR使用ログを記録 */
export async function logOcrUsage(params: {
  dispatchImageId?: string;
  imageHash?: string;
  status: "success" | "error" | "skipped" | "reocr";
  confidence?: Confidence;
  itemCount?: number;
  errorMessage?: string;
}): Promise<void> {
  await prisma.ocrUsageLog.create({
    data: {
      provider: "ocrspace",
      dispatchImageId: params.dispatchImageId ?? null,
      imageHash: params.imageHash ?? null,
      status: params.status,
      confidence: params.confidence ?? null,
      itemCount: params.itemCount ?? null,
      errorMessage: params.errorMessage ?? null,
    },
  });
}

/** 管理画面用: 本日のOCR統計 */
export async function getTodayStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const logs = await prisma.ocrUsageLog.findMany({
    where: { createdAt: { gte: today, lt: tomorrow } },
  });

  return {
    total: logs.length,
    success: logs.filter((l) => l.status === "success").length,
    error: logs.filter((l) => l.status === "error").length,
    skipped: logs.filter((l) => l.status === "skipped").length,
    reocr: logs.filter((l) => l.status === "reocr").length,
    lowConfidence: logs.filter((l) => l.confidence === "low").length,
    limit: DAILY_LIMIT,
  };
}
