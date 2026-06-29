/** dispatch-images 用ファイル名を生成する
 *  形式: {YYYYMMDD}_{area}_{waveNo}_{timestamp}.{ext}
 *  例:   20260626_東京_W1_1719369600000.jpg
 */
export function generateDispatchImageFilename(
  deliveryDate: string,
  area: string,
  waveNo: string,
  originalExt: string
): string {
  const dateStr = deliveryDate.replace(/-/g, "");
  const safeArea = area.replace(/[^a-zA-Z0-9ぁ-んァ-ン一-龠]/g, "_");
  const safeWave = waveNo.replace(/[^a-zA-Z0-9]/g, "_");
  const ts = Date.now();
  return `${dateStr}_${safeArea}_${safeWave}_${ts}.${originalExt}`;
}

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedExtension(ext: string): ext is AllowedExtension {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}
