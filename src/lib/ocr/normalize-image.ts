import sharp from "sharp";

/**
 * アップロード画像を JPEG に正規化する。
 * iPhone の HEIC/HEIF を JPEG に変換し、EXIF 回転も焼き込む（Android/iPhone 共通で扱えるように）。
 * sharp が扱えない形式の場合は原本をそのまま返す（後段で判定）。
 */
export async function normalizeToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buffer).metadata();
    // すでにJPEGでEXIF回転も無ければそのまま
    if (meta.format === "jpeg" && !meta.orientation) return buffer;
    return await sharp(buffer).rotate().jpeg({ quality: 90 }).toBuffer();
  } catch {
    // HEIC非対応ビルド等で変換に失敗した場合は原本を返す
    return buffer;
  }
}
