import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { revalidateDeliveryItem } from "@/lib/ocr/revalidate";
import type { DeliveryItem } from "@/types/dispatch";

// 編集を許可するフィールドの whitelist
const EDITABLE_FIELDS = [
  "dispatchKey",
  "invoiceNo",
  "customerName",
  "customerPhone",
  "address",
  "specialFlag",
  "normalOriconCount",
  "coolerBoxCount",
  "caseCount",
  "totalCount",
  "memo",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id: dispatchImageId, itemId } = await params;

  const existing = await prisma.deliveryItem.findUnique({ where: { id: itemId } });
  if (!existing || existing.dispatchImageId !== dispatchImageId) {
    return NextResponse.json({ error: "明細が見つかりません" }, { status: 404 });
  }

  const body = await req.json();

  // whitelist 以外のフィールドを除外
  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "更新フィールドがありません" }, { status: 400 });
  }

  // 数値フィールドの型変換
  const numericFields: EditableField[] = [
    "normalOriconCount",
    "coolerBoxCount",
    "caseCount",
    "totalCount",
  ];
  for (const f of numericFields) {
    if (f in updates && updates[f] !== null) {
      updates[f] = Number(updates[f]);
    }
  }

  // 更新を適用して再バリデーション
  const merged: DeliveryItem = {
    id: existing.id,
    dispatchImageId: existing.dispatchImageId,
    dispatchKey: (updates.dispatchKey as string | null) ?? existing.dispatchKey,
    waveNo: existing.waveNo,
    vehicleNo: existing.vehicleNo,
    deliverySeq: existing.deliverySeq,
    invoiceNo: (updates.invoiceNo as string | null) ?? existing.invoiceNo,
    customerName: (updates.customerName as string | null) ?? existing.customerName,
    customerPhone: (updates.customerPhone as string | null) ?? existing.customerPhone,
    address: (updates.address as string | null) ?? existing.address,
    specialFlag: (updates.specialFlag as string | null) ?? existing.specialFlag,
    normalOriconCount: (updates.normalOriconCount as number | null) ?? existing.normalOriconCount,
    coolerBoxCount: (updates.coolerBoxCount as number | null) ?? existing.coolerBoxCount,
    caseCount: (updates.caseCount as number | null) ?? existing.caseCount,
    totalCount: (updates.totalCount as number | null) ?? existing.totalCount,
    memo: (updates.memo as string | null) ?? existing.memo,
    ocrNotes: existing.ocrNotes,
    ocrStatus: existing.ocrStatus,
    createdAt: existing.createdAt.toISOString(),
    updatedAt: existing.updatedAt.toISOString(),
  };

  const siblings = await prisma.deliveryItem.findMany({
    where: { dispatchImageId, id: { not: itemId } },
  });
  const siblingsMapped: DeliveryItem[] = siblings.map((s) => ({
    id: s.id,
    dispatchImageId: s.dispatchImageId,
    dispatchKey: s.dispatchKey,
    waveNo: s.waveNo,
    vehicleNo: s.vehicleNo,
    deliverySeq: s.deliverySeq,
    invoiceNo: s.invoiceNo,
    customerName: s.customerName,
    customerPhone: s.customerPhone,
    address: s.address,
    specialFlag: s.specialFlag,
    normalOriconCount: s.normalOriconCount,
    coolerBoxCount: s.coolerBoxCount,
    caseCount: s.caseCount,
    totalCount: s.totalCount,
    memo: s.memo,
    ocrNotes: s.ocrNotes,
    ocrStatus: s.ocrStatus,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const revalidated = revalidateDeliveryItem(merged, siblingsMapped);

  const updated = await prisma.deliveryItem.update({
    where: { id: itemId },
    data: {
      ...updates,
      waveNo: revalidated.waveNo,
      vehicleNo: revalidated.vehicleNo,
      deliverySeq: revalidated.deliverySeq,
      dispatchKey: revalidated.dispatchKey,
      ocrNotes: revalidated.ocrNotes,
      ocrStatus: revalidated.ocrStatus,
    },
  });

  // 監査ログ（フィールド名のみ記録。値は個人情報を含む可能性があるため省略）
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "EDIT_DELIVERY_ITEM",
      targetType: "delivery_items",
      targetId: itemId,
      beforeData: { ocrStatus: existing.ocrStatus, ocrNotes: existing.ocrNotes, editedFields: Object.keys(updates) },
      afterData: { ocrStatus: updated.ocrStatus, ocrNotes: updated.ocrNotes, editedFields: Object.keys(updates) },
    },
  });

  return NextResponse.json({ deliveryItem: updated });
}
