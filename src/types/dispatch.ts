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

/** 要確認理由の詳細説明（レビュー効率化・#9） */
export const REVIEW_REASON_DETAILS: Record<ReviewReason, string> = {
  DISPATCH_KEY_MISSING:       "配車No（W番号-号車-順）が読み取れませんでした。原本を確認して入力してください。",
  WAVE_NO_MISSING:            "W番号が読み取れませんでした。",
  VEHICLE_NO_MISSING:         "号車番号が読み取れませんでした。",
  ADDRESS_EMPTY:              "住所が空欄です。配送に必須のため確認してください。",
  ADDRESS_SUSPECT:            "住所の構造が弱く、市区町村や番地が欠けている可能性があります。",
  PHONE_INVALID:              "電話番号の形式が不自然です（住所列からの混入の可能性）。",
  COUNT_MISMATCH:             "常温+クーラー+ケースの合計が総数と一致していません。",
  INVOICE_DUPLICATE:          "同じ伝票Noが他の行と重複しています。",
  INVOICE_MISSING:            "伝票Noが読み取れませんでした。",
  AUTO_CORRECTED_BY_HISTORY:  "自動救済で補正済みです。念のため内容を確認してください。",
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
