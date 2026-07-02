/**
 * 監査ログヘルパー
 * - targetId は HMAC-SHA256 でハッシュ化（逆検索不可）
 * - 個人情報（氏名・住所・電話番号・伝票No の値）は一切保存しない
 * - 閲覧は ADMIN ロールのみ（AUDIT ロールは今回のスコープ外）
 */
import { prisma } from "@/lib/prisma";
import type { ValueSource, ValueStatus } from "@/types/prediction";
import { hashWithSalt } from "@/lib/security/hash";

/** targetId を HMAC-SHA256 でハッシュ化（NEXTAUTH_SECRET or AUDIT_LOG_HASH_SALT をソルトとして使用） */
function hashTargetId(targetId: string): string {
  return hashWithSalt(targetId, "audit_target_id");
}

/** 予測値操作の監査ログパラメータ */
export interface PredictionAuditParams {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  fieldName?: string;
  source?: ValueSource;
  status?: ValueStatus;
  reason?: string;
  /** afterData に渡す追加情報（個人情報を含まないこと） */
  meta?: Record<string, unknown>;
}

/**
 * 予測値操作を監査ログに記録する
 * - targetId は hash化して保存
 * - fieldName・source・status のみ記録（値は保存しない）
 * - 個人情報（住所・氏名・電話・伝票No の値）は含めない
 */
export async function recordPredictionAudit(params: PredictionAuditParams): Promise<void> {
  const targetIdHash = hashTargetId(params.targetId);

  await prisma.auditLog.create({
    data: {
      userId:      params.actorUserId,
      action:      params.action,
      targetType:  params.targetType,
      targetId:    params.targetId, // 既存FK互換のため保持
      targetIdHash,
      fieldName:   params.fieldName ?? null,
      source:      params.source ?? null,
      status:      params.status ?? null,
      reason:      params.reason ?? null,
      afterData:   params.meta ? JSON.parse(JSON.stringify(params.meta)) : undefined,
    },
  });
}

/** 定義済み予測値監査アクション */
export const PREDICTION_AUDIT_ACTIONS = {
  PREDICTED_VALUE_CREATED:     "PREDICTED_VALUE_CREATED",
  PREDICTED_VALUE_APPLIED:     "PREDICTED_VALUE_APPLIED",
  PREDICTED_VALUE_CONFIRMED:   "PREDICTED_VALUE_CONFIRMED",
  PREDICTED_VALUE_REJECTED:    "PREDICTED_VALUE_REJECTED",
  LOW_CONFIDENCE_DETECTED:     "LOW_CONFIDENCE_VALUE_DETECTED",
  MANUAL_VALUE_PROTECTED:      "MANUAL_VALUE_PROTECTED",
  AUTO_OVERWRITE_BLOCKED:      "AUTO_OVERWRITE_BLOCKED",
  COORDINATE_ESTIMATED:        "COORDINATE_ESTIMATED",
  COORDINATE_APPROVED:         "COORDINATE_APPROVED",
} as const;

/**
 * 監査ログ一覧取得（ADMIN 限定）
 * - 個人情報を含まないカラムのみ select
 */
export async function getAuditLogs(
  userId: string,
  filter?: { action?: string; fieldName?: string; limit?: number }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ADMIN") {
    throw new Error("Unauthorized: ADMIN ロールが必要です");
  }

  return prisma.auditLog.findMany({
    where: {
      ...(filter?.action    && { action: filter.action }),
      ...(filter?.fieldName && { fieldName: filter.fieldName }),
    },
    select: {
      id:          true,
      action:      true,
      targetType:  true,
      targetIdHash: true,  // hash のみ返す（raw targetId は返さない）
      fieldName:   true,
      source:      true,
      status:      true,
      reason:      true,
      createdAt:   true,
      // 個人情報を含む可能性のある beforeData / afterData は返さない
    },
    orderBy: { createdAt: "desc" },
    take: filter?.limit ?? 100,
  });
}
