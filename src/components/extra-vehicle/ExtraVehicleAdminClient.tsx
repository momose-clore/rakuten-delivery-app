"use client";

import { useCallback, useEffect, useState } from "react";
import { ExtraVehicleRequestForm } from "./ExtraVehicleRequestForm";
import {
  type ExtraVehicleRequestDTO,
  type ExtraVehicleRequestStatus,
  STATUS_LABEL,
  REPORT_STATUS_LABEL,
} from "@/types/extra-vehicle-request";
import { formatExtraVehicleReport } from "@/lib/line/format";

const STATUS_STYLE: Record<ExtraVehicleRequestStatus, string> = {
  pending: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-gray-200 text-gray-600",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "すべて" },
  { value: "pending", label: "申請中" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
];

export function ExtraVehicleAdminClient() {
  const [requests, setRequests] = useState<ExtraVehicleRequestDTO[]>([]);
  const [filter, setFilter] = useState("");
  const [depot, setDepot] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const queryString = useCallback(() => {
    const p = new URLSearchParams();
    if (filter) p.set("status", filter);
    if (depot.trim()) p.set("depot", depot.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [filter, depot, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = queryString();
    const res = await fetch(`/api/extra-vehicle-requests${qs ? `?${qs}` : ""}`);
    setLoading(false);
    if (!res.ok) {
      setError("取得に失敗しました");
      return;
    }
    const body = await res.json();
    setRequests(body.requests ?? []);
  }, [queryString]);

  function exportCsv() {
    const qs = queryString();
    window.open(`/api/admin/extra-vehicle-requests/export${qs ? `?${qs}` : ""}`, "_blank");
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  function upsert(updated: ExtraVehicleRequestDTO) {
    setRequests((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  async function action(id: string, kind: "approve" | "reject") {
    let rejectedReason: string | undefined;
    if (kind === "reject") {
      const input = window.prompt("却下理由（任意）を入力してください");
      if (input === null) return; // キャンセル
      rejectedReason = input;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/extra-vehicle-requests/${id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "reject" ? JSON.stringify({ rejectedReason }) : undefined,
      });
      const body = await res.json();
      if (!res.ok) {
        window.alert(body.error ?? "処理に失敗しました");
        return;
      }
      if (body.message) window.alert(body.message);
      if (body.request) upsert(body.request as ExtraVehicleRequestDTO);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-sm px-3 py-1.5 rounded-md border ${
                filter === f.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
        >
          {showForm ? "フォームを閉じる" : "＋ 増便を申請"}
        </button>
      </div>

      {/* 絞り込み（日付・デポ）＋CSV出力 */}
      <div className="flex items-end gap-3 flex-wrap bg-white rounded-lg border border-gray-200 p-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">対象日（開始）</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">対象日（終了）</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">対象デポ</label>
          <input type="text" value={depot} onChange={(e) => setDepot(e.target.value)} placeholder="美女木デポ"
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-32" />
        </div>
        {(from || to || depot) && (
          <button
            onClick={() => { setFrom(""); setTo(""); setDepot(""); }}
            className="text-sm px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50"
          >
            条件クリア
          </button>
        )}
        <button
          onClick={exportCsv}
          className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 ml-auto"
        >
          CSV出力
        </button>
      </div>

      {showForm && (
        <ExtraVehicleRequestForm
          onCreated={(created) => {
            upsert(created);
            setShowForm(false);
          }}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-400">読み込み中...</p>}

      {!loading && requests.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">該当する増便申請はありません</p>
        </div>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <RequestCard key={r.id} r={r} busy={busyId === r.id} onAction={action} onUpdated={upsert} />
        ))}
      </div>
    </div>
  );
}

function RequestCard({
  r,
  busy,
  onAction,
  onUpdated,
}: {
  r: ExtraVehicleRequestDTO;
  busy: boolean;
  onAction: (id: string, kind: "approve" | "reject") => void;
  onUpdated?: (updated: ExtraVehicleRequestDTO) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  // 承認済み・却下はコンパクト表示（本文/送信文面を畳む）。申請中は常にフル表示。
  const compact = r.status !== "pending";
  const showDetail = !compact || open;

  // 専用グループへ実際に流す文面（増便申請フォーマット）
  const reportText = formatExtraVehicleReport({
    requestDate: r.requestDate,
    depot: r.depot,
    waveNo: r.waveNo,
    vehicleCount: r.vehicleCount,
    assignedDriverName: r.assignedDriverName,
    reason: r.reason,
  });

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("コピーしてください", reportText);
    }
  }

  async function lineSend() {
    if (!window.confirm(`増便専用グループへLINE送信します。\n\n送信文面:\n${reportText}\n\nよろしいですか？`)) {
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`/api/admin/extra-vehicle-requests/${r.id}/line-send`, { method: "POST" });
      const body = await res.json();
      if (body.request) onUpdated?.(body.request as ExtraVehicleRequestDTO);
      window.alert(res.ok ? (body.message ?? "送信しました") : (body.error ?? "送信に失敗しました"));
    } finally {
      setTesting(false);
    }
  }
  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${compact ? "px-4 py-2.5" : "p-4"}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>
              {STATUS_LABEL[r.status]}
            </span>
            <span className="font-semibold text-gray-900">{r.depot}</span>
            <span className="text-sm text-gray-700">該当便 {r.waveNo}</span>
            <span className="text-sm text-gray-700">{r.vehicleCount}台</span>
            {r.assignedDriverName && <span className="text-sm text-gray-700">→ {r.assignedDriverName}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            対象日 {r.requestDate} · 申請者 {r.createdByName ?? "—"}（{r.createdByRole === "ADMIN" ? "管理者" : "ドライバー"}）
            · 報告: {REPORT_STATUS_LABEL[r.carioSyncStatus]}
          </p>
        </div>
        {/* 承認済み・却下：右側にコンパクトな操作 */}
        {compact && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={copyReport}
              className="text-xs px-2 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
              {copied ? "コピー済" : "コピー"}
            </button>
            {r.status === "approved" && (
              <button onClick={lineSend} disabled={testing}
                className="text-xs px-2 py-1 bg-[#06C755] hover:brightness-95 text-white rounded disabled:opacity-50">
                {testing ? "送信中" : r.carioSyncStatus === "sent" ? "LINE再送信" : "LINE送信"}
              </button>
            )}
            <button onClick={() => setOpen((v) => !v)} className="text-xs text-blue-600 px-1">
              {open ? "閉じる" : "詳細"}
            </button>
          </div>
        )}
      </div>

      {showDetail && (
        <>
          <div className="mt-2">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.reason}</p>
          </div>

          {r.status === "rejected" && r.rejectedReason && (
            <p className="text-xs text-gray-500 mt-2">却下理由: {r.rejectedReason}</p>
          )}

          {/* 専用グループへ流す文面（増便申請フォーマット） */}
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">送信文面（増便フォーマット）</p>
            <pre className="text-sm bg-gray-100 rounded p-3 whitespace-pre-wrap font-sans leading-relaxed">{reportText}</pre>
          </div>

          {/* 申請中：承認/却下＋文面操作 */}
          {!compact && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button onClick={() => onAction(r.id, "approve")} disabled={busy}
                className="text-sm px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50">
                承認
              </button>
              <button onClick={() => onAction(r.id, "reject")} disabled={busy}
                className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-50">
                却下
              </button>
              <button onClick={copyReport}
                className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md">
                {copied ? "コピーしました" : "文面をコピー"}
              </button>
              <button onClick={lineSend} disabled={testing}
                className="text-sm px-3 py-1.5 bg-[#06C755] hover:brightness-95 text-white rounded-md disabled:opacity-50"
                title="増便専用グループへ送信します">
                {testing ? "送信中..." : r.carioSyncStatus === "sent" ? "LINE再送信" : "LINEで送信"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
