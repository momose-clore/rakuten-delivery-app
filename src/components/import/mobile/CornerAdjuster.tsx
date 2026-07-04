"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { solveHomography, applyHomography, estimateOutputSize, type Point } from "@/lib/image/perspective";

/**
 * 撮影画像の4隅をドラッグで指定し、射影変換で平面（長方形）に補正する。
 * 自動書類検出は雑然とした背景で不安定なため、手動指定を主にする（CamScanner等と同様）。
 * 補正に失敗した場合や「そのまま」を選んだ場合は原本を使う（フォールバック安全）。
 */
export function CornerAdjuster({
  file,
  onConfirm,
  onSkip,
}: {
  file: File;
  onConfirm: (blob: Blob) => void;
  onSkip: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [disp, setDisp] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // 表示座標系での4隅（tl,tr,br,bl）
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const onImgLoad = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    setDisp({ w, h });
    // 初期位置：内側8%（利用者が四隅へ寄せる）
    const ix = w * 0.08, iy = h * 0.08;
    setCorners([
      { x: ix, y: iy },
      { x: w - ix, y: iy },
      { x: w - ix, y: h - iy },
      { x: ix, y: h - iy },
    ]);
  }, []);

  const pointerMove = useCallback((clientX: number, clientY: number) => {
    const el = imgRef.current;
    if (dragIdx.current == null || !el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    setCorners((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[dragIdx.current!] = { x, y };
      return next;
    });
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => { if (dragIdx.current != null) { e.preventDefault(); pointerMove(e.clientX, e.clientY); } };
    const up = () => { dragIdx.current = null; };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [pointerMove]);

  async function confirm() {
    if (!corners || !natural || !disp.w) { onSkip(); return; }
    setBusy(true);
    try {
      const blob = await warpFile(file, corners, disp, natural);
      if (blob) onConfirm(blob);
      else onSkip();
    } catch {
      onSkip();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600 text-center">
        配送表の<b>四隅（●）を角に合わせて</b>ください。斜めでも補正します。
      </p>
      <div className="relative inline-block mx-auto max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={url}
          alt="撮影画像"
          onLoad={onImgLoad}
          className="max-w-full max-h-[60vh] block select-none touch-none"
          draggable={false}
        />
        {corners && (
          <svg className="absolute inset-0 pointer-events-none" width={disp.w} height={disp.h}>
            <polygon
              points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
              fill="rgba(37,50,79,0.18)"
              stroke="#26324F"
              strokeWidth={2}
            />
          </svg>
        )}
        {corners?.map((c, i) => (
          <div
            key={i}
            onPointerDown={(e) => { e.preventDefault(); dragIdx.current = i; }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border-4 border-[#26324F] shadow touch-none"
            style={{ left: c.x, top: c.y }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={confirm}
          disabled={busy}
          className="w-full py-3 rounded-lg bg-[#26324F] text-white font-bold disabled:opacity-50"
        >
          {busy ? "補正中..." : "四隅で補正して取込"}
        </button>
        <button onClick={onSkip} disabled={busy} className="w-full py-2 text-sm text-gray-500 underline">
          補正せずそのまま取込
        </button>
      </div>
    </div>
  );
}

/** File を読み込み、表示座標の4隅→自然座標に変換して射影変換し、JPEG Blob を返す */
async function warpFile(
  file: File,
  dispCorners: Point[],
  disp: { w: number; h: number },
  natural: { w: number; h: number }
): Promise<Blob | null> {
  const img = await loadImage(URL.createObjectURL(file));
  // 作業解像度は長辺2200pxまで（メモリ/速度対策・OCRには十分）
  const WORK_MAX = 2200;
  const workScale = Math.min(1, WORK_MAX / Math.max(natural.w, natural.h));
  const sw = Math.round(natural.w * workScale);
  const sh = Math.round(natural.h * workScale);
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = sw; srcCanvas.height = sh;
  const sctx = srcCanvas.getContext("2d");
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0, sw, sh);
  const srcData = sctx.getImageData(0, 0, sw, sh);

  // 表示座標 → 作業(縮小自然)座標
  const dispToWork = (p: Point): Point => ({
    x: (p.x / disp.w) * sw,
    y: (p.y / disp.h) * sh,
  });
  const srcCorners = dispCorners.map(dispToWork);
  const out = estimateOutputSize(srcCorners);
  const outW = Math.max(200, Math.min(WORK_MAX, out.width));
  const outH = Math.max(200, Math.min(WORK_MAX * 1.6, out.height));

  // 出力→ソース のホモグラフィ（逆写像でサンプリング）
  const dstRect: Point[] = [
    { x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH },
  ];
  const H = solveHomography(dstRect, srcCorners);

  const outData = new ImageData(outW, outH);
  const s = srcData.data, o = outData.data;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const p = applyHomography(H, x + 0.5, y + 0.5);
      const oi = (y * outW + x) * 4;
      // バイリニア補間
      if (p.x < 0 || p.y < 0 || p.x >= sw - 1 || p.y >= sh - 1) {
        o[oi] = o[oi + 1] = o[oi + 2] = 255; o[oi + 3] = 255;
        continue;
      }
      const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
      const fx = p.x - x0, fy = p.y - y0;
      for (let c = 0; c < 3; c++) {
        const i00 = (y0 * sw + x0) * 4 + c;
        const i10 = i00 + 4;
        const i01 = i00 + sw * 4;
        const i11 = i01 + 4;
        o[oi + c] =
          s[i00] * (1 - fx) * (1 - fy) +
          s[i10] * fx * (1 - fy) +
          s[i01] * (1 - fx) * fy +
          s[i11] * fx * fy;
      }
      o[oi + 3] = 255;
    }
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW; outCanvas.height = outH;
  outCanvas.getContext("2d")!.putImageData(outData, 0, 0);
  return await new Promise<Blob | null>((resolve) => outCanvas.toBlob((b) => resolve(b), "image/jpeg", 0.9));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}
