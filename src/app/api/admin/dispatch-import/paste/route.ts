import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { parsePasteText } from "@/lib/import/paste/paste-parser";
import { autoRescueRows } from "@/lib/import/auto-rescue";
import { saveImportBatch, calcBatchStats } from "@/lib/import/pipeline";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { text, waveNo } = await req.json();
  if (!text) return NextResponse.json({ error: "text が必要です" }, { status: 400 });

  const rows = parsePasteText(text, waveNo);
  const rescued = await autoRescueRows(rows);
  const stats = calcBatchStats(rescued);
  const batchId = await saveImportBatch({ batchId: "", source: "paste", ...stats, rows: rescued }, session.user.id);

  return NextResponse.json({ batchId, ...stats });
}
