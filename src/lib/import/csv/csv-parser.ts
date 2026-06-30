import type { NormalizedDispatchRow } from "@/types/import";
import { detectHeaderRow } from "@/lib/import/header-mapper";
import { extractDispatchKey } from "@/lib/ocr/extractors/dispatch-key";
import { extractInvoiceNo } from "@/lib/ocr/extractors/invoice";
import { extractPhone } from "@/lib/ocr/extractors/phone";
import { extractAddress } from "@/lib/ocr/extractors/address";
import { extractCounts } from "@/lib/ocr/extractors/counts";
import { extractName } from "@/lib/ocr/extractors/name";
import type { FieldName } from "@/lib/ocr/table-template";

/** CSV テキストをパース */
export function parseCsvText(csvText: string, defaultWaveNo?: string): NormalizedDispatchRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  const rows = lines.map((l) => parseCSVLine(l));

  const headerInfo = detectHeaderRow(rows);
  if (!headerInfo) return [];

  const { headerIdx, mapping } = headerInfo;
  const dataRows = rows.slice(headerIdx + 1).filter((r) => r.some((c) => c.trim()));

  return dataRows.map((row, idx) => {
    const get = (field: FieldName) => {
      const colIdx = Object.entries(mapping).find(([, v]) => v === field)?.[0];
      return colIdx !== undefined ? (row[parseInt(colIdx)] ?? "") : "";
    };

    const { value: address } = extractAddress(get("address"));
    const { value: phone, valid: phoneValid } = extractPhone(get("customerPhone"));
    const { normalOricon, coolerBox, caseCount, totalCount } = extractCounts(
      get("normalOricon"), get("coolerBox"), get("caseCount"), get("totalCount")
    );

    const notes: string[] = [];
    if (!address) notes.push("ADDRESS_EMPTY");
    if (!phoneValid && get("customerPhone")) notes.push("PHONE_INVALID");
    const n = normalOricon ?? 0, c = coolerBox ?? 0, k = caseCount ?? 0, t = totalCount ?? 0;
    if (t > 0 && n + c + k !== t) notes.push("COUNT_MISMATCH");

    return {
      source: "csv" as const,
      rowNo: idx + 1,
      waveNo: defaultWaveNo ?? undefined,
      dispatchKey: extractDispatchKey(get("dispatchKey"), defaultWaveNo),
      invoiceNo: extractInvoiceNo(get("invoiceNo")),
      customerName: extractName(get("customerName")),
      customerPhone: phoneValid ? phone : null,
      address,
      specialFlag: get("specialFlag") || null,
      normalOriconCount: normalOricon ?? 0,
      coolerBoxCount: coolerBox ?? 0,
      caseCount: caseCount ?? 0,
      totalCount: totalCount ?? 0,
      memo: get("memo") || null,
      confidence: notes.length === 0 ? "high" : notes.length <= 1 ? "medium" : "low",
      notes,
    } satisfies NormalizedDispatchRow;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if ((ch === "," || ch === "\t") && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
