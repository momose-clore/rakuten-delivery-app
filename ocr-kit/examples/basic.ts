/**
 * ocr-kit 使い方サンプル
 *   実行: npx tsx examples/basic.ts <ファイルパス>
 *   画像/PDFのOCRを行う場合は OCR_SPACE_API_KEY を環境変数に設定してください。
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { configure, parseDispatchFile, parseDispatchFileWithRescue } from "../src/index";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("usage: tsx examples/basic.ts <path-to-file(.csv|.xlsx|.pdf|.jpg|.png)>");
    process.exit(1);
  }

  // OCR.space APIキー（画像/スキャンPDFで必要）
  configure({ apiKey: process.env.OCR_SPACE_API_KEY });

  const buffer = readFileSync(filePath);
  const { rows, source, ocr } = await parseDispatchFile({ buffer, filename: basename(filePath) });

  console.log(`source        : ${source}`);
  if (ocr) console.log(`ocr quality   : ${ocr.qualityScore ?? "-"} / conf: ${ocr.overallConfidence}`);
  console.log(`rows extracted: ${rows.length}`);
  console.log("--- 先頭3行 ---");
  for (const r of rows.slice(0, 3)) {
    console.log(JSON.stringify({
      rowNo: r.rowNo,
      dispatchKey: r.dispatchKey,
      waveNo: r.waveNo,
      customerName: r.customerName,
      address: r.address,
      totalCount: r.totalCount,
      confidence: r.confidence,
      notes: r.notes,
    }));
  }

  // 自動救済つき
  const rescued = await parseDispatchFileWithRescue({ buffer, filename: basename(filePath) });
  const rescuedCount = rescued.rescuedRows.filter((r) => r.autoRescued).length;
  console.log(`--- 自動救済: ${rescuedCount}/${rescued.rescuedRows.length} 行を補正 ---`);
}

main().catch((e) => { console.error(e); process.exit(1); });
