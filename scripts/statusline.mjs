#!/usr/bin/env node
/**
 * Claude Code ステータスライン: このターミナルの名前・役割を常時表示し、
 * 表示のたびに自分のハートビートを自動記録する（＝開いている間は稼働ボードで🟢）。
 *
 * 各ターミナルで起動前に自分のIDを設定:
 *   export TERMINAL_ID=alpha   # または beta / gamma
 *   claude
 */
import { readFileSync } from "node:fs";
import { writeHeartbeat, readAll } from "./_heartbeat-lib.mjs";

// stdin(セッションJSON)は使わないが詰まり防止で読み捨て
try { readFileSync(0, "utf8"); } catch { /* noop */ }

const id = process.env.TERMINAL_ID || "";
const all = (() => { try { return readAll(); } catch { return {}; } })();

if (id && all[id]) {
  writeHeartbeat(id, all[id].status || ""); // 開いている間は自動で稼働記録
  process.stdout.write(`🟢 ${all[id].name}｜${all[id].role}`);
} else {
  process.stdout.write("⚙️ ターミナル未設定（起動前に export TERMINAL_ID=alpha|beta|gamma）");
}
