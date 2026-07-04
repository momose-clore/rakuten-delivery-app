"use client";

/**
 * DeliveryCardV2 — モダン配達アプリ風カード（楽天クリムゾン赤）
 *
 * Rocket Now Partner のような消費者/配達アプリの雰囲気を狙ったデザイン案。
 * - 角丸 2xl・クリムゾン赤のヘッダー帯・大きなルート番号
 * - 全幅の大型 CTA（マップで開く）・大きめタップ領域
 * 本番の DeliveryCard とは別コンポーネント。まず /driver-preview で見比べる用。
 */

import { useState } from "react";
import { Users, Trash2 } from "lucide-react";
import type { DeliveryCardItem, DeliveryStatus } from "./DeliveryCard";
import type { CoordinateBadgeType } from "@/types/prediction";
import { assessAddressConfidence } from "@/lib/address/address-confidence";
import { LocationMemoForm } from "./LocationMemoForm";

const CRIMSON = "#BF0000";
const CRIMSON_DARK = "#9E0000";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ASSIGNED:    { label: "未完了",   className: "bg-white/20 text-white" },
  IN_DELIVERY: { label: "配送中",   className: "bg-white/20 text-white" },
  COMPLETED:   { label: "完了",     className: "bg-green-100 text-green-700" },
  ABSENT:      { label: "不在",     className: "bg-orange-100 text-orange-700" },
  RETURNED:    { label: "持戻り",   className: "bg-red-100 text-red-700" },
  SKIPPED:     { label: "スキップ", className: "bg-gray-100 text-gray-500" },
};

const isDone = (s: DeliveryStatus) => ["COMPLETED", "ABSENT", "RETURNED", "SKIPPED"].includes(s);

function coordinateBadgeConfig(badge: CoordinateBadgeType | undefined) {
  switch (badge) {
    case "approved":  return { label: "✓ 確認済みピン", className: "bg-green-100 text-green-700" };
    case "estimated": return { label: "⚠ ピン位置注意", className: "bg-yellow-100 text-yellow-800" };
    case "missing":   return { label: "📍 住所確認", className: "bg-orange-100 text-orange-700" };
    default:          return null;
  }
}

interface Props {
  item: DeliveryCardItem;
  onStatusChange: (deliveryItemId: string, status: DeliveryStatus) => Promise<void>;
  onMemoSave: (deliveryItemId: string, memo: string) => Promise<void>;
  /** フォロー（応援取り込み）トグルを表示する場合に渡す */
  isFollowed?: boolean;
  onFollowToggle?: () => void;
  /** 配送先の削除（取込ミス/重複の掃除）。渡すとヘッダーにゴミ箱を表示 */
  onDelete?: (deliveryItemId: string) => Promise<void>;
}

const GOLD_ACCENT = "#b8923f";

