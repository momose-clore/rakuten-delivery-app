import type { ParsedDeliveryItem, ReviewReason } from "./types";

export type Confidence = "high" | "medium" | "low";

export function assessConfidence(
  item: ParsedDeliveryItem,
  allItems: ParsedDeliveryItem[]
): { confidence: Confidence; reasons: ReviewReason[] } {
  const reasons: ReviewReason[] = [...(item.reviewReasons ?? [])];

  if (!item.dispatchKey) reasons.push("DISPATCH_KEY_MISSING");
  if (!item.waveNo) reasons.push("WAVE_NO_MISSING");
  if (!item.vehicleNo) reasons.push("VEHICLE_NO_MISSING");
  if (!item.invoiceNo) reasons.push("INVOICE_MISSING");

  if (!item.address || item.address.trim().length < 3) {
    reasons.push("ADDRESS_EMPTY");
  }

  if (item.customerPhone) {
    const digits = item.customerPhone.replace(/[\s\-]/g, "");
    if (!/^0\d{9,10}$/.test(digits)) reasons.push("PHONE_INVALID");
  }

  const n = item.normalOriconCount ?? 0;
  const c = item.coolerBoxCount ?? 0;
  const k = item.caseCount ?? 0;
  const t = item.totalCount ?? 0;
  if (t > 0 && n + c + k !== t) reasons.push("COUNT_MISMATCH");

  if (item.invoiceNo) {
    const dupes = allItems.filter(
      (other) => other !== item && other.invoiceNo === item.invoiceNo
    );
    if (dupes.length > 0) reasons.push("INVOICE_DUPLICATE");
  }

  // 重複除去
  const uniqueReasons = [...new Set(reasons)] as ReviewReason[];

  const criticalCount = uniqueReasons.filter((r) =>
    ["DISPATCH_KEY_MISSING", "ADDRESS_EMPTY", "INVOICE_DUPLICATE"].includes(r)
  ).length;
  const moderateCount = uniqueReasons.filter((r) =>
    ["WAVE_NO_MISSING", "ADDRESS_SUSPECT", "INVOICE_MISSING"].includes(r)
  ).length;
  const lightCount = uniqueReasons.filter((r) =>
    ["PHONE_INVALID", "COUNT_MISMATCH", "VEHICLE_NO_MISSING"].includes(r)
  ).length;

  let confidence: Confidence;
  if (criticalCount === 0 && moderateCount === 0 && lightCount === 0) {
    confidence = "high";
  } else if (criticalCount === 0 && moderateCount + lightCount <= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return { confidence, reasons: uniqueReasons };
}
