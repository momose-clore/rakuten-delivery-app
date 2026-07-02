"use client";

import { useState } from "react";
import type { CoordinateBadgeType } from "@/types/prediction";
import { assessAddressConfidence } from "@/lib/address/address-confidence";
import { LocationMemoForm } from "./LocationMemoForm";

export type DeliveryStatus =
  | "PENDING_OCR" | "REVIEW_REQUIRED" | "ADDRESS_ERROR"
  | "UNASSIGNED" | "ASSIGNED" | "IN_DELIVERY"
  | "COMPLETED" | "ABSENT" | "RETURNED" | "SKIPPED";

export interface DeliveryCardItem {
  assignmentId: string;
  routeOrder: number | null;
  deliveryItemId: string;
  dispatchKey: string | null;
  waveNo: string | null;
  vehicleNo: string | null;
  address: string | null;
  normalOriconCount: number | null;
  coolerBoxCount: number | null;
  caseCount: number | null;
  totalCount: number | null;
  memo: string | null;
  lat: number | null;
  lng: number | null;
  deliveryStatus: DeliveryStatus;
  mapsUrl?: string;
  addressNavUrl?: string | null;   // 住所文字列フォールバックURL
  // 住所補正情報（location override）
  entranceMemo?: string | null;
  buildingMemo?: string | null;
  nameplateMemo?: string | null;
  parkingMemo?: string | null;
  cautionMemo?: string | null;
  hasOverride?: boolean;
  // 予測値バッジ情報
  coordinateBadge?: CoordinateBadgeType;
  coordinateStatus?: string | null;
  coordinateConfidence?: string | null;
}

interface DeliveryCardProps {
  item: DeliveryCardItem;
  onStatusChange: (deliveryItemId: string, status: DeliveryStatus) => Promise<void>;
  onMemoSave: (deliveryItemId: string, memo: string) => Promise<void>;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ASSIGNED:    { label: "未完了",   className: "bg-blue-100 text-blue-700" },
  IN_DELIVERY: { label: "配送中",   className: "bg-blue-100 text-blue-700" },
  COMPLETED:   { label: "完了",     className: "bg-green-100 text-green-700" },
  ABSENT:      { label: "不在",     className: "bg-orange-100 text-orange-700" },
  RETURNED:    { label: "持戻り",   className: "bg-red-100 text-red-700" },
  SKIPPED:     { label: "スキップ", className: "bg-gray-100 text-gray-500" },
};

const ACTION_BUTTONS: { status: DeliveryStatus; label: string; className: string }[] = [
  { status: "COMPLETED", label: "✓ 完了",     className: "bg-green-600 hover:bg-green-700 text-white" },
  { status: "ABSENT",    label: "× 不在",     className: "bg-orange-500 hover:bg-orange-600 text-white" },
  { status: "RETURNED",  label: "↩ 持戻り",   className: "bg-red-500 hover:bg-red-600 text-white" },
  { status: "SKIPPED",   label: "→ スキップ", className: "bg-gray-400 hover:bg-gray-500 text-white" },
];

const isDone = (s: DeliveryStatus) =>
  ["COMPLETED", "ABSENT", "RETURNED", "SKIPPED"].includes(s);

/** 座標バッジのラベルとスタイル */
function coordinateBadgeConfig(badge: CoordinateBadgeType | undefined) {
  switch (badge) {
    case "approved":  return { label: "✓ 確認済みピン", className: "bg-green-100 text-green-700" };
    case "estimated": return { label: "⚠ ピン位置注意", className: "bg-yellow-100 text-yellow-700" };
    case "missing":   return { label: "📍 住所確認", className: "bg-orange-100 text-orange-700" };
    default:          return null;
  }
}

