interface DispatchKeyParts {
  dispatchKey: string;
  waveNo: string;
  vehicleNo: string;
  deliverySeq: number;
}

/** "W1-11-1" → { dispatchKey, waveNo, vehicleNo, deliverySeq } */
export function parseDispatchKey(raw: string): DispatchKeyParts | null {
  // W1〜W6、号車番号、明細番号にマッチ
  const match = raw.trim().match(/^(W[1-6])-(\d+)-(\d+)$/i);
  if (!match) return null;

  return {
    dispatchKey: match[0].toUpperCase(),
    waveNo: match[1].toUpperCase(),
    vehicleNo: match[2],
    deliverySeq: parseInt(match[3], 10),
  };
}

/** テキスト行中から配車No候補を探す */
export function findDispatchKey(line: string): string | null {
  const match = line.match(/W[1-6]-\d+-\d+/i);
  return match ? match[0] : null;
}
