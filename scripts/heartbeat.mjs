#!/usr/bin/env node
/**
 * 手動ハートビート（自分の稼働を記録）。
 *   node scripts/heartbeat.mjs gamma
 *   node scripts/heartbeat.mjs gamma "CARIO同期チェック中"
 * ※ ステータスライン設定済みなら自動で記録されるため通常は不要。
 */
import { writeHeartbeat, readAll } from "./_heartbeat-lib.mjs";

const id = process.argv[2];
const status = process.argv.slice(3).join(" ");
if (!id || !readAll()[id]) {
  console.error("使い方: node scripts/heartbeat.mjs <alpha|beta|gamma> [status]");
  process.exit(1);
}
writeHeartbeat(id, status);
console.log(`💓 ${readAll()[id].name} 稼働記録${status ? ` (${status})` : ""}`);
