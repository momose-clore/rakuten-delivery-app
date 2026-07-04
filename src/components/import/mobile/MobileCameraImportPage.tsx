"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CornerAdjuster } from "./CornerAdjuster";
import { normalizeToJpegBlob } from "@/lib/image/to-jpeg";

type Step = "guide" | "capture" | "adjust" | "quality" | "processing" | "done";
type CaptureMode = "screen" | "paper";

const GUIDE_MESSAGES = [
  "📄 配送表だけを画面いっぱいに写す（背景を減らす）",
  "⬆️ 用紙を縦向き・正面から真上で撮る（斜め/横向きにしない）",
  "🔆 テカリ・反射・影が文字にかからない角度で",
  "🔍 数字や住所がはっきり読める距離まで近づく",
  "✋ 手ブレしないよう固定して撮る",
];

export function MobileCameraImportPage({
  doneHref = "/admin/ocr-review",
  doneLabel = "確認画面へ →",
  doneNote = "OCR確認画面で内容を確認してください",
  backHref,
}: {
  doneHref?: string;
  doneLabel?: string;
  doneNote?: string;
  backHref?: string;
} = {}) {
  const [step, setStep] = useState<Step>("guide");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("paper");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState<{ level: string; score: number; warnings: string[]; blockingReasons: string[]; canProceedToOcr: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 撮影 → まず四隅調整ステップへ（斜め撮り補正のため）
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError("");
    setStep("adjust");
  }

  // 補正後(または原本)の画像をアップロードして品質確認へ
  async function uploadImage(image: Blob) {
    setStep("quality");
    setLoading(true);
    setError("");

    // HEIC等はブラウザでJPEGに正規化してから送る（生HEICだとサーバー復号失敗→OCR崩れ）
    const jpeg = await normalizeToJpegBlob(image);
    setPreviewUrl(URL.createObjectURL(jpeg));

    const formData = new FormData();
    formData.append("file", jpeg, "capture.jpg");
    formData.append("captureMode", captureMode);

    const res = await fetch("/api/admin/dispatch-import/camera/upload", { method: "POST", body: formData });
    setLoading(false);

    if (!res.ok) {
      setError("アップロードに失敗しました");
      setStep("capture");
      return;
    }

    const body = await res.json();
    setImageUrl(body.imageUrl);
    setQuality(body.quality);
  }

  async function handleProcess() {
    if (!imageUrl) return;
    setStep("processing");
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/dispatch-import/camera/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, captureMode }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "OCR処理に失敗しました");
      setStep("quality");
      return;
    }

    await res.json();
    setStep("done");
  }

  if (step === "guide") {
    return (
      <div className="max-w-md mx-auto space-y-5 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900">スマホカメラOCR</h1>

        <div className="flex gap-2">
          {(["paper", "screen"] as CaptureMode[]).map((mode) => (
            <button key={mode} onClick={() => setCaptureMode(mode)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border ${captureMode === mode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}>
              {mode === "paper" ? "📄 紙" : "🖥️ 画面"}
            </button>
          ))}
        </div>

        {captureMode === "paper" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
            <p className="text-sm font-bold text-amber-900">📑 精度重視なら「書類スキャン」推奨</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              紙の貨物一覧表は文字が細かく、通常のカメラだと読み間違いが起きやすいです。
              <b>iPhoneの「ファイル」or「メモ」アプリの“書類をスキャン”</b>（自動で真っ直ぐ＋くっきり補正）や
              CamScannerで撮り、その<b>PDF/画像を下の「ファイルを選択」から取り込む</b>と精度が大きく上がります。
            </p>
          </div>
        )}

        <div className="bg-blue-50 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800">撮影ガイド</p>
          {GUIDE_MESSAGES.map((msg, i) => (
            <p key={i} className="text-sm text-blue-700">• {msg}</p>
          ))}
        </div>

        <Button onClick={() => setStep("capture")} className="w-full py-4 text-base">
          撮影を開始する
        </Button>
      </div>
    );
  }

  if (step === "capture") {
    return (
      <div className="max-w-md mx-auto space-y-5 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900">配送表を撮影してください</h1>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

        {/* 撮影枠ガイド */}
        <div className="relative w-full aspect-[3/4] rounded-2xl bg-blue-50/50 flex items-center justify-center">
          <span className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
          <span className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
          <span className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
          <span className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
          <p className="text-sm text-blue-700 text-center px-6 leading-relaxed font-medium">
            配送表の<b>四隅をこの枠</b>に合わせて<br />明るい場所で<b>真上から</b>撮影
          </p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileSelect} className="hidden" />

        <button onClick={() => fileInputRef.current?.click()}
          className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-lg font-bold">
          📷 カメラで撮影
        </button>

        <input type="file" accept="image/*" onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-gray-100" />

        <button onClick={() => setStep("guide")} className="w-full text-sm text-gray-500 underline">
          ← 戻る
        </button>
      </div>
    );
  }

  if (step === "adjust" && selectedFile) {
    return (
      <div className="max-w-md mx-auto space-y-4 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900">四隅を合わせる</h1>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
        <CornerAdjuster
          file={selectedFile}
          onConfirm={(blob) => uploadImage(blob)}
          onSkip={() => uploadImage(selectedFile)}
        />
        <button onClick={() => { setStep("capture"); setSelectedFile(null); }} className="w-full text-sm text-gray-500 underline">
          ← 撮り直す
        </button>
      </div>
    );
  }

  if (step === "quality") {
    return (
      <div className="max-w-md mx-auto space-y-4 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900">品質確認</h1>

        {previewUrl && (
          <div className="rounded-xl overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="プレビュー" className="w-full object-contain max-h-64 bg-gray-50" />
          </div>
        )}

        {loading && <p className="text-sm text-gray-500">品質を確認中...</p>}

        {quality && (
          <div className={`rounded-xl p-4 ${
            quality.level === "excellent" || quality.level === "good" ? "bg-green-50" :
            quality.level === "warning" ? "bg-yellow-50" : "bg-red-50"
          }`}>
            <p className="font-semibold text-sm">品質スコア: {quality.score}/100（{quality.level}）</p>
            {quality.warnings.map((w, i) => <p key={i} className="text-xs text-gray-600 mt-1">• {w}</p>)}
            {quality.blockingReasons.map((r, i) => <p key={i} className="text-xs text-red-700 mt-1 font-medium">⚠️ {r}</p>)}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setStep("capture"); setPreviewUrl(null); }}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium">
            再撮影
          </button>
          {quality?.canProceedToOcr && (
            <Button onClick={handleProcess} className="flex-1 py-3">
              OCR実行
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="max-w-md mx-auto space-y-4 px-4 py-12 text-center">
        <p className="text-2xl">⏳</p>
        <p className="text-lg font-semibold text-gray-900">OCR処理中...</p>
        <p className="text-sm text-gray-500">しばらくお待ちください（20〜40秒）</p>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4 px-4 py-12 text-center">
      <p className="text-3xl">✅</p>
      <p className="text-xl font-bold text-gray-900">取込完了</p>
      <p className="text-sm text-gray-500">{doneNote}</p>
      <Link href={doneHref} className="block w-full py-3 bg-blue-600 text-white rounded-xl font-medium">
        {doneLabel}
      </Link>
      {backHref && (
        <Link href={backHref} className="block w-full py-3 border border-gray-300 text-gray-600 rounded-xl font-medium">
          ホームに戻る
        </Link>
      )}
    </div>
  );
}
