import { correctDispatchKeyMisreads } from "../misread-dictionary";

export function extractDispatchKey(raw: string, defaultWaveNo?: string | null): string | null {
  const s = correctDispatchKeyMisreads(raw.trim()).toUpperCase();

  // W1-10-1 形式
  const full = s.match(/W([1-6])-(\d+)-(\d+)/);
  if (full) return `W${full[1]}-${full[2]}-${full[3]}`;

  // 10-1 形式
  const short = s.match(/^(\d{1,3})-(\d{1,2})$/);
  if (short) {
    const w = defaultWaveNo?.toUpperCase() ?? null;
    return w ? `${w}-${short[1]}-${short[2]}` : `${short[1]}-${short[2]}`;
  }

  return null;
}

export function parseDispatchKeyParts(key: string) {
  const m = key.match(/^(?:(W[1-6])-)?(\d+)-(\d+)$/i);
  if (!m) return null;
  return {
    waveNo: m[1] ? m[1].toUpperCase() : null,
    vehicleNo: m[2],
    deliverySeq: parseInt(m[3], 10),
  };
}
