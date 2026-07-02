export type OcrStatus =
  | "PENDING"
  | "PROCESSING"
  | "REVIEW_REQUIRED"
  | "CONFIRMED"
  | "ERROR";

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

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  DISPATCH_KEY_MISSING:       "配車No不明",
  WAVE_NO_MISSING:            "W番号不明",
  VEHICLE_NO_MISSING:         "号車番号不明",
  ADDRESS_EMPTY:              "住所空欄",
  ADDRESS_SUSPECT:            "住所要確認",
  PHONE_INVALID:              "電話番号不正",
  COUNT_MISMATCH:             "数量不一致",
  INVOICE_DUPLICATE:          "重複伝票No",
  INVOICE_MISSING:            "伝票No不明",
  AUTO_CORRECTED_BY_HISTORY:  "履歴から自動補正",
};

export interface DeliveryItem {
  id: string;
  dispatchImageId: string;
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
  ocrNotes: string | null; // JSON: ReviewReason[]
  ocrStatus: OcrStatus;
  // 予測値メタデータ（JSON文字列 / 旧データは null）
  fieldStatusJson?: string | null;       // JSON: FieldStatusMap
  fieldSourceJson?: string | null;        // JSON: FieldSourceMap
  predictionWarningsJson?: string | null; // JSON: AnyWarning[]
  createdAt: string;
  updatedAt: string;
}

export interface DispatchImage {
  id: string;
  deliveryDate: string; // ISO date string
  area: string | null;
  waveNo: string | null;
  imageUrl: string;
  ocrStatus: OcrStatus;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
}
