"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { OcrStatusBadge } from "./OcrStatusBadge";
import type { DispatchImage, OcrStatus } from "@/types/dispatch";

interface ImageHistoryListProps {
  refreshKey: number;
}

const OCR_RUNNABLE: OcrStatus[] = ["PENDING", "ERROR"];
const OCR_REVIEWABLE: OcrStatus[] = ["REVIEW_REQUIRED", "CONFIRMED"];

export function ImageHistoryList({ refreshKey }: ImageHistoryListProps) {
  const [images, setImages] = useState<DispatchImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/dispatch-images");
    if (!res.ok) {
      setError("一覧の取得に失敗しました");
      setLoading(false);
      return;
    }
    const body = await res.json();
    setImages(body.data ?? []);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchImages(); }, [fetchImages, refreshKey]);

  async function handleRunOcr(id: string) {
    setRunningIds((prev) => new Set(prev).add(id));

    // OCR は同期実行のため完了まで待つ（Tesseract.js は時間がかかる）
    const res = await fetch(`/api/ocr/${id}`, { method: "POST" });

    setRunningIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "OCR実行に失敗しました");
      return;
    }

    // 完了後にリストを更新
    await fetchImages();
  }

  if (loading) {
    return <p className="text-sm text-gray-500 py-4">読み込み中...</p>;
  }
  if (error) {
    return <p className="text-sm text-red-500 py-4">{error}</p>;
  }
  if (images.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">取込履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">プレビュー</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配送日</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">エリア</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W番号</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OCRステータス</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">取込日時</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {images.map((img) => {
            const isRunning = runningIds.has(img.id) || img.ocrStatus === "PROCESSING";
            return (
              <tr key={img.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="relative w-16 h-10 rounded overflow-hidden bg-gray-100 border border-gray-200">
                    <Image
                      src={img.imageUrl}
                      alt="配車表"
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {new Date(img.deliveryDate).toLocaleDateString("ja-JP")}
                </td>
                <td className="px-4 py-3 text-gray-700">{img.area ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700">{img.waveNo ?? "—"}</td>
                <td className="px-4 py-3">
                  <OcrStatusBadge status={img.ocrStatus} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(img.importedAt).toLocaleString("ja-JP")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {OCR_RUNNABLE.includes(img.ocrStatus) && (
                      <button
                        onClick={() => handleRunOcr(img.id)}
                        disabled={isRunning}
                        className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRunning ? "実行中..." : "OCR実行"}
                      </button>
                    )}
                    {isRunning && img.ocrStatus === "PROCESSING" && (
                      <span className="text-xs text-yellow-600">処理中...</span>
                    )}
                    {OCR_REVIEWABLE.includes(img.ocrStatus) && (
                      <Link
                        href={`/admin/ocr-review/${img.id}`}
                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        確認・修正
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
