import type { ParsedDeliveryItem, ReviewReason } from "./types";

const PHONE_RE = /^0\d{9,10}$/;

export function validateItem(
  item: ParsedDeliveryItem,
  allItems: ParsedDeliveryItem[]
): ReviewReason[] {
  const reasons: ReviewReason[] = [];

  if (!item.dispatchKey) reasons.push("DISPATCH_KEY_MISSING");
  if (!item.waveNo) reasons.push("WAVE_NO_MISSING");
  if (!item.vehicleNo) reasons.push("VEHICLE_NO_MISSING");

  if (!item.address || item.address.trim() === "") {
    reasons.push("ADDRESS_EMPTY");
  }

  if (item.customerPhone) {
    const digits = item.customerPhone.replace(/[-\s()]/g, "");
    if (!PHONE_RE.test(digits)) reasons.push("PHONE_INVALID");
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

  return reasons;
}
