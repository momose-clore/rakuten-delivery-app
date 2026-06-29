export type ReviewReason =
  | "DISPATCH_KEY_MISSING"
  | "WAVE_NO_MISSING"
  | "VEHICLE_NO_MISSING"
  | "ADDRESS_EMPTY"
  | "PHONE_INVALID"
  | "COUNT_MISMATCH"
  | "INVOICE_DUPLICATE";

export interface ParsedDeliveryItem {
  dispatchKey: string | null;
  waveNo: string | null;
  vehicleNo: string | null;
  deliverySeq: number | null;
  invoiceNo: string | null;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  specialFlag: string | null;
  normalOriconCount: number | null;
  coolerBoxCount: number | null;
  caseCount: number | null;
  totalCount: number | null;
  memo: string | null;
  reviewReasons: ReviewReason[];
}

export interface OcrRunResult {
  dispatchImageId: string;
  itemCount: number;
  reviewCount: number;
  errorCount: number;
}
