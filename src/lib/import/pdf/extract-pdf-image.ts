/**
 * スキャンPDF（CamScanner等・テキスト層なし）から埋め込みJPEG画像を抽出する。
 *
 * 背景：スキャンPDFを OCR.space へ直接（filetype=PDF, Engine1）送ると、表構造が崩れ
 * 座標が乱れて配車No等の復元に失敗する（実データで確認）。
 * PDF内の埋め込み画像（DCTDecode=JPEG）を取り出して「画像OCR（Engine2）」に回すと
 * 座標が安定し復元精度が大幅に向上する。
 *
 * 実装方針：外部依存（poppler/ghostscript等）を使わず、PDFバイト列から
 * JPEG SOI(FFD8FF)〜EOI(FFD9) ブロックを走査して最大のものを返す軽量抽出。
 * DCTDecode 以外（FlateDecode の生ラスタ等）は対象外→null を返し、呼び出し側は
 * 従来の PDF→Engine1 経路にフォールバックする。
 */

/** PDFバッファから最大の埋め込みJPEGを抽出（無ければ null） */
export function extractLargestJpegFromPdf(pdf: Buffer): Buffer | null {
  let best: Buffer | null = null;
  let i = 0;
  const len = pdf.length;
  while (i < len - 3) {
    // JPEG SOI: FF D8 FF
    if (pdf[i] === 0xff && pdf[i + 1] === 0xd8 && pdf[i + 2] === 0xff) {
      // 対応する EOI: FF D9 を探す
      let j = i + 3;
      let end = -1;
      while (j < len - 1) {
        if (pdf[j] === 0xff && pdf[j + 1] === 0xd9) {
          end = j + 2;
          break;
        }
        j++;
      }
      if (end < 0) break;
      const block = pdf.subarray(i, end);
      if (!best || block.length > best.length) best = Buffer.from(block);
      i = end;
    } else {
      i++;
    }
  }
  // 明らかに小さすぎる（サムネイル/アイコン）ものは除外
  if (best && best.length < 5000) return null;
  return best;
}
