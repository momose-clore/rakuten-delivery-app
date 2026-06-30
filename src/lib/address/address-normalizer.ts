/**
 * 住所正規化ライブラリ
 * GODOOR / ゼンリン不使用。テキストベースの正規化のみ。
 */
import type { NormalizedAddressParts } from "@/types/location";

const POSTAL_RE = /〒?\s*(\d{3}[-ー]\d{4})/;
const PREFECTURE_RE = /(東京都|大阪府|京都府|北海道|[^\s]{2,3}[都道府県])/;
const CITY_RE = /([^\s]{2,6}[市区町村])/;
const BLOCK_RE = /(\d+)[丁目番地号ー\-]?(\d*)/g;
const BUILDING_RE = /([^\s\d]{2,}(?:マンション|ビル|ハイツ|アパート|荘|苑|コーポ|プラザ|タワー|レジデンス|スカイ|グリーン|パーク|ヒルズ))/;

/** 全角英数字を半角に変換 */
function toHalfWidth(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[ー－]/g, "-")
    .replace(/[　]/g, " ");
}

/** 住所を正規化してパーツに分解 */
export function normalizeAddress(raw: string): NormalizedAddressParts {
  const s = toHalfWidth(raw.trim());

  const postalMatch = s.match(POSTAL_RE);
  const postalCode = postalMatch ? postalMatch[1].replace(/[ー\-]/, "-") : null;

  const prefMatch = s.match(PREFECTURE_RE);
  const prefecture = prefMatch ? prefMatch[1] : null;

  const cityMatch = s.match(CITY_RE);
  const city = cityMatch ? cityMatch[1] : null;

  const buildingMatch = s.match(BUILDING_RE);
  const buildingName = buildingMatch ? buildingMatch[1] : null;

  // 丁目番地ブロックを抽出
  let block: string | null = null;
  const blockMatches = [...s.matchAll(BLOCK_RE)];
  if (blockMatches.length > 0) {
    block = blockMatches.map((m) => m[0]).join("-");
  }

  // 町名（都道府県・市区町村の後の部分）
  let town: string | null = null;
  if (city) {
    const afterCity = s.slice(s.indexOf(city) + city.length);
    const townMatch = afterCity.match(/^([^\d\s]{1,10})/);
    town = townMatch ? townMatch[1] : null;
  }

  // 正規化済み住所を生成
  const parts = [prefecture, city, town, block].filter(Boolean).join("");
  const normalizedAddress = parts || s;

  // 同一住所判定用キー（郵便番号 + 市区町村 + 番地）
  const lookupKey = [postalCode, city, block].filter(Boolean).join("_").toLowerCase();

  return { postalCode, prefecture, city, town, block, buildingName, normalizedAddress, lookupKey };
}

/** 住所の同一性を判定するルックアップキーを返す */
export function buildLookupKey(address: string): string {
  const parts = normalizeAddress(address);
  return parts.lookupKey || parts.normalizedAddress.toLowerCase();
}
