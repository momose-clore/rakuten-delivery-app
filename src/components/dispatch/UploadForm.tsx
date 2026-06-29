"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface UploadFormProps {
  onSuccess: () => void;
}

export function UploadForm({ onSuccess }: UploadFormProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [area, setArea] = useState("");
  const [waveNo, setWaveNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      setError("対応形式は jpg / jpeg / png / webp のみです");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは 10MB 以下にしてください");
      return;
    }

    setError("");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  function handleClear() {
    setFile(null);
    setPreview(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !deliveryDate) {
      setError("配送日とファイルは必須です");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("deliveryDate", deliveryDate);
    formData.append("area", area);
    formData.append("waveNo", waveNo);

    const res = await fetch("/api/dispatch-images/upload", {
      method: "POST",
      body: formData,
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "アップロードに失敗しました");
      return;
    }

    handleClear();
    setDeliveryDate("");
    setArea("");
    setWaveNo("");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
      <h2 className="text-base font-semibold text-gray-900">画像アップロード</h2>

      {/* 配送情報 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            配送日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">エリア</label>
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="例：東京、埼玉"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">W番号</label>
          <input
            type="text"
            value={waveNo}
            onChange={(e) => setWaveNo(e.target.value)}
            placeholder="例：W1、W2"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* ファイル選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          画像ファイル <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-2">（jpg / jpeg / png / webp、10MB 以下）</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {/* プレビュー */}
      {preview && (
        <div className="relative">
          <p className="text-sm font-medium text-gray-700 mb-2">プレビュー</p>
          <div className="relative w-full max-w-md h-48 rounded-md overflow-hidden border border-gray-200">
            <Image src={preview} alt="プレビュー" fill className="object-contain bg-gray-50" />
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="mt-2 text-xs text-gray-500 hover:text-red-500 underline"
          >
            選択を解除
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
      )}

      <Button type="submit" disabled={loading || !file}>
        {loading ? "アップロード中..." : "アップロード"}
      </Button>
    </form>
  );
}
