import type { DeliveryItem, OcrStatus } from "@/types/dispatch";
import type { ReviewReason } from "@/lib/ocr/types";
import { parseDispatchKey } from "./dispatch-no";

const PHONE_RE = /^0\d{9,10}$/;

interface RevalidateResult {
  waveNo: string | null;
  vehicleNo: string | null;
  deliverySeq: number | null;
  dispatchKey: string | null;
  ocrNotes: string | null;
  ocrStatus: OcrStatus;
}

/**
 * 編集後の DeliveryItem を再バリデーションし、
 * 更新すべきフィールドを返す。個人情報はログに出さない。
 */
export function revalidateDeliveryItem(
  item: DeliveryItem,
  siblings: DeliveryItem[]
): RevalidateResult {
  const reasons: ReviewReason[] = [];

  // 配車No再分解
  const keyParts = item.dispatchKey
    ? parseDispatchKey(item.dispatchKey)
    : null;

  const waveNo = keyParts?.waveNo ?? item.waveNo;
  const vehicleNo = keyParts?.vehicleNo ?? item.vehicleNo;
  const deliverySeq = keyParts?.deliverySeq ?? item.deliverySeq;
  const dispatchKey = keyParts?.dispatchKey ?? item.dispatchKey;

  if (!dispatchKey) reasons.push("DISPATCH_KEY_MISSING");
  if (!waveNo) reasons.push("WAVE_NO_MISSING");
  if (!vehicleNo) reasons.push("VEHICLE_NO_MISSING");

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
    const dupes = siblings.filter(
      (s) => s.id !== item.id && s.invoiceNo === item.invoiceNo
    );
    if (dupes.length > 0) reasons.push("INVOICE_DUPLICATE");
  }

  return {
    waveNo: waveNo ?? null,
    vehicleNo: vehicleNo ?? null,
    deliverySeq: deliverySeq ?? null,
    dispatchKey: dispatchKey ?? null,
    ocrNotes: reasons.length > 0 ? JSON.stringify(reasons) : null,
    ocrStatus: reasons.length > 0 ? "REVIEW_REQUIRED" : "PENDING",
  };
}
