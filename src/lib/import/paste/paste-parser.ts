import { parseCsvText } from "@/lib/import/csv/csv-parser";
import type { NormalizedDispatchRow } from "@/types/import";

/** 区切り文字を自動判定 */
function detectDelimiter(text: string): string {
  const tabs = (text.match(/\t/g) ?? []).length;
  const commas = (text.match(/,/g) ?? []).length;
  return tabs >= commas ? "\t" : ",";
}

/** HTML テーブルをテキストに変換 */
function htmlTableToText(html: string): string {
  const rows: string[] = [];
  const trMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
  for (const tr of trMatches) {
    const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? [])
      .map((td) => td.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
    rows.push(cells.join("\t"));
  }
  return rows.join("\n");
}

/** 貼り付けテキストをパース */
export function parsePasteText(text: string, defaultWaveNo?: string): NormalizedDispatchRow[] {
  let normalized = text;

  // HTML テーブルの場合は変換
  if (/<table/i.test(text)) {
    normalized = htmlTableToText(text);
  }

  // 区切り文字を統一
  const delim = detectDelimiter(normalized);
  if (delim !== ",") {
    normalized = normalized.replace(new RegExp(delim, "g"), ",");
  }

  const rows = parseCsvText(normalized, defaultWaveNo);
  return rows.map((r) => ({ ...r, source: "paste" as const }));
}
