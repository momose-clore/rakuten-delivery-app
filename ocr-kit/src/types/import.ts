export type DispatchImportSource =
  | "pdf_text"
  | "pdf_ocr"
  | "csv"
  | "excel"
  | "paste"
  | "image_ocr"
  | "camera_ocr";

export type ImportConfidence = "high" | "medium" | "low";
export type QualityLevel = "excellent" | "good" | "warning" | "bad" | "unusable";
export type CaptureMode = "screen" | "paper";
export type LayoutProfile = "l1m_cargo_list" | "generic";

export interface NormalizedDispatchRow {
  source: DispatchImportSource;
  rowNo: number;
  deliveryDate?: string;      // YYYY-MM-DD
  area?: string;
  waveNo?: string;
  dispatchKey: string | null;
  invoiceNo: string | null;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  specialFlag?: string | null;
  normalOriconCount: number;
  coolerBoxCount: number;
  caseCount: number;
  totalCount: number;
  memo?: string | null;
  confidence: ImportConfidence;
  notes: string[];            // ReviewReason[]
  autoRescued?: boolean;
  layoutProfile?: LayoutProfile;
}

export interface ImportBatchResult {
  batchId: string;
  source: DispatchImportSource;
  totalRows: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  autoRescuedCount: number;
  needsReviewCount: number;
  rows: NormalizedDispatchRow[];
  qualityScore?: number;
  qualityLevel?: QualityLevel;
  layoutProfile?: LayoutProfile;
  originalFileUrl?: string;
  // L1M メタ情報
  depotName?: string;
  waveNo?: string;
  vehicleNo?: string;
  deliveryDate?: string;
}

export interface L1MMetadata {
  title?: string;
  barcodeText?: string;
  importNumber?: string;
  depotName?: string;
  waveNo?: string;
  deliveryDate?: string;
  vehicleLabel?: string;
  vehicleNo?: string;
  pageInfo?: string;
  summaryNormalOriconCount?: number;
  summaryCoolerBoxCount?: number;
  summaryCaseCount?: number;
  summaryTotalCount?: number;
}
