import { requireAdmin } from "@/lib/auth/permissions";
// セキュリティ状況の正典（担当=α が更新・βは表示のみ）。ビルド時に静的取り込み。
import securityStatus from "../../../../docs/security-status.json";

type Sev = "critical" | "high" | "medium" | "low";
interface Finding {
  id: string;
  severity: Sev;
  title: string;
  area: string;
  status: "open" | "fixed";
  detail: string;
}
interface NotableHigh {
  package: string;
  version: string;
  severity: string;
  advisories: string[];
  fixAvailableViaNpm: boolean | string;
  note?: string;
}
interface SecurityStatus {
  lastCheckedAt: string;
  policy: { mode: string; note: string };
  summary: Record<Sev, { open: number; fixed: number }>;
  npmAudit: {
    checkedAt?: string;
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    notableHigh: NotableHigh[];
  };
  findings: Finding[];
}

const data = securityStatus as unknown as SecurityStatus;

const SEV_ORDER: Sev[] = ["critical", "high", "medium", "low"];
const SEV_LABEL: Record<Sev, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const SEV_STYLE: Record<Sev, { dot: string; badge: string }> = {
  critical: { dot: "#dc2626", badge: "bg-red-100 text-red-700" },
  high: { dot: "#ea580c", badge: "bg-orange-100 text-orange-700" },
  medium: { dot: "#d97706", badge: "bg-amber-100 text-amber-700" },
  low: { dot: "#6b7280", badge: "bg-gray-100 text-gray-600" },
};

export default async function AdminSecurityPage() {
  await requireAdmin();

  const findings = [...data.findings].sort((a, b) => {
    // open を先頭 → severity 順
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity);
  });
  const openCount = data.findings.filter((f) => f.status === "open").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">セキュリティ状況</h1>
        <p className="mt-1 text-sm text-gray-500">
          最終チェック: {data.lastCheckedAt} ・ 方針: <span className="font-medium">{data.policy.mode}</span>（監視・レポートのみ／対策適用は依頼者判断）
        </p>
      </div>

      {/* 方針注記 */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
        ⚠ {data.policy.note}
      </div>

      {/* サマリバッジ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SEV_ORDER.map((sev) => {
          const s = data.summary[sev];
          const st = SEV_STYLE[sev];
          return (
            <div key={sev} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: st.dot }} />
                <span className="text-xs font-semibold text-gray-500">{SEV_LABEL[sev]}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {s.open}<span className="ml-1 text-sm font-normal text-gray-400">open</span>
              </p>
              <p className="text-xs text-gray-400">修正済み {s.fixed}</p>
            </div>
          );
        })}
      </div>

      {/* npm audit */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">依存パッケージ脆弱性（npm audit）</h2>
          <span className="text-xs text-gray-400">合計 {data.npmAudit.total} 件</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <AuditChip label="Critical" n={data.npmAudit.critical} tone="bg-red-100 text-red-700" />
          <AuditChip label="High" n={data.npmAudit.high} tone="bg-orange-100 text-orange-700" />
          <AuditChip label="Moderate" n={data.npmAudit.moderate} tone="bg-amber-100 text-amber-700" />
          <AuditChip label="Low" n={data.npmAudit.low} tone="bg-gray-100 text-gray-600" />
        </div>
        {data.npmAudit.notableHigh?.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {data.npmAudit.notableHigh.map((h) => (
              <li key={h.package} className="text-xs text-gray-600">
                <span className="font-mono font-semibold text-gray-800">{h.package}@{h.version}</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 ${SEV_STYLE.high.badge}`}>{h.severity}</span>
                <span className="ml-2 text-gray-500">{h.advisories.join(" / ")}</span>
                {h.note && <span className="ml-2 text-gray-400">— {h.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* findings テーブル */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700">
          検出項目（open {openCount} / 全 {data.findings.length}）
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["", "重大度", "項目", "領域", "状態", "詳細"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {findings.map((f) => {
              const st = SEV_STYLE[f.severity];
              return (
                <tr key={f.id} className={"align-top " + (f.status === "open" ? "" : "opacity-60")}>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-400">{f.id}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${st.badge}`}>{SEV_LABEL[f.severity]}</span>
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800">{f.title}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{f.area}</td>
                  <td className="px-3 py-2">
                    {f.status === "open"
                      ? <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-600">open</span>
                      : <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700">修正済</span>}
                  </td>
                  <td className="px-3 py-2 max-w-[380px] text-xs text-gray-600">{f.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        ※ 数値・判定はセキュリティ監視担当が {`docs/security-status.json`} を更新して供給します（この画面は表示のみ）。
      </p>
    </div>
  );
}

function AuditChip({ label, n, tone }: { label: string; n: number; tone: string }) {
  return <span className={`rounded-full px-2 py-0.5 font-medium ${n > 0 ? tone : "bg-gray-100 text-gray-400"}`}>{label} {n}</span>;
}
