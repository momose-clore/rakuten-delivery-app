/**
 * 保護フィールド抽出ロジック
 * ADMIN_APPROVED / MANUAL_FIXED フィールドを自動処理で変更しない
 */
import { parseFieldStatusJson } from "./metadata";
import { isOverwriteProtected } from "@/types/prediction";
import type { ValueStatus } from "@/types/prediction";

export interface ProtectedFieldInfo {
  fieldName: string;
  status: ValueStatus;
  protectedSince?: string | null;
}

/**
 * fieldStatusJson から上書き保護されているフィールドを抽出する
 */
export function extractProtectedFields(
  fieldStatusJson: string | null | undefined
): ProtectedFieldInfo[] {
  const statusMap = parseFieldStatusJson(fieldStatusJson ?? null);
  const protected_: ProtectedFieldInfo[] = [];

  for (const [fieldName, status] of Object.entries(statusMap)) {
    if (status && isOverwriteProtected(status as ValueStatus)) {
      protected_.push({ fieldName, status: status as ValueStatus });
    }
  }

  return protected_;
}

/**
 * 指定フィールドが保護されているかを判定
 */
export function isFieldProtected(
  fieldStatusJson: string | null | undefined,
  fieldName: string
): boolean {
  const statusMap = parseFieldStatusJson(fieldStatusJson ?? null);
  const status = statusMap[fieldName];
  return !!status && isOverwriteProtected(status as ValueStatus);
}

/**
 * 保護フィールドのサマリーテキスト（UI表示用）
 */
export function formatProtectedFieldsSummary(fields: ProtectedFieldInfo[]): string[] {
  const LABEL: Record<string, string> = {
    dispatchKey:       "配車No",
    invoiceNo:         "伝票No",
    address:           "住所",
    customerName:      "氏名",
    customerPhone:     "電話番号",
    normalOriconCount: "常温オリコン数",
    coolerBoxCount:    "クーラーボックス数",
    caseCount:         "ケース数",
    totalCount:        "総数",
    lat:               "緯度",
    lng:               "経度",
    memo:              "備考",
  };

  return fields.map((f) => {
    const label = LABEL[f.fieldName] ?? f.fieldName;
    const statusLabel = f.status === "ADMIN_APPROVED" ? "承認済み" : "手動修正済み";
    return `${label}（${statusLabel}）`;
  });
}
