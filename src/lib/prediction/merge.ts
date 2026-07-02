/**
 * mergeFieldMetadata - フィールドメタデータ統合処理
 *
 * OCR再実行・Geocode再実行・手動編集・管理者承認時に
 * 既存メタデータと新規メタデータをマージする。
 * MANUAL_FIXED / ADMIN_APPROVED フィールドは上書きしない。
 */
import {
  parseFieldSourceJson,
  parseFieldStatusJson,
  parsePredictionWarnings,
  OCR_DERIVED_FIELDS,
} from "./metadata";
import type {
  ValueSource, ValueStatus,
  AnyWarning, FieldSourceMap, FieldStatusMap,
} from "@/types/prediction";
import { isOverwriteProtected } from "@/types/prediction";

// ─── 型定義 ─────────────────────────────────────

export type MergeOperation =
  | "OCR_RETRY"
  | "GEOCODE_RETRY"
  | "MANUAL_EDIT"
  | "ADMIN_APPROVE"
  | "LOCATION_OVERRIDE_APPLY"
  | "IMPORT_FILE";

export interface MergeFieldMetadataInput {
  existingSource?:   string | null;
  existingStatus?:   string | null;
  existingWarnings?: string | null;

  incomingSource?:   FieldSourceMap;
  incomingStatus?:   FieldStatusMap;
  incomingWarnings?: AnyWarning[];

  operation: MergeOperation;
  actorUserId?: string;
}

export interface MergeFieldMetadataResult {
  mergedSourceJson:   string;
  mergedStatusJson:   string;
  mergedWarningsJson: string;
  blockedFields:      string[];
  auditEntries: Array<{
    action:     string;
    fieldName:  string;
    source?:    ValueSource;
    status?:    ValueStatus;
    reason?:    string;
    actorUserId?: string;
  }>;
}

// ─── 操作別更新可能フィールド定義 ────────────────

const OCR_UPDATABLE_FIELDS = new Set(OCR_DERIVED_FIELDS as readonly string[]);

const GEOCODE_UPDATABLE_FIELDS = new Set([
  "lat", "lng", "placeId", "geocodeConfidence", "geocodeStatus",
  "coordinateSource", "coordinateStatus", "coordinateConfidence",
]);

/** 操作種別ごとに更新対象フィールドかを判定 */
function isUpdatableByOperation(
  fieldName: string,
  operation: MergeOperation
): boolean {
  switch (operation) {
    case "OCR_RETRY":
      return OCR_UPDATABLE_FIELDS.has(fieldName);
    case "GEOCODE_RETRY":
      return GEOCODE_UPDATABLE_FIELDS.has(fieldName);
    case "MANUAL_EDIT":
    case "ADMIN_APPROVE":
    case "LOCATION_OVERRIDE_APPLY":
    case "IMPORT_FILE":
      return true; // 対象フィールドは全て更新可能（保護チェックで絞る）
  }
}

/** 操作種別から付与するステータスを決定 */
function resolveStatusForOperation(
  proposedStatus: ValueStatus | undefined,
  operation: MergeOperation
): ValueStatus {
  switch (operation) {
    case "MANUAL_EDIT":       return "MANUAL_FIXED";
    case "ADMIN_APPROVE":     return "ADMIN_APPROVED";
    case "LOCATION_OVERRIDE_APPLY": return "ADMIN_APPROVED";
    case "OCR_RETRY":         return proposedStatus ?? "RAW";
    case "GEOCODE_RETRY":     return proposedStatus ?? "ESTIMATED";
    case "IMPORT_FILE":       return proposedStatus ?? "RAW";
  }
}

/** 操作種別から付与するソースを決定 */
function resolveSourceForOperation(
  proposedSource: ValueSource | undefined,
  operation: MergeOperation
): ValueSource {
  switch (operation) {
    case "MANUAL_EDIT":             return "MANUAL_EDIT";
    case "ADMIN_APPROVE":           return "ADMIN_APPROVED";
    case "LOCATION_OVERRIDE_APPLY": return "LOCATION_OVERRIDE";
    case "GEOCODE_RETRY":           return "GOOGLE_GEOCODE";
    case "OCR_RETRY":               return proposedSource ?? "OCR_RAW";
    case "IMPORT_FILE":             return proposedSource ?? "IMPORT_FILE";
  }
}

// ─── メイン関数 ──────────────────────────────────

export function mergeFieldMetadata(
  input: MergeFieldMetadataInput
): MergeFieldMetadataResult {
  const existingSourceMap  = parseFieldSourceJson(input.existingSource ?? null);
  const existingStatusMap  = parseFieldStatusJson(input.existingStatus ?? null);
  const existingWarnings   = parsePredictionWarnings(input.existingWarnings ?? null);

  const incomingSourceMap  = input.incomingSource ?? {};
  const incomingStatusMap  = input.incomingStatus ?? {};
  const incomingWarnings   = input.incomingWarnings ?? [];

  const mergedSource: FieldSourceMap  = { ...existingSourceMap };
  const mergedStatus: FieldStatusMap  = { ...existingStatusMap };
  const blockedFields: string[] = [];
  const auditEntries: MergeFieldMetadataResult["auditEntries"] = [];

  // 全更新候補フィールドを収集
  const allFields = new Set([
    ...Object.keys(incomingSourceMap),
    ...Object.keys(incomingStatusMap),
  ]);

  for (const fieldName of allFields) {
    // 操作種別で更新対象か判定
    if (!isUpdatableByOperation(fieldName, input.operation)) continue;

    const existingStatus = existingStatusMap[fieldName];

    // 保護フィールドは上書きしない
    if (existingStatus && isOverwriteProtected(existingStatus as ValueStatus)) {
      blockedFields.push(fieldName);
      auditEntries.push({
        action:    "AUTO_OVERWRITE_BLOCKED",
        fieldName,
        source:    incomingSourceMap[fieldName],
        status:    existingStatus as ValueStatus,
        reason:    `${fieldName} は ${existingStatus} のため上書き不可`,
        actorUserId: input.actorUserId,
      });
      continue;
    }

    // ソースとステータスを更新
    const newSource = resolveSourceForOperation(incomingSourceMap[fieldName], input.operation);
    const newStatus = resolveStatusForOperation(incomingStatusMap[fieldName], input.operation);

    mergedSource[fieldName] = newSource;
    mergedStatus[fieldName] = newStatus;
  }

  // 警告をマージ（重複排除）
  const warningSet = new Set([...existingWarnings, ...incomingWarnings]);

  return {
    mergedSourceJson:   JSON.stringify(mergedSource),
    mergedStatusJson:   JSON.stringify(mergedStatus),
    mergedWarningsJson: JSON.stringify([...warningSet]),
    blockedFields,
    auditEntries,
  };
}
