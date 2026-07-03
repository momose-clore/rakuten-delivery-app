// ハートビート共有ロジック（per-id ファイル方式・競合しない）
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

export const HB_DIR = new URL("../.claude/heartbeats/", import.meta.url);
export const REGISTRY = new URL("../docs/terminals.json", import.meta.url);

/** 自分の稼働を記録（.claude/heartbeats/<id> に "ISO\tstatus"）*/
export function writeHeartbeat(id, status = "") {
  try {
    mkdirSync(HB_DIR, { recursive: true });
    writeFileSync(new URL(`./${id}`, HB_DIR), `${new Date().toISOString()}\t${status}`);
    return true;
  } catch {
    return false;
  }
}

/** 全ターミナルの状態を読む（名簿 + ハートビート） */
export function readAll() {
  const reg = JSON.parse(readFileSync(REGISTRY, "utf8")).terminals;
  const out = {};
  for (const [id, meta] of Object.entries(reg)) {
    let lastSeenAt = null, status = "";
    try {
      const [iso, ...rest] = readFileSync(new URL(`./${id}`, HB_DIR), "utf8").split("\t");
      lastSeenAt = iso || null;
      status = rest.join("\t").trim();
    } catch { /* 未報告 */ }
    out[id] = { ...meta, lastSeenAt, status };
  }
  return out;
}

/** 稼働マーク判定 */
export function mark(iso) {
  if (!iso) return { e: "⚪", t: "未起動/未報告" };
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 10) return { e: "🟢", t: `稼働中（${min}分前）` };
  if (min < 60) return { e: "🟡", t: `アイドル（${min}分前）` };
  return { e: "⚪", t: `停止?（${min}分前）` };
}
