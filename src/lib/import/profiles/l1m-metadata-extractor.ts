import type { L1MMetadata } from "@/types/import";
import { correctDigitMisreads, toHalfWidth } from "@/lib/ocr/misread-dictionary";

/** L1M配車表の上部メタ情報を抽出 */
export function extractL1MMetadata(rawText: string): L1MMetadata {
  const meta: L1MMetadata = {};

  // タイトル
  const titleMatch = rawText.match(/L1M貨物一覧表|配車予定表/);
  if (titleMatch) meta.title = titleMatch[0];

  // 拠点名（例: 美女木）
  const depotMatch = rawText.match(/([^\s\d]{2,6})\s*(?:W[1-6]|ウェーブ)/);
  if (depotMatch) meta.depotName = depotMatch[1];

  // W番号
  const waveMatch = rawText.match(/\b(W[1-6])\b/i);
  if (waveMatch) meta.waveNo = waveMatch[1].toUpperCase();

  // 配送日
  const dateMatch = rawText.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
  if (dateMatch) {
    meta.deliveryDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  }

  // 号車（例: 10号車(1/1)）
  const vehicleMatch = rawText.match(/(\d+)号車[（(](\d+\/\d+)[）)]/);
  if (vehicleMatch) {
    meta.vehicleNo = vehicleMatch[1];
    meta.pageInfo = vehicleMatch[2];
  } else {
    const simpleVehicle = rawText.match(/(\d+)号車/);
    if (simpleVehicle) meta.vehicleNo = simpleVehicle[1];
  }

  // 右上総数ボックス（常温/クーラー/ケース数/箱数計 or 荷数計）。ラベル行の直後に数値行が
  // 来るため、ラベル群＋続く数値まで含めて拾う。帳票により「箱数計」表記のこともある。
  const summaryBlock = rawText.match(
    /常温[\s\S]{0,80}(?:クーラー|クーラ)[\s\S]{0,80}ケース[\s\S]{0,80}(?:箱数計|荷数計|箱数|荷数|箱計|数計)[\s\S]{0,80}/
  );
  if (summaryBlock) {
    const nums = summaryBlock[0].match(/\d+/g) ?? [];
    if (nums.length >= 4) {
      meta.summaryNormalOriconCount = parseInt(correctDigitMisreads(toHalfWidth(nums[0] ?? "0")), 10);
      meta.summaryCoolerBoxCount = parseInt(correctDigitMisreads(toHalfWidth(nums[1] ?? "0")), 10);
      meta.summaryCaseCount = parseInt(correctDigitMisreads(toHalfWidth(nums[2] ?? "0")), 10);
      meta.summaryTotalCount = parseInt(correctDigitMisreads(toHalfWidth(nums[3] ?? "0")), 10);
    }
  }

  return meta;
}