export function DeliveryCardV2({ item, onStatusChange, onMemoSave, isFollowed, onFollowToggle, onDelete }: Props) {
  const [memo, setMemo] = useState(item.memo ?? "");
  const [savingMemo, setSavingMemo] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete(item.deliveryItemId);
    // 成功すれば親のリストから消えるのでstate復帰は不要
    setDeleting(false);
    setConfirmDelete(false);
  }

  const statusConfig = STATUS_CONFIG[item.deliveryStatus] ?? STATUS_CONFIG.ASSIGNED;
  const done = isDone(item.deliveryStatus);
  const coordBadge = coordinateBadgeConfig(item.coordinateBadge);

  const addressConfidence = assessAddressConfidence({
    address: item.address, lat: item.lat, lng: item.lng, hasApprovedOverride: item.hasOverride,
  }).confidence;
  const addressConfidenceBadge =
    addressConfidence === "low"      ? { label: "⚠ 住所要確認", className: "bg-red-100 text-red-700" }
    : addressConfidence === "medium" ? { label: "住所確認推奨", className: "bg-amber-100 text-amber-700" }
    : null;

  // 配車No を「W1-10-2」形式で組み立て（ウェーブ-号車-順）
  const fullKey = item.dispatchKey
    ? (item.waveNo && !item.dispatchKey.startsWith(item.waveNo) ? `${item.waveNo}-${item.dispatchKey}` : item.dispatchKey)
    : (item.waveNo ?? "—");

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
    <div className={`rounded-2xl overflow-hidden shadow-md transition ${done ? "opacity-60" : "bg-white"}`}>
      {/* クリムゾン赤ヘッダー */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{ background: done ? "#9ca3af" : `linear-gradient(135deg, ${CRIMSON}, ${CRIMSON_DARK})` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-white/20 text-white shrink-0 leading-none">
            <span className="text-[9px] opacity-80">順</span>
            <span className="text-base font-black">{item.routeOrder ?? "—"}</span>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] text-white/70 leading-none mb-1">配車No</p>
            <p className="text-[26px] font-mono font-black text-white leading-none tracking-tight truncate">{fullKey}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
          {onDelete && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="この配送を削除"
              className="p-1.5 rounded-lg bg-white/15 text-white/90 hover:bg-white/25 active:scale-95 transition"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 削除確認バー */}
      {onDelete && confirmDelete && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between gap-2">
          <span className="text-sm text-red-700 font-medium">この配送を削除しますか？</span>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} disabled={deleting}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 bg-white">やめる</button>
            <button onClick={handleDelete} disabled={deleting}
              className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold disabled:opacity-50">
              {deleting ? "削除中..." : "削除する"}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* フォロー（応援）トグル：押すと自分のページに取り込まれる */}
        {onFollowToggle && (
          <button
            onClick={onFollowToggle}
            className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.99] ${isFollowed ? "border-2" : "text-white"}`}
            style={isFollowed ? { borderColor: `${GOLD_ACCENT}80`, color: GOLD_ACCENT } : { background: GOLD_ACCENT }}
          >
            <Users size={16} />
            {isFollowed ? "フォロー中（解除）" : "フォローする（自分のページに追加）"}
          </button>
        )}

        {/* 住所 + バッジ */}
        <div>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {item.hasOverride && <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">修正ピンあり</span>}
            {coordBadge && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${coordBadge.className}`}>{coordBadge.label}</span>}
            {addressConfidenceBadge && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${addressConfidenceBadge.className}`}>{addressConfidenceBadge.label}</span>}
          </div>
          <p className="text-base font-bold text-gray-900 leading-snug">{item.address ?? "住所未登録"}</p>
        </div>

        {/* 配送メモ */}
        {(item.entranceMemo || item.buildingMemo || item.nameplateMemo || item.parkingMemo || item.cautionMemo) && (
          <div className="space-y-1">
            {item.entranceMemo  && <p className="text-xs text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-lg">🚪 入口: {item.entranceMemo}</p>}
            {item.buildingMemo  && <p className="text-xs text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-lg">🏢 建物: {item.buildingMemo}</p>}
            {item.nameplateMemo && <p className="text-xs text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-lg">📋 表札: {item.nameplateMemo}</p>}
            {item.parkingMemo   && <p className="text-xs text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-lg">🅿️ 駐車: {item.parkingMemo}</p>}
            {item.cautionMemo   && <p className="text-xs text-red-800 bg-red-50 px-2.5 py-1.5 rounded-lg font-medium">⚠️ 注意: {item.cautionMemo}</p>}
          </div>
        )}

        {/* 数量（まとまったパネル） */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
          <QtyCell label="常温" value={item.normalOriconCount} />
          <QtyCell label="クーラー" value={item.coolerBoxCount} />
          <QtyCell label="ケース" value={item.caseCount} />
          <div className="text-center border-l border-gray-200 pl-4">
            <p className="text-[11px] text-gray-400">総数</p>
            <p className="text-lg font-black" style={{ color: CRIMSON }}>{item.totalCount ?? 0}</p>
          </div>
        </div>

        {/* 備考表示 */}
        {item.memo && !done && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">備考: {item.memo}</p>
        )}

        {/* 大型 CTA（マップで開く） */}
        {item.mapsUrl && (
          <a
            href={item.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full py-3.5 rounded-xl text-white font-bold text-base gap-2 shadow-sm active:scale-[0.99] transition"
            style={{ background: `linear-gradient(135deg, ${CRIMSON}, ${CRIMSON_DARK})` }}
          >
            🗺 マップで開く
          </a>
        )}

        {/* 住所フォールバック */}
        {item.addressNavUrl && item.coordinateBadge !== "approved" && item.coordinateBadge !== "none" && (
          <a
            href={item.addressNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full py-2.5 rounded-xl border-2 text-xs gap-1 font-medium"
            style={{ borderColor: "#fca5a5", color: CRIMSON }}
          >
            📍 住所でMapを開く（フォールバック）
          </a>
        )}

        {/* ステータス更新：完了ボタンのみ */}
        {!done && (
          <button
            onClick={() => handleStatus("COMPLETED")}
            disabled={updatingStatus}
            className="w-full py-3.5 rounded-xl text-base font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 active:scale-[0.99] transition"
          >
            ✓ 完了
          </button>
        )}

        {/* 備考入力 */}
        {!done && (
          <div className="flex gap-2">
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="備考を入力..."
              className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <button
              onClick={handleMemoSave}
              disabled={savingMemo}
              className="px-4 py-2.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl font-medium disabled:opacity-50"
            >
              {savingMemo ? "…" : "保存"}
            </button>
          </div>
        )}

        {/* 配送メモ申請 */}
        {!done && <LocationMemoForm deliveryItemId={item.deliveryItemId} address={item.address} />}
      </div>
    </div>
  );
}

function QtyCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="font-bold text-gray-800">{value ?? 0}</p>
    </div>
  );
}
