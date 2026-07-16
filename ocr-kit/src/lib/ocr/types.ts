export type ReviewReason =
  | "DISPATCH_KEY_MISSING"
  | "WAVE_NO_MISSING"
  | "VEHICLE_NO_MISSING"
  | "ADDRESS_EMPTY"
  | "ADDRESS_SUSPECT"
  | "PHONE_INVALID"
  | "COUNT_MISMATCH"
  | "INVOICE_DUPLICATE"
  | "INVOICE_MISSING"
  | "AUTO_CORRECTED_BY_HISTORY";

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
