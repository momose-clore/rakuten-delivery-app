/**
 * 「楽天マート 増車申請」LINEエクスポートから **美女木デポの増便のみ** を抽出する。
 *
 * 群では人が手書きで申請するため形式がまちまち。主に2形式に対応:
 *   A) サマリ型:  "★美女木デポ" の直後に "・{氏名} {N}件（{便リスト}）" 行 … "計{N}件"
 *   B) 申請フォーム型: "美女木デポ" → "該当便" → 便(例 W6 / 4w.6w) → "台数" → "N台"
 *   ・"計0件" / "増便申請なし" は 0（無視）
 *
 * 便リスト例: "6W" / "4W 6W" / "４～６W"(範囲) / "6w" を wave番号集合へ。
 * 日付は見出し(2026.07.04)ベース。ただし "7/3分" ラベルがあればその日付に付け替える。
 * 出力: 便別の増車台数（同一便に複数ドライバー/号車なら加算）。
 */

/** 全角数字/チルダ→半角 */
function toHalf(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[〜～]/g, "~");
}

/**
 * "6W" / "4W 6W" / "4~6W" / "4w.6w" → wave番号(1-6)の集合。
 * ※「N号車」「N～M号車」は号車番号なので wave として拾わない（除去してから解析）。
 */
function parseWaves(raw: string): number[] {
  // 号車表記を除去（"1～5号車" / "14号車" 等）
  const s = toHalf(raw).replace(/\d+\s*~\s*\d+\s*号車/g, " ").replace(/\d+\s*号車/g, " ");
  const waves = new Set<number>();
  // 範囲 "4~6W" / "W4~W6"
  for (const m of s.matchAll(/[wW]?\s*([1-6])\s*~\s*[wW]?\s*([1-6])\s*[wW]?/g)) {
    // 少なくとも一方に W が付く範囲のみ便とみなす（"1~5号車"は上で除去済）
    if (!/[wW]/.test(m[0])) continue;
    const a = Number(m[1]), b = Number(m[2]);
    for (let w = Math.min(a, b); w <= Math.max(a, b); w++) waves.add(w);
  }
  // 個別 "6W"(数字→W) / "W6"(W→数字) 両対応
  for (const m of s.matchAll(/([1-6])\s*[wW]/g)) waves.add(Number(m[1]));
  for (const m of s.matchAll(/[wW]\s*([1-6])/g)) waves.add(Number(m[1]));
  return [...waves].sort();
}

/** "W5 8台" / "6w 1台" のような「便＋台数」を取り出す（フォーム型の台数行用） */
function parseWaveCount(raw: string): { waveNo: number; count: number } | null {
  const s = toHalf(raw).replace(/\d+\s*号車/g, " ");
  // "W5 8台"（W→数字）
  let m = s.match(/[wW]\s*([1-6])\D*?(\d+)\s*台/);
  if (m) return { waveNo: Number(m[1]), count: Number(m[2]) };
  // "6w 1台"（数字→W）
  m = s.match(/([1-6])\s*[wW]\D*?(\d+)\s*台/);
  if (m) return { waveNo: Number(m[1]), count: Number(m[2]) };
  return null;
}

export interface ExtraVehicleItem {
  date: string;    // "YYYY-MM-DD"
  waveNo: number;  // 1-6
  count: number;   // 台数
  note?: string;   // 抽出根拠（氏名/号車など）
}
export interface ParsedExtraVehicle {
  items: ExtraVehicleItem[];       // 便別に集約前の生抽出
  byCell: Record<string, number>;  // "date|wave" → 台数（集約後）
  dates: string[];
}

