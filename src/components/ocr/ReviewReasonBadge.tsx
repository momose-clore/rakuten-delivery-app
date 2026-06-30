import { REVIEW_REASON_LABELS, type ReviewReason } from "@/types/dispatch";

const BADGE_COLORS: Record<ReviewReason, string> = {
  DISPATCH_KEY_MISSING:       "bg-red-100 text-red-700",
  WAVE_NO_MISSING:            "bg-red-100 text-red-700",
  VEHICLE_NO_MISSING:         "bg-red-100 text-red-700",
  ADDRESS_EMPTY:              "bg-red-100 text-red-700",
  ADDRESS_SUSPECT:            "bg-yellow-100 text-yellow-700",
  INVOICE_DUPLICATE:          "bg-red-100 text-red-700",
  INVOICE_MISSING:            "bg-orange-100 text-orange-700",
  PHONE_INVALID:              "bg-orange-100 text-orange-700",
  COUNT_MISMATCH:             "bg-orange-100 text-orange-700",
  AUTO_CORRECTED_BY_HISTORY:  "bg-blue-100 text-blue-700",
};

interface ReviewReasonBadgeProps {
  reasons: ReviewReason[];
}

export function ReviewReasonBadge({ reasons }: ReviewReasonBadgeProps) {
  if (reasons.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {reasons.map((r) => (
        <span
          key={r}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${BADGE_COLORS[r]}`}
        >
          {REVIEW_REASON_LABELS[r]}
        </span>
      ))}
    </div>
  );
}

export function parseReviewReasons(ocrNotes: string | null): ReviewReason[] {
  if (!ocrNotes) return [];
  try {
    return JSON.parse(ocrNotes) as ReviewReason[];
  } catch {
    return [];
  }
}

export function rowHighlight(reasons: ReviewReason[]): string {
  if (reasons.length === 0) return "";
  const hasRed = reasons.some((r) =>
    ["DISPATCH_KEY_MISSING", "WAVE_NO_MISSING", "VEHICLE_NO_MISSING", "ADDRESS_EMPTY", "INVOICE_DUPLICATE"].includes(r)
  );
  return hasRed ? "border-l-4 border-red-500 bg-red-50" : "border-l-4 border-orange-400 bg-orange-50";
}
