// 増便申請理由のテンプレート生成（Wave別・エリア注入・積載波及ロジック・複数パターン）
//
// 運用前提（ユーザー説明）:
//   W1&W2 を同時積載 → W3&W4 を同時積載 → W5&W6 を同時積載 で配送。
//   前段の便が遅れると後続（特にW5・W6）の配送時刻がずれ込む。
//   → Wave ごとに、その便の条件に合った理由を複数パターン出せるようにする（毎回同一文だと弾かれるため）。
//
// エリアは配達伝票（delivery_items）の住所から市区町村だけを抜いたもの（例: 足立区・北区）。

export function areasToString(areas: string[]): string {
  const uniq = [...new Set(areas.filter(Boolean))];
  return uniq.length ? uniq.join("・") : "（担当エリア）";
}

/** Wave N が属する同時積載ペア（[開始便, 終了便]） */
export function loadingPair(waveNo: number): [number, number] {
  const start = waveNo <= 2 ? 1 : waveNo <= 4 ? 3 : 5;
  return [start, start + 1];
}

export interface ReasonTemplate {
  label: string;
  text: string;
}

/** Wave別の申請理由テンプレート（複数パターン）。areas は市区町村の配列。 */
export function waveReasonVariants(waveNo: number, areas: string[]): ReasonTemplate[] {
  const area = areasToString(areas);
  const [p0, p1] = loadingPair(waveNo);
  const pairStart = p0;
  const cascade = pairStart > 1 ? `前段（W1〜W${pairStart - 1}）の遅延が後続に波及し、` : "";
  const nextLabel = waveNo < 6 ? `W${waveNo + 1}以降` : "最終便";

  const t1 =
    `${area}をW${p0}・W${p1}の同時積載で配送しております。` +
    `現在の運行では、荷物の積み下ろしに30分、1往復あたり移動時間約100分、配送時間約40分を要しております。` +
    `このため、${cascade}W${waveNo}（${waveNo}便目）の配送が遅配となる見込みであり、` +
    `安定したサービス品質を維持することが困難な状況です。つきましてはW${waveNo}の増便を申請いたします。`;

  const t2 =
    `${area}のW${waveNo}（${waveNo}便）について、配送件数・荷物量が想定を上回っており、` +
    `現行の号車数では時間内の配送完了が困難な状況です。` +
    `遅配・持ち戻りを防ぎ、安定したサービス品質を維持するため、W${waveNo}の増便を申請いたします。`;

  const t3 =
    `W${p0}・W${p1}を同時積載する運用上、W${waveNo}を増便しない場合、後続便（${nextLabel}）の配送時刻がずれ込む見込みです。` +
    `${area}での遅配を未然に防ぐため、W${waveNo}の増便を申請いたします。`;

  return [
    { label: "遅配波及型", text: t1 },
    { label: "物量超過型", text: t2 },
    { label: "積載順序型", text: t3 },
  ];
}
