#!/usr/bin/env node
/**
 * ターミナル稼働ボード。🟢稼働中(10分以内) / 🟡アイドル(60分以内) / ⚪停止?・未報告 を名前付き表示。
 *   node scripts/terminals.mjs           1回表示
 *   node scripts/terminals.mjs --watch   5秒ごと更新
 */
import { readAll, mark } from "./_heartbeat-lib.mjs";

function render() {
  const all = readAll();
  const lines = ["", "═══ ターミナル稼働状況 ═══"];
  for (const t of Object.values(all)) {
    const m = mark(t.lastSeenAt);
    lines.push(`${m.e} ${t.name}  —  ${t.role}`);
    lines.push(`     ${m.t}${t.status ? `  | ${t.status}` : ""}`);
  }
  lines.push(`（更新: ${new Date().toLocaleTimeString("ja-JP")}）`, "");
  return lines.join("\n");
}

if (process.argv.includes("--watch")) {
  const tick = () => process.stdout.write("\x1b[2J\x1b[H" + render());
  tick();
  setInterval(tick, 5000);
} else {
  console.log(render());
}
