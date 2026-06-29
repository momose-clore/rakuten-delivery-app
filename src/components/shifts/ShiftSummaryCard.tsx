interface ShiftSummaryCardProps {
  total: number;
  confirmedCount: number;
  tentativeCount: number;
  companyBreakdown: Record<string, number>;
  areaBreakdown: Record<string, number>;
}

export function ShiftSummaryCard({
  total,
  confirmedCount,
  tentativeCount,
  companyBreakdown,
  areaBreakdown,
}: ShiftSummaryCardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* 稼働サマリー */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 col-span-1">
        <p className="text-xs font-medium text-gray-500 mb-3">稼働サマリー</p>
        <div className="space-y-2">
          <Row label="稼働可能" value={`${total} 人`} bold />
          <Row label="シフト確定" value={`${confirmedCount} 人`} color="text-green-700" />
          <Row label="仮シフト"   value={`${tentativeCount} 人`} color="text-orange-600" />
        </div>
      </div>

      {/* 会社別 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">会社別</p>
        <div className="space-y-2">
          {Object.entries(companyBreakdown).map(([company, count]) => (
            <Row key={company} label={company} value={`${count} 人`} />
          ))}
          {Object.keys(companyBreakdown).length === 0 && (
            <p className="text-xs text-gray-400">データなし</p>
          )}
        </div>
      </div>

      {/* エリア別 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">エリア別</p>
        <div className="space-y-2">
          {Object.entries(areaBreakdown).map(([area, count]) => (
            <Row key={area} label={area} value={`${count} 人`} />
          ))}
          {Object.keys(areaBreakdown).length === 0 && (
            <p className="text-xs text-gray-400">データなし</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium ${bold ? "text-gray-900" : ""} ${color ?? "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
}
