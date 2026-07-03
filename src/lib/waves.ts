/**
 * 配達時間帯（Wave / 便）と遅配（遅延）判定の単一の真実源。
 *
 * 業務ルール（riku 提供・2026-07-03）:
 *   各 Wave には配達時間帯があり、**時間帯の終了時刻を過ぎて配達すると「遅配（遅延）」扱い**になる。
 *
 *   w1 10:00〜12:00 / w2 12:00〜14:00 / w3 14:00〜16:00
 *   w4 16:00〜18:00 / w5 19:00〜20:00 / w6 20:00〜22:00
 *
 * ※ 全ターミナル共通で本ファイルを import して使うこと（値をハードコードしない）。
 *    表示・進捗・アラート・ダッシュボード等で「遅配」を統一判定するため。
 */

export interface WaveWindow {
  /** 正規化Wave番号 1〜6 */
  no: number;
  /** キー "w1"〜"w6" */
  key: string;
  /** 表示ラベル "1便" 等 */
  label: string;
  /** 開始 "HH:MM"（JST） */
  start: string;
  /** 終了（この時刻を過ぎると遅配）"HH:MM"（JST） */
  end: string;
}

export const WAVE_WINDOWS: WaveWindow[] = [
  { no: 1, key: "w1", label: "1便", start: "10:00", end: "12:00" },
  { no: 2, key: "w2", label: "2便", start: "12:00", end: "14:00" },
  { no: 3, key: "w3", label: "3便", start: "14:00", end: "16:00" },
  { no: 4, key: "w4", label: "4便", start: "16:00", end: "18:00" },
  { no: 5, key: "w5", label: "5便", start: "19:00", end: "20:00" },
  { no: 6, key: "w6", label: "6便", start: "20:00", end: "22:00" },
];

/** 各種表記（"w6" / "6w" / "6" / "6便" / "W6" 等）から Wave番号(1〜6)を取り出す */
export function parseWaveNo(waveNo: string | null | undefined): number | null {
  if (!waveNo) return null;
  const m = String(waveNo).match(/([1-6])/);
  return m ? Number(m[1]) : null;
}

/** Wave番号/表記から時間帯を引く */
export function waveWindowOf(waveNo: string | number | null | undefined): WaveWindow | null {
  const no = typeof waveNo === "number" ? waveNo : parseWaveNo(waveNo ?? null);
  return WAVE_WINDOWS.find((w) => w.no === no) ?? null;
}

/** "HH:MM" を当日の分数(0-1439)へ */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + (m ?? 0);
}

/** Date を JST の当日分数(0-1439)へ */
function jstMinutes(at: Date): number {
  const jst = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

/**
 * 指定時刻(JST基準)がその Wave の時間帯を過ぎている＝遅配かどうか。
 * @param at 判定時刻（配達完了時刻 or 現在時刻）。既定は現在。
 * @returns 遅配なら true。Wave不明なら false。
 */
export function isLate(waveNo: string | number | null | undefined, at: Date = new Date()): boolean {
  const w = waveWindowOf(waveNo);
  if (!w) return false;
  return jstMinutes(at) > toMinutes(w.end);
}

/**
 * 締切（時間帯終了）までの残り分。負なら超過（遅配）分。Wave不明なら null。
 */
export function minutesToDeadline(waveNo: string | number | null | undefined, at: Date = new Date()): number | null {
  const w = waveWindowOf(waveNo);
  if (!w) return null;
  return toMinutes(w.end) - jstMinutes(at);
}

/** 遅配ステータス（UI表示用）: ON_TIME 余裕 / SOON 締切30分以内 / LATE 超過 / UNKNOWN */
export function deliveryTimingStatus(
  waveNo: string | number | null | undefined,
  at: Date = new Date()
): "ON_TIME" | "SOON" | "LATE" | "UNKNOWN" {
  const rem = minutesToDeadline(waveNo, at);
  if (rem === null) return "UNKNOWN";
  if (rem < 0) return "LATE";
  if (rem <= 30) return "SOON";
  return "ON_TIME";
}
