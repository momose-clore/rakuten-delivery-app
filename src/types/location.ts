export type LocationOverrideStatus = "pending" | "approved" | "rejected";
export type LocationOverrideSource = "ADMIN" | "DRIVER" | "IMPORT" | "GEOCODE";

export type AddressConfidence = "high" | "medium" | "low" | "override";

export type AddressWarning =
  | "ADDRESS_TOO_SHORT"
  | "ADDRESS_NO_BLOCK_NUMBER"
  | "ADDRESS_BUILDING_ONLY"
  | "GEOCODE_FAILED"
  | "GEOCODE_LOW_CONFIDENCE"
  | "COORDINATE_MISSING"
  | "COORDINATE_OUT_OF_AREA"
  | "COORDINATE_OUTSIDE_JAPAN"
  | "MANUAL_OVERRIDE_AVAILABLE";

export interface NormalizedAddressParts {
  postalCode: string | null;
  prefecture: string | null;
  city: string | null;
  town: string | null;
  block: string | null;
  buildingName: string | null;
  normalizedAddress: string;
  lookupKey: string;
}

export interface AddressConfidenceResult {
  confidence: AddressConfidence;
  warnings: AddressWarning[];
  hasOverride: boolean;
}

export interface LocationInfo {
  deliveryItemId: string;
  address: string | null;
  normalizedAddress: string | null;
  lat: number | null;
  lng: number | null;
  confidence: AddressConfidence;
  warnings: AddressWarning[];
  override: OverrideInfo | null;
  navigationUrl: string;
  copyableAddress: string;
}

export interface OverrideInfo {
  id: string;
  status: LocationOverrideStatus;
  lat: number | null;
  lng: number | null;
  entranceMemo: string | null;
  buildingMemo: string | null;
  nameplateMemo: string | null;
  accessMemo: string | null;
  cautionMemo: string | null;
  parkingMemo: string | null;
  /** 履歴マッチの精度（高精度な完全一致=high / 部分一致=medium） */
  matchConfidence?: "high" | "medium" | "low" | null;
}
