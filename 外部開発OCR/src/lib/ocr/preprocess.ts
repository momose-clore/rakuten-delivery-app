import sharp from "sharp";

/**
 * OCR 前処理：画像を鮮明化してテキスト認識精度を向上させる
 *
 * 処理内容:
 * 1. 拡大（小さい画像を 2000px 幅に拡大）
 * 2. グレースケール変換（色ノイズ除去）
 * 3. コントラスト正規化（明暗を均一化）
 * 4. シャープネス強化（文字のエッジを鮮明に）
 */
export async function preprocessImageForOcr(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 1000;

  // 2000px 未満の場合は拡大（OCR精度向上のため）
  const targetWidth = width < 2000 ? 2000 : width;

  return sharp(buffer)
    .resize(targetWidth, null, {
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3, // 高品質な拡大アルゴリズム
    })
    .grayscale()
    .normalize() // コントラスト自動調整
    .sharpen({
      sigma: 1.5,   // シャープネス強度
      m1: 1.5,      // フラット領域のシャープネス
      m2: 0.7,      // エッジのシャープネス
    })
    .jpeg({ quality: 95 }) // 高品質 JPEG として出力
    .toBuffer();
}
