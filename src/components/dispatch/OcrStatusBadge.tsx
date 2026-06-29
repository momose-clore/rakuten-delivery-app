import type { OcrStatus } from "@/types/dispatch";

const STATUS_CONFIG: Record<OcrStatus, { label: string; className: string }> = {
  PENDING:          { label: "未処理",   className: "bg-gray-100 text-gray-600" },
  PROCESSING:       { label: "処理中",   className: "bg-yellow-100 text-yellow-700" },
  REVIEW_REQUIRED:  { label: "要確認",   className: "bg-orange-100 text-orange-700" },
  CONFIRMED:        { label: "完了",     className: "bg-green-100 text-green-700" },
  ERROR:            { label: "エラー",   className: "bg-red-100 text-red-700" },
};

export function OcrStatusBadge({ status }: { status: OcrStatus }) {
  const { label, className } = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
