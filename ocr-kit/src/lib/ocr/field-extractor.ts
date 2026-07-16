import type { MappedRow } from "./layout-mapper";
import type { ParsedDeliveryItem } from "./types";
import { extractDispatchKey, parseDispatchKeyParts } from "./extractors/dispatch-key";
import { extractInvoiceNo, extractInvoiceFromText } from "./extractors/invoice";
import { extractPhone, extractPhoneFromText } from "./extractors/phone";
import { extractAddress } from "./extractors/address";
import { extractCounts } from "./extractors/counts";
import { extractName } from "./extractors/name";
import type { ReviewReason } from "./types";

export function extractItemFromRow(
  row: MappedRow,
  defaultWaveNo?: string | null
): ParsedDeliveryItem {
  const get = (field: keyof MappedRow["cells"]) =>
    (row.cells[field] ?? []).join(" ").trim();

  // 配車No
  const dispatchKey = extractDispatchKey(get("dispatchKey"), defaultWaveNo);

  // 伝票No（住所・氏名欄からも抽出）
  const invoiceNo = extractInvoiceNo(get("invoiceNo"))
    ?? extractInvoiceFromText(get("address"))
    ?? extractInvoiceFromText(get("customerName"));

  // 電話番号
  const { value: customerPhone, valid: phoneValid } = extractPhone(
    get("customerPhone") || extractPhoneFromText(get("address"))
  );

  // 住所
  const { value: address, suspect: addressSuspect, autoCorrected: addressAutoCorrected } =
    extractAddress(get("address"));

  // 氏名
  const customerName = extractName(get("customerName"));

  // 数量（専用抽出器）
  const { normalOricon, coolerBox, caseCount, totalCount, totalAutoFilled } = extractCounts(
    get("normalOricon"),
    get("coolerBox"),
    get("caseCount"),
    get("totalCount")
  );

  const specialFlag = get("specialFlag") || null;
  const memo = get("memo") || null;

  const keyParts = dispatchKey ? parseDispatchKeyParts(dispatchKey) : null;

  // 初期 reviewReasons
  const reasons: ReviewReason[] = [];
  if (addressSuspect && address) reasons.push("ADDRESS_SUSPECT");
  if (addressAutoCorrected) reasons.push("AUTO_CORRECTED_BY_HISTORY");
  if (totalAutoFilled) reasons.push("AUTO_CORRECTED_BY_HISTORY");

  return {
    dispatchKey,
    waveNo: keyParts?.waveNo ?? defaultWaveNo ?? null,
    vehicleNo: keyParts?.vehicleNo ?? null,
    deliverySeq: keyParts?.deliverySeq ?? null,
    invoiceNo,
    customerName,
    customerPhone: phoneValid ? customerPhone : null,
    address,
    specialFlag,
    normalOriconCount: normalOricon,
    coolerBoxCount: coolerBox,
    caseCount,
    totalCount,
    memo,
    reviewReasons: reasons,
  };
}
