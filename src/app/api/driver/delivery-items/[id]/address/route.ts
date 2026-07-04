import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/**
 * クルーが配送先の住所を手動修正する（OCR/AI誤読の現場修正）。
 * - 本人担当のみ。
 * - 手動修正した住所は再取込/再OCRで上書きされないよう coordinateStatus=MANUAL_FIXED に保護
 *   （予測値誤適用対策の方針：MANUAL_FIXED は自動処理で上書き禁止）。
 * - 住所が変わると既存ピンは無効になるため lat/lng をクリア→ナビは新住所の文字列で行う。
 * - 住所（PII）は console.log しない。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  const { id: deliveryItemId } = await params;
  const { address } = (await req.json()) as { address?: string };
  const trimmed = (address ?? "").trim();
  if (!trimmed) return NextResponse.json({ error: "住所を入力してください" }, { status: 400 });

  const assignment = await prisma.assignment.findFirst({ where: { deliveryItemId, driverId } });
  if (!assignment) {
    return NextResponse.json({ error: "この配送先を修正する権限がありません" }, { status: 403 });
  }

  await prisma.deliveryItem.update({
    where: { id: deliveryItemId },
    data: {
      address: trimmed,
      // 住所変更でピンは無効化→新住所でナビ。手動修正として保護（再取込で上書きしない）。
      lat: null,
      lng: null,
      coordinateStatus: "MANUAL_FIXED",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DRIVER_EDIT_ADDRESS",
      targetType: "delivery_items",
      targetId: deliveryItemId,
    },
  });

  return NextResponse.json({ success: true, deliveryItemId, address: trimmed });
}
