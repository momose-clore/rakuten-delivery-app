"use client";

import { useState } from "react";
import { UploadForm } from "@/components/dispatch/UploadForm";
import { ImageHistoryList } from "@/components/dispatch/ImageHistoryList";

export default function DispatchImagesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  function handleUploadSuccess() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">配車表画像取込</h1>
        <p className="mt-1 text-sm text-gray-500">
          配車表の画像をアップロードし、OCR処理の準備をします
        </p>
      </div>

      <UploadForm onSuccess={handleUploadSuccess} />

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">取込履歴</h2>
        <ImageHistoryList refreshKey={refreshKey} />
      </div>
    </div>
  );
}
