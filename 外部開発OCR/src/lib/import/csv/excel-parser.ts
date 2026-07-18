import * as XLSX from "xlsx";
import { parseCsvText } from "./csv-parser";

/** Excel / CSV バッファをパース */
export function parseExcelBuffer(buffer: Buffer, defaultWaveNo?: string) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const results = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const rows = parseCsvText(csv, defaultWaveNo);
    if (rows.length > 0) results.push(...rows.map((r) => ({ ...r, source: "excel" as const })));
  }

  return results;
}