export function DeliveryCard({ item, onStatusChange, onMemoSave }: DeliveryCardProps) {
  const [memo, setMemo] = useState(item.memo ?? "");
  const [savingMemo, setSavingMemo] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const statusConfig = STATUS_CONFIG[item.deliveryStatus] ?? STATUS_CONFIG.ASSIGNED;
  const done = isDone(item.deliveryStatus);
  const coordBadge = coordinateBadgeConfig(item.coordinateBadge);

  // 住所テキストの信頼度（medium/low のときだけ注意バッジを出す）
  const addressConfidence = assessAddressConfidence({
    address: item.address,
    lat: item.lat,
    lng: item.lng,
    hasApprovedOverride: item.hasOverride,
  }).confidence;
  const addressConfidenceBadge =
    addressConfidence === "low"    ? { label: "⚠ 住所要確認", className: "bg-red-100 text-red-700" }
    : addressConfidence === "medium" ? { label: "住所確認推奨", className: "bg-amber-100 text-amber-700" }
    : null;

  async function handleStatus(status: DeliveryStatus) {
    setUpdatingStatus(true);
    await onStatusChange(item.deliveryItemId, status);
    setUpdatingStatus(false);
  }

  async function handleMemoSave() {
    setSavingMemo(true);
    await onMemoSave(item.deliveryItemId, memo);
    setSavingMemo(false);
  }

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${done ? "opacity-70" : "bg-white border-gray-200"}`}>
      {/* カードヘッダー */}
      <div className={`px-4 py-2 flex items-center justify-between ${done ? "bg-gray-100" : "bg-blue-50"}`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-blue-700">
            #{item.routeOrder ?? "—"}
          </span>
          <div>
            <span className="text-xs text-gray-500">{item.waveNo ?? "—"}</span>
            <span className="mx-1 text-gray-300">|</span>
            <span className="text-xs font-mono text-gray-700">{item.dispatchKey ?? "—"}</span>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* 住所 + 予測バッジ */}
        <div>
          <div className="flex items-center gap-1 mb-0.5 flex-wrap">
            <p className="text-xs text-gray-400">住所</p>
            {item.hasOverride && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded">修正ピンあり</span>
            )}
            {coordBadge && (
              <span className={`text-xs px-1.5 rounded font-medium ${coordBadge.className}`}>
                {coordBadge.label}
              </span>
            )}
            {addressConfidenceBadge && (
              <span className={`text-xs px-1.5 rounded font-medium ${addressConfidenceBadge.className}`}>
                {addressConfidenceBadge.label}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 leading-snug">
            {item.address ?? "住所未登録"}
          </p>
        </div>

        {/* 配送メモ（location override） */}
        {(item.entranceMemo || item.buildingMemo || item.nameplateMemo || item.parkingMemo || item.cautionMemo) && (
          <div className="space-y-1">
            {item.entranceMemo  && <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">🚪 入口: {item.entranceMemo}</p>}
            {item.buildingMemo  && <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">🏢 建物: {item.buildingMemo}</p>}
            {item.nameplateMemo && <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">📋 表札: {item.nameplateMemo}</p>}
            {item.parkingMemo   && <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">🅿️ 駐車: {item.parkingMemo}</p>}
            {item.cautionMemo   && <p className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded">⚠️ 注意: {item.cautionMemo}</p>}
          </div>
        )}

        {/* 数量 */}
        <div className="flex gap-3 text-sm">
          <div className="text-center">
            <p className="text-xs text-gray-400">常温</p>
            <p className="font-bold text-gray-800">{item.normalOriconCount ?? 0}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">クーラー</p>
            <p className="font-bold text-gray-800">{item.coolerBoxCount ?? 0}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">ケース</p>
            <p className="font-bold text-gray-800">{item.caseCount ?? 0}</p>
          </div>
          <div className="text-center border-l border-gray-200 pl-3">
            <p className="text-xs text-gray-400">総数</p>
            <p className="font-bold text-blue-700">{item.totalCount ?? 0}</p>
          </div>
        </div>

        {/* 備考 */}
        {item.memo && !done && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
            備考: {item.memo}
          </p>
        )}

        {/* Googleマップボタン（座標URL）*/}
        {item.mapsUrl && (
          <a
            href={item.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Googleマップで開く
          </a>
        )}

        {/* 住所フォールバックボタン（座標なし or 推定の場合） */}
        {item.addressNavUrl && item.coordinateBadge !== "approved" && item.coordinateBadge !== "none" && (
          <a
            href={item.addressNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full py-2 rounded-lg border border-gray-300 text-gray-600 text-xs gap-1 hover:bg-gray-50"
          >
            📍 住所でMapを開く（フォールバック）
          </a>
        )}

        {/* ステータス更新ボタン */}
        {!done && (
          <div className="grid grid-cols-2 gap-2">
            {ACTION_BUTTONS.map(({ status, label, className }) => (
              <button
                key={status}
                onClick={() => handleStatus(status)}
                disabled={updatingStatus}
                className={`py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${className}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 備考入力 */}
        {!done && (
          <div className="flex gap-2">
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="備考を入力..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleMemoSave}
              disabled={savingMemo}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              {savingMemo ? "…" : "保存"}
            </button>
          </div>
        )}

        {/* 配送メモ申請（入口/建物/表札/駐車/注意 → 管理者承認フロー） */}
        {!done && (
          <LocationMemoForm deliveryItemId={item.deliveryItemId} address={item.address} />
        )}
      </div>
    </div>
  );
}
