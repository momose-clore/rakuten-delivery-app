/**
 * 共通正規化パイプライン
 * PDF/CSV/Excel/貼り付け/画像OCR/スマホカメラOCR → NormalizedDispatchRow[]
 */
import { prisma } from "@/lib/prisma";
import type { NormalizedDispatchRow, ImportBatchResult } from "@/types/import";
import type { RescuedRow } from "@/lib/import/auto-rescue";

/** 正規化済み行をDBに保存する共通処理 */
export async function saveImportBatch(
  result: ImportBatchResult,
  userId: string
): Promise<string> {
  const batch = await prisma.dispatchImportBatch.create({
    data: {
      sourceType: result.source,
      status: "review",
      totalRows: result.totalRows,
      highCount: result.highCount,
      mediumCount: result.mediumCount,
      lowCount: result.lowCount,
      autoRescuedCount: result.autoRescuedCount,
      needsReviewCount: result.needsReviewCount,
      qualityScore: result.qualityScore ?? null,
      qualityLevel: result.qualityLevel ?? null,
      layoutProfile: result.layoutProfile ?? null,
      depotName: result.depotName ?? null,
      waveNo: result.waveNo ?? null,
      vehicleNo: result.vehicleNo ?? null,
      deliveryDate: result.deliveryDate ? new Date(result.deliveryDate) : null,
    },
  });

  // dispatch_images レコードを作成（既存フローとの互換性）
  const dateVal = result.deliveryDate ? new Date(result.deliveryDate) : new Date();
  const dispatchImage = await prisma.dispatchImage.create({
    data: {
      deliveryDate: dateVal,
      area: result.depotName ?? null,
      waveNo: result.waveNo ?? null,
      imageUrl: result.source === "image_ocr" || result.source === "camera_ocr"
        ? "" : `import:${batch.id}`,
      ocrStatus: "REVIEW_REQUIRED",
      ocrProvider: result.source,
    },
  });

  // delivery_items を一括 INSERT
  for (const row of result.rows) {
    const rescued = row as RescuedRow;
    const item = await prisma.deliveryItem.create({
      data: {
        dispatchImageId: dispatchImage.id,
        dispatchKey: row.dispatchKey,
        waveNo: row.waveNo ?? null,
        vehicleNo: row.dispatchKey?.split("-")[1] ?? null,
        deliverySeq: row.dispatchKey ? parseInt(row.dispatchKey.split("-").pop() ?? "0", 10) : null,
        invoiceNo: row.invoiceNo,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        address: row.address,
        specialFlag: row.specialFlag ?? null,
        normalOriconCount: row.normalOriconCount,
        coolerBoxCount: row.coolerBoxCount,
        caseCount: row.caseCount,
        totalCount: row.totalCount,
        memo: row.memo ?? null,
        ocrNotes: row.notes.length > 0 ? JSON.stringify(row.notes) : null,
        ocrStatus: row.notes.length > 0 ? "REVIEW_REQUIRED" : "PENDING",
        deliveryStatus: "PENDING_OCR",
        // 予測値メタデータ
        fieldSourceJson:        rescued.fieldSourceJson ?? null,
        fieldStatusJson:        rescued.fieldStatusJson ?? null,
        predictionWarningsJson: rescued.predictionWarningsJson ?? null,
      },
    });

    await prisma.dispatchImportRow.create({
      data: {
        batchId: batch.id,
        deliveryItemId: item.id,
        rowNo: row.rowNo,
        sourceType: row.source,
        confidence: row.confidence,
        notes: row.notes.length > 0 ? JSON.stringify(row.notes) : null,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: "IMPORT_DISPATCH_BATCH",
      targetType: "dispatch_import_batches",
      targetId: batch.id,
      afterData: {
        source: result.source,
        totalRows: result.totalRows,
        layoutProfile: result.layoutProfile ?? null,
      },
    },
  });

  return batch.id;
}

/**
 * ドライバー自己スキャン取込：OCR結果を本人の本日配送として即反映する。
 * dispatch_image を CONFIRMED・本日日付で作成し、delivery_items を ASSIGNED で作り、
 * スキャンしたドライバーへ assignment を作成する（管理者確認をスキップ）。
 */
export async function saveDriverScan(
  result: ImportBatchResult,
  driverId: string,
  userId: string,
  imageUrl: string
): Promise<{ dispatchImageId: string; itemCount: number; createdCount: number; updatedCount: number; skippedCount: number }> {
  const workDate = new Date();
  workDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(workDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // 同一ドライバー・同日の既存配送を取得し、伝票No / (W番号+配車No) で突合する。
  // 同じ配達予定表を撮り直したら「更新(upsert)」する：新しいOCR結果で内容を上書きしつつ、
  // 完了ステータス・誤配なしフラグ・承認/手動修正済みの座標＆住所は保護する（二重登録もしない）。
  const existingItems = await prisma.deliveryItem.findMany({
    where: {
      assignments: { some: { driverId } },
      dispatchImage: { deliveryDate: { gte: workDate, lt: nextDate } },
    },
    select: { id: true, dispatchKey: true, waveNo: true, invoiceNo: true, coordinateStatus: true },
  });
  type ExistingItem = (typeof existingItems)[number];
  const byInvoice = new Map<string, ExistingItem>();
  const byKey = new Map<string, ExistingItem>();
  for (const it of existingItems) {
    if (it.invoiceNo) byInvoice.set(it.invoiceNo, it);
    if (it.dispatchKey) byKey.set(`${it.waveNo ?? ""}|${it.dispatchKey}`, it);
  }
  const PROTECTED_COORD = new Set(["ADMIN_APPROVED", "MANUAL_FIXED"]);
  const matchedIds = new Set<string>();

  const dispatchImage = await prisma.dispatchImage.create({
    data: {
      deliveryDate: workDate,
      area: result.depotName ?? null,
      waveNo: result.waveNo ?? null,
      imageUrl: imageUrl || "",
      ocrStatus: "CONFIRMED",
      ocrProvider: result.source,
    },
  });

  let order = 1;
  let createdCount = 0;
  let updatedCount = 0;
  for (const row of result.rows) {
    const rescued = row as RescuedRow;
    const vehicleNo = row.dispatchKey?.split("-")[1] ?? null;
    const seq = row.dispatchKey ? parseInt(row.dispatchKey.split("-").pop() ?? "0", 10) : null;

    // 既存突合（伝票No優先→W番号+配車No）。同一取込内で既に処理した行は再突合しない。
    const invoiceKey = row.invoiceNo ?? null;
    const dispatchKeyStr = row.dispatchKey ? `${row.waveNo ?? ""}|${row.dispatchKey}` : null;
    let existing =
      (invoiceKey ? byInvoice.get(invoiceKey) : undefined) ??
      (dispatchKeyStr ? byKey.get(dispatchKeyStr) : undefined) ??
      null;
    if (existing && matchedIds.has(existing.id)) existing = null;

    // 承認/手動修正済みの座標を持つ行は、住所を自動上書きしない（座標との整合を守る）
    const protectedCoord = existing ? PROTECTED_COORD.has(existing.coordinateStatus ?? "") : false;

    const content = {
      dispatchImageId: dispatchImage.id,
      dispatchKey: row.dispatchKey,
      waveNo: row.waveNo ?? null,
      vehicleNo,
      deliverySeq: seq,
      invoiceNo: row.invoiceNo,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      ...(protectedCoord ? {} : { address: row.address }),
      specialFlag: row.specialFlag ?? null,
      normalOriconCount: row.normalOriconCount,
      coolerBoxCount: row.coolerBoxCount,
      caseCount: row.caseCount,
      totalCount: row.totalCount,
      memo: row.memo ?? null,
      ocrNotes: row.notes.length > 0 ? JSON.stringify(row.notes) : null,
      fieldSourceJson:        rescued.fieldSourceJson ?? null,
      fieldStatusJson:        rescued.fieldStatusJson ?? null,
      predictionWarningsJson: rescued.predictionWarningsJson ?? null,
    };

    if (existing) {
      // 更新：deliveryStatus（完了等）・誤配なし・座標は保持し、内容だけ最新OCRで上書き
      await prisma.deliveryItem.update({ where: { id: existing.id }, data: content });
      matchedIds.add(existing.id);
      updatedCount++;
    } else {
      const item = await prisma.deliveryItem.create({
        data: { ...content, address: row.address, ocrStatus: "CONFIRMED", deliveryStatus: "ASSIGNED" },
      });
      await prisma.assignment.create({
        data: { deliveryItemId: item.id, driverId, routeOrder: seq ?? order, waveNo: row.waveNo ?? null, status: "ASSIGNED" },
      });
      matchedIds.add(item.id);
      createdCount++;
    }
    order++;
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: "DRIVER_SCAN_IMPORT",
      targetType: "dispatch_images",
      targetId: dispatchImage.id,
      afterData: { createdCount, updatedCount, source: result.source },
    },
  });

  return { dispatchImageId: dispatchImage.id, itemCount: createdCount + updatedCount, createdCount, updatedCount, skippedCount: 0 };
}

/** 統計を計算 */
export function calcBatchStats(rows: NormalizedDispatchRow[]) {
  return {
    totalRows: rows.length,
    highCount: rows.filter((r) => r.confidence === "high").length,
    mediumCount: rows.filter((r) => r.confidence === "medium").length,
    lowCount: rows.filter((r) => r.confidence === "low").length,
    autoRescuedCount: rows.filter((r) => r.autoRescued).length,
    needsReviewCount: rows.filter((r) => r.notes.includes("NEEDS_REVIEW")).length,
  };
}
