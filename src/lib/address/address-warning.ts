/**
 * 住所警告定数・ラベル（src/types/location.ts の AddressWarning を再エクスポート）
 */
export type { AddressWarning } from "@/types/location";

export const ADDRESS_WARNING_LABELS: Record<string, string> = {
  ADDRESS_TOO_SHORT:           "住所が短すぎます",
  ADDRESS_NO_BLOCK_NUMBER:     "番地がありません",
  ADDRESS_BUILDING_ONLY:       "建物名のみです",
  GEOCODE_FAILED:              "Geocode失敗",
  GEOCODE_LOW_CONFIDENCE:      "Geocode信頼度低",
  COORDINATE_MISSING:          "座標なし",
  COORDINATE_OUT_OF_AREA:      "想定エリア外",
  COORDINATE_OUTSIDE_JAPAN:    "日本国外座標",
  MANUAL_OVERRIDE_AVAILABLE:   "修正ピンあり",
};
