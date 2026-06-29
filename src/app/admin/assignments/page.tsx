import { AssignmentClient } from "@/components/assignments/AssignmentClient";

export default function AssignmentsPage() {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">割当機能</h1>
        <p className="mt-1 text-sm text-gray-500">
          確定済みOCR配送明細を稼働ドライバーへ割り当てます
        </p>
      </div>
      <AssignmentClient />
    </div>
  );
}
