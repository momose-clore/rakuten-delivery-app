import { createHash } from "crypto";

/** 画像バッファの SHA256 ハッシュを返す（重複OCR防止用） */
export function computeImageHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
