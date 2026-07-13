/**
 * LINEトーク履歴エクスポート（.txt）から「ウェーブ終了（帰庫）」を抽出する。
 *
 * 群【楽天ネットスーパー美女木】では CARIO bot が次の文言を投稿する:
 *   {名前} {N}W出発 - {号車} {エリア} {件数}件
 *   {名前} {N}W帰庫 {HH:MM}          ← ウェーブ終了（これを1台として数える）
 *   {名前} が業務を終了しました        ← 業務終了（日単位・台数には数えない）
 *
 * 過去日は CARIO API `/api/rakuten/wave`（当日固定）では取れないため、
 * 本エクスポートを取り込んで台数確認表（貼付）を遡って埋める用途。
 *
 * 行フォーマット（LINE標準エクスポート）:
 *   日付見出し:  "2026.06.23 火曜日"
 *   メッセージ:  "{HH:MM}\t{送信者}\t{本文}"（タブ区切り）または半角/全角スペース区切り
 */
import { parseWaveNo } from "@/lib/waves";
import type { NormalizedCompletion } from "./getCompletions";

/** "2026.06.23" → "2026-06-23" */
function normDate(y: string, m: string, d: string): string {
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const DATE_HEADER = /^(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})(?:\s|\(|$)/;
// 帰庫行: 先頭に投稿時刻、送信者(CARIO)、本文 "{名前} {N}W帰庫 {HH:MM}"
// 送信者と名前の間・名前中の空白（全角/半角/タブ）を許容し、名前は最短一致で取る。
const KIKO = /(?:CARIO)[\s　\t]+(.+?)[\s　\t]*([1-6])W帰庫[\s　\t]+(\d{1,2}:\d{2})/;
// 業務終了行: "{名前} が業務を終了しました（{N}W完了）" → そのドライバーが W1〜WN を完了＝各waveに1台。
// 6/27以降はこの形式が主流（per-wave帰庫の投稿が無い日をカバー）。全角/半角括弧を許容。
const WORK_END = /(?:CARIO)[\s　\t]+(.+?)[\s　\t]*が業務を終了しました[（(]([1-6])W完了[）)]/;

export interface ParsedLineExport {
  completions: NormalizedCompletion[];
  /** 取り込んだ日付("YYYY-MM-DD")一覧（重複なし・昇順） */
  dates: string[];
  /** 帰庫イベント総数 */
  events: number;
}

/**
 * LINEエクスポート本文をパースして帰庫（ウェーブ終了）完了に変換する。
 * 1帰庫 = 貼付1台（driverKeyは氏名ベース）。増車判別はLINE文言に無いため貼付固定。
 */
export function parseLineExport(text: string): ParsedLineExport {
  const lines = text.split(/\r?\n/);
  let currentDate: string | null = null;
  const completions: NormalizedCompletion[] = [];
  const dateSet = new Set<string>();

  for (const line of lines) {
    const dh = line.match(DATE_HEADER);
    if (dh) {
      currentDate = normDate(dh[1]!, dh[2]!, dh[3]!);
      continue;
    }
    if (!currentDate) continue;

    // ① 帰庫行: {名前} {N}W帰庫 {HH:MM} → そのwaveを1台
    if (line.includes("W帰庫")) {
      const m = line.match(KIKO);
      if (!m) continue;
      const name = m[1]!.trim().replace(/[　\s]+$/g, "");
      const waveNo = parseWaveNo(m[2]!);
      const time = m[3]!;
      if (!waveNo || !name) continue;
      completions.push({
        workDate: currentDate, waveNo, vehicleType: "貼付",
        driverCarioId: null, driverName: name,
        completedAt: `${currentDate}T${time.padStart(5, "0")}:00`, count: null,
      });
      dateSet.add(currentDate);
      continue;
    }

    // ② 業務終了行: {名前} が業務を終了しました（{N}W完了）→ W1〜WN を各1台
    //    （6/27以降の主流。per-wave帰庫が無い日をカバー。同一driver×waveは後段で重複排除）
    if (line.includes("業務を終了しました")) {
      const m = line.match(WORK_END);
      if (!m) continue; // "（NW完了）"が無い素の終了報告はwave数不明のためスキップ
      const name = m[1]!.trim().replace(/[　\s]+$/g, "");
      const maxWave = parseWaveNo(m[2]!);
      if (!name || !maxWave) continue;
      for (let w = 1; w <= maxWave; w++) {
        completions.push({
          workDate: currentDate, waveNo: w, vehicleType: "貼付",
          driverCarioId: null, driverName: name, completedAt: null, count: null,
        });
      }
      dateSet.add(currentDate);
      continue;
    }
  }

  return {
    completions,
    dates: [...dateSet].sort(),
    events: completions.length,
  };
}
