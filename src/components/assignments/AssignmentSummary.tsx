import type { AssignmentSummary } from "@/types/assignment";

interface Props {
  summary: AssignmentSummary;
}

export function AssignmentSummaryCard({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="対象件数" value={summary.totalItems} />
      <Stat label="未割当" value={summary.unassignedCount} highlight={summary.unassignedCount > 0} />
      <Stat label="割当済み" value={summary.assignedCount} green />
      <Stat label="稼働ドライバー" value={summary.driverCount} />

      {Object.keys(summary.driverBreakdown).length > 0 && (
        <div className="col-span-2 sm:col-span-4 bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">ドライバー別割当件数</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(summary.driverBreakdown).map(([name, count]) => (
              <div key={name} className="flex items-center gap-1.5">
                <span className="text-sm text-gray-700">{name}</span>
                <span className="text-sm font-bold text-blue-700">{count} 件</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(summary.waveBreakdown).length > 0 && (
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">W番号別</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.waveBreakdown).sort().map(([wave, count]) => (
              <span key={wave} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                {wave}: {count}件
              </span>
            ))}
          </div>
        </div>
      )}

      {Object.keys(summary.vehicleBreakdown).length > 0 && (
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">号車別</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.vehicleBreakdown).sort().map(([v, count]) => (
              <span key={v} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                {v}号車: {count}件
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight, green }: { label: string; value: number; highlight?: boolean; green?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${highlight ? "text-red-600" : green ? "text-green-700" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}
