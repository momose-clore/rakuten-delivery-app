/**
 * ブラウザで画像ファイルを JPEG に正規化する（HEIC/HEIF 対策）。
 * iPhone の HEIC はサーバーの sharp(libheif) がセキュリティ制限で復号できないことがあり、
 * 生HEICのまま OCR.space に送られると読み取りが崩れる。
 * Safari は <img> で HEIC を復号できるため、キャンバス経由で JPEG に再エンコードして送る。
 * 変換に失敗した場合は元ファイルを返す（フォールバック安全）。
 */
export async function normalizeToJpegBlob(file: Blob, maxEdge = 4000): Promise<Blob> {
  // 既に JPEG で十分小さいならそのまま
  if (file.type === "image/jpeg") return file;
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.92));
      return blob ?? file;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return file;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}