const DATE_HEADER = /^(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})(?:\s|\(|$)/;
/** "7/3分" のような対象日ラベル */
const BUN_LABEL = /(\d{1,2})\s*[\/／]\s*(\d{1,2})\s*分/;

export function parseExtraVehicleLine(text: string): ParsedExtraVehicle {
  const lines = text.split(/\r?\n/);
  let headerDate: string | null = null;
  let year = new Date().getFullYear();
  const items: ExtraVehicleItem[] = [];

  // 美女木ブロック処理中の状態
  let inBijogi = false;
  let blockDate: string | null = null;
  let formWaves: number[] = [];              // フォーム型の「該当便」蓄積
  let explicitCounts: Map<number, number> = new Map(); // "W5 8台" 明示
  let expectForm: "" | "wave" | "count" = "";

  const pushForm = () => {
    if (inBijogi) {
      if (explicitCounts.size > 0) {
        for (const [w, c] of explicitCounts) items.push({ date: blockDate!, waveNo: w, count: c, note: "form" });
      } else {
        for (const w of formWaves) items.push({ date: blockDate!, waveNo: w, count: 1, note: "form" });
      }
    }
    formWaves = [];
    explicitCounts = new Map();
    expectForm = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const dh = line.match(DATE_HEADER);
    if (dh) {
      pushForm();
      inBijogi = false;
      year = Number(dh[1]);
      headerDate = `${dh[1]}-${dh[2]!.padStart(2, "0")}-${dh[3]!.padStart(2, "0")}`;
      continue;
    }
    if (!headerDate) continue;

    // 別デポに入ったら美女木ブロック終了
    if (/デポ/.test(line) && !/美女木/.test(line)) { pushForm(); inBijogi = false; }

    if (/美女木/.test(line) && /デポ/.test(line)) {
      pushForm();
      inBijogi = true;
      // "7/3分" ラベルが同一行にあればその日付、なければ見出し日
      const bun = line.match(BUN_LABEL);
      blockDate = bun ? `${year}-${bun[1]!.padStart(2, "0")}-${bun[2]!.padStart(2, "0")}` : headerDate;
      // 計0件 / 申請なし
      if (/計\s*0\s*件|増便.*なし|申請.*なし/.test(line)) { inBijogi = false; }
      expectForm = "";
      continue;
    }

    if (!inBijogi) continue;
    if (/計\s*0\s*件|増便.*なし|申請.*なし/.test(line)) { inBijogi = false; pushForm(); continue; }

    // サマリ型: "・{氏名} {N}件（{便}）"
    if (/^[・･]/.test(line) && /[（(]/.test(line)) {
      const paren = line.match(/[（(]([^）)]*)[）)]/);
      if (paren) {
        const ws = parseWaves(paren[1]!);
        const nameM = line.match(/^[・･]\s*([^\s（(0-9]+)/);
        for (const w of ws) items.push({ date: blockDate!, waveNo: w, count: 1, note: nameM?.[1]?.trim() });
      }
      continue;
    }

    // フォーム型: 「該当便」→ 便、「台数」→ N台（"W5 8台" は明示カウント）
    if (/該当便/.test(line)) { expectForm = "wave"; continue; }
    if (/台数/.test(line)) { expectForm = "count"; continue; }
    if (expectForm === "count") {
      const wc = parseWaveCount(line);
      if (wc) explicitCounts.set(wc.waveNo, (explicitCounts.get(wc.waveNo) ?? 0) + wc.count);
      continue;
    }
    if (expectForm === "wave") {
      const ws = parseWaves(line);
      if (ws.length) formWaves.push(...ws);
      // 便行が続く場合もあるので expectForm は維持（次が台数/別行で切替）
      continue;
    }
  }
  pushForm();

  // 同一日に「サマリ型(・氏名)」があれば、その日の「フォーム型」は二重計上防止のため無視する
  const datesWithSummary = new Set(items.filter((i) => i.note !== "form").map((i) => i.date));
  const kept = items.filter((i) => i.note !== "form" || !datesWithSummary.has(i.date));

  // 便別に集約
  const byCell: Record<string, number> = {};
  for (const it of kept) {
    const k = `${it.date}|${it.waveNo}`;
    byCell[k] = (byCell[k] ?? 0) + it.count;
  }
  const dates = [...new Set(kept.map((i) => i.date))].sort();
  return { items: kept, byCell, dates };
}
