"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DispatchImage, DeliveryItem } from "@/types/dispatch";
import { OcrStatusBadge } from "@/components/dispatch/OcrStatusBadge";
import { DeliveryItemRow } from "./DeliveryItemRow";
import { parseReviewReasons } from "./ReviewReasonBadge";

interface OcrReviewClientProps {
  dispatchImage: DispatchImage;
  initialItems: DeliveryItem[];
}

const COLUMNS = [
  "配車No", "伝票No", "氏名", "電話番号", "住所",
  "特殊フラグ", "常温", "クーラー", "ケース", "総数", "備考",
  "要確認理由", "操作",
];

export function OcrReviewClient({ dispatchImage, initialItems }: OcrReviewClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<DeliveryItem[]>(initialItems);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const reviewCount = items.filter(
    (i) => parseReviewReasons(i.ocrNotes).length > 0
  ).length;

  function handleItemSaved(updated: DeliveryItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...updated, createdAt: i.createdAt, updatedAt: new Date().toISOString() } : i)));
  }

  async function handleConfirm() {
    if (reviewCount > 0) {
      const ok = window.confirm(
        `要確認の行が ${reviewCount} 件残っています。このまま確定しますか？`
      );
      if (!ok) return;
    }

    setConfirming(true);
    setConfirmError("");
    const res = await fetch(`/api/ocr-review/${dispatchImage.id}/confirm`, {
      method: "POST",
    });
    setConfirming(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setConfirmError(body.error ?? "確定に失敗しました");
      return;
    }

    router.push("/admin/dispatch-images");
    router.refresh();
  }

  // OCR未実行
  if (dispatchImage.ocrStatus === "PENDING" || dispatchImage.ocrStatus === "PROCESSING") {
    return (
      <div className="space-y-4">
        <BackLink />
        <ImageMeta image={dispatchImage} />
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 font-medium">OCR が未実行です</p>
          <p className="text-yellow-600 text-sm mt-1">
            配車表一覧からOCRを実行してください
          </p>
          <Link
            href="/admin/dispatch-images"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            配車表一覧に戻る →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />
      <ImageMeta image={dispatchImage} />

      {/* 要確認バナー */}
      {reviewCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-orange-700 font-medium text-sm">
            要確認が {reviewCount} 件あります。内容を確認・修正してから確定してください。
          </span>
        </div>
      )}

      {/* 2カラムレイアウト */}
      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4 items-start">
        {/* 左: 元画像 */}
        <div className="md:sticky md:top-4 bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">元画像</p>
          <div className="relative w-full aspect-[3/4] rounded overflow-hidden bg-gray-100">
            <Image
              src={`/api/dispatch-images/${dispatchImage.id}/file`}
              alt="配車表"
              fill
              unoptimized
              className="object-contain"
              sizes="380px"
            />
          </div>
        </div>

        {/* 右: OCR結果テーブル */}
        <div className="space-y-3 min-w-0">
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-gray-400 text-sm">
                      明細データがありません
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <DeliveryItemRow
                      key={item.id}
                      item={item}
                      dispatchImageId={dispatchImage.id}
                      onSaved={handleItemSaved}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 確定ボタン */}
          {dispatchImage.ocrStatus !== "CONFIRMED" && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="px-4 py-2 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {confirming ? "確定中..." : "取込結果を確定"}
              </button>
              {confirmError && (
                <p className="text-sm text-red-600">{confirmError}</p>
              )}
            </div>
          )}
          {dispatchImage.ocrStatus === "CONFIRMED" && (
            <p className="text-sm text-green-700 font-medium">✅ 確定済み（割当対象として使用できます）</p>
          )}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/ocr-review" className="text-sm text-blue-600 hover:underline">
      ← 取込確認一覧に戻る
    </Link>
  );
}

function ImageMeta({ image }: { image: DispatchImage }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-xl font-bold text-gray-900">取込確認・修正</h1>
      <span className="text-sm text-gray-500">
        {new Date(image.deliveryDate).toLocaleDateString("ja-JP")}
      </span>
      {image.area && <span className="text-sm text-gray-500">{image.area}</span>}
      {image.waveNo && <span className="text-sm text-gray-500">{image.waveNo}</span>}
      <OcrStatusBadge status={image.ocrStatus} />
    </div>
  );
}
