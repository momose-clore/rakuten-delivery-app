interface DispatchKeyParts {
  dispatchKey: string;
  waveNo: string | null;
  vehicleNo: string;
  deliverySeq: number;
}

/**
 * 配車No を分解する。
 *
 * 対応形式:
 *   "W1-11-1"  → waveNo: W1, vehicleNo: 11, deliverySeq: 1
 *   "11-1"     → waveNo: null（後でヘッダーから補完）, vehicleNo: 11, deliverySeq: 1
 *   "10-1"     → waveNo: null, vehicleNo: 10, deliverySeq: 1
 */
export function parseDispatchKey(raw: string, defaultWaveNo?: string | null): DispatchKeyParts | null {
  const s = raw.trim();

  // W1-11-1 形式
  const fullMatch = s.match(/^(W[1-6])-(\d+)-(\d+)$/i);
  if (fullMatch) {
    return {
      dispatchKey: fullMatch[0].toUpperCase(),
      waveNo: fullMatch[1].toUpperCase(),
      vehicleNo: fullMatch[2],
      deliverySeq: parseInt(fullMatch[3], 10),
    };
  }

  // 11-1 形式（号車番号-明細番号のみ）
  const shortMatch = s.match(/^(\d{1,3})-(\d{1,2})$/);
  if (shortMatch) {
    const waveNo = defaultWaveNo ?? null;
    const key = waveNo
      ? `${waveNo}-${shortMatch[1]}-${shortMatch[2]}`
      : `${shortMatch[1]}-${shortMatch[2]}`;
    return {
      dispatchKey: key,
      waveNo,
      vehicleNo: shortMatch[1],
      deliverySeq: parseInt(shortMatch[2], 10),
    };
  }

  return null;
}

/** テキスト行中から配車No候補を探す（W1-11-1 または 11-1 形式） */
export function findDispatchKey(line: string): string | null {
  // W1-11-1 形式を優先
  const fullMatch = line.match(/\bW[1-6]-\d+-\d+\b/i);
  if (fullMatch) return fullMatch[0];

  // 号車番号-明細番号 形式（1〜3桁-1〜2桁）
  const shortMatch = line.match(/\b(\d{1,3})-([1-9]\d?)\b/);
  if (shortMatch) return shortMatch[0];

  return null;
}
