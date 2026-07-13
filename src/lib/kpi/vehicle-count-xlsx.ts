/**
 * 台数確認表の Excel(.xlsx) を生成する。
 * 既存の「③デポ美女木 台数管理表」と同じセル配置を再現する:
 *   - B1 期間 / C1 "台数確認表"
 *   - 6・7行目: 日付(Excelシリアル値)を各日の先頭列(貼付列)に
 *   - 8行目: 各日 3列 = 貼付 / SP / 増車
 *   - 9〜14行目: W1〜W6（C列にラベル）
 *   - 15行目: 合計（C15="合計", B15="美女木デポ"）
 *   - 列: D列(=4列目)から1日ごとに3列ずつ。貼付=先頭, SP=+1, 増車=+2
 */
import * as XLSX from "xlsx";
import { WAVE_WINDOWS } from "@/lib/waves";
import type { MonthlyVehicleCounts } from "@/lib/kpi/vehicle-count";

/** "YYYY-MM-DD" → Excelシリアル値（1900日付システム / 1899-12-30 起点） */
function toSerial(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((Date.UTC(y!, m! - 1, d!) - epoch) / 86_400_000);
}

/** セルアドレス（0-based row/col → "A1"形式） */
function addr(r: number, c: number): string {
  return XLSX.utils.encode_cell({ r, c });
}

/** "YYYY-MM-DD" → 曜日（日本語1文字） */
function weekdayJa(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return ["日", "月", "火", "水", "木", "金", "土"][dow]!;
}

/**
 * 月次集計から xlsx バッファを生成する。
 * @returns Node Buffer（.xlsx バイナリ）
 */
export function buildVehicleCountWorkbook(data: MonthlyVehicleCounts): Buffer {
  const [y, m] = data.month.split("-").map(Number);
  const ws: XLSX.WorkSheet = {};

  // 見出し
  const lastDay = data.days.length;
  ws[addr(0, 1)] = { t: "s", v: `${m}/1～${m}/${lastDay}` }; // B1
  ws[addr(0, 2)] = { t: "s", v: "台数確認表" };               // C1
  ws[addr(13, 0)] = { t: "s", v: "店舗コード" };              // A14
  ws[addr(13, 1)] = { t: "s", v: "店舗名" };                  // B14
  ws[addr(14, 1)] = { t: "s", v: "美女木デポ" };              // B15
  ws[addr(14, 2)] = { t: "s", v: "合計" };                    // C15

  // W1〜W6 ラベル（C列 = index2, 行9〜14 = index8〜13）
  WAVE_WINDOWS.forEach((w, i) => {
    ws[addr(8 + i, 2)] = { t: "s", v: `W${w.no}` };
  });

  const HEADERS = ["貼付", "SP", "増車"] as const;

  // 各日: D列(index3)から3列ずつ
  data.days.forEach((dayKey, i) => {
    const base = 3 + i * 3; // 貼付列（0-based）
    const serial = toSerial(dayKey);
    // 6行目=日付 / 7行目=曜日（先頭列のみ・テンプレの2行を日付＋曜日に）
    ws[addr(5, base)] = { t: "n", v: serial, z: "m/d" };
    ws[addr(6, base)] = { t: "s", v: weekdayJa(dayKey) };
    // 8行目: 貼付/SP/増車
    HEADERS.forEach((h, k) => { ws[addr(7, base + k)] = { t: "s", v: h }; });

    // 合計（列ごと）
    let sumH = 0, sumS = 0, sumZ = 0;
    WAVE_WINDOWS.forEach((w, r) => {
      const cell = data.cells[dayKey]?.[w.no] ?? { haritsuke: 0, sp: 0, zosha: 0 };
      ws[addr(8 + r, base)] = { t: "n", v: cell.haritsuke };
      ws[addr(8 + r, base + 1)] = { t: "n", v: cell.sp };
      ws[addr(8 + r, base + 2)] = { t: "n", v: cell.zosha };
      sumH += cell.haritsuke; sumS += cell.sp; sumZ += cell.zosha;
    });
    // 15行目 合計
    ws[addr(14, base)] = { t: "n", v: sumH };
    ws[addr(14, base + 1)] = { t: "n", v: sumS };
    ws[addr(14, base + 2)] = { t: "n", v: sumZ };
  });

  // 参照範囲
  const lastCol = 3 + data.days.length * 3 - 1;
  ws["!ref"] = `A1:${addr(14, Math.max(lastCol, 2))}`;

  const wb = XLSX.utils.book_new();
  const sheetName = `${y! % 100}年${m}月`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
