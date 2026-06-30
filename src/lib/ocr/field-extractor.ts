import type { MappedRow } from "./layout-mapper";
import type { ParsedDeliveryItem } from "./types";
import {
  normalizeDispatchKey,
  normalizeInvoiceNo,
  normalizePhone,
  normalizeAddress,
  normalizeCount,
  normalizeName,
} from "./normalizer";

export function extractItemFromRow(
  row: MappedRow,
  defaultWaveNo?: string | null
): ParsedDeliveryItem {
  const get = (field: keyof MappedRow["cells"]) =>
    (row.cells[field] ?? []).join(" ").trim();

  const dispatchKeyRaw = get("dispatchKey");
  const dispatchKey = normalizeDispatchKey(dispatchKeyRaw, defaultWaveNo);

  // 伝票No（住所欄・氏名欄に混入している場合も抽出）
  const invoiceRaw = get("invoiceNo")
    || extractInvoiceFromMixedText(get("address"))
    || extractInvoiceFromMixedText(get("customerName"));
  const invoiceNo = normalizeInvoiceNo(invoiceRaw);

  // 電話番号（住所欄からも抽出試み）
  const phoneRaw = get("customerPhone") || extractPhoneFromText(get("address"));
  const { value: customerPhone, valid: phoneValid } = normalizePhone(phoneRaw);

  // 住所（強化版: ADDRESS_SUSPECT 判定付き）
  const addressRaw = get("address");
  const { value: address, suspect: addressSuspect } = normalizeAddress(addressRaw);

  // 氏名
  const nameRaw = get("customerName");
  const customerName = normalizeName(nameRaw);

  // 数量（数量列にある数字のみ）
  const normalOriconCount = normalizeCount(get("normalOricon"), true);
  const coolerBoxCount    = normalizeCount(get("coolerBox"), true);
  const caseCount         = normalizeCount(get("caseCount"), true);
  const totalCount        = normalizeCount(get("totalCount"), true);

  const specialFlag = get("specialFlag") || null;
  const memo        = get("memo") || null;

  const keyParts = dispatchKey ? parseDispatchKeyParts(dispatchKey) : null;

  // ADDRESS_SUSPECT を reviewReasons の初期値として渡す
  const initialReasons = addressSuspect && address ? ["ADDRESS_SUSPECT" as const] : [];

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
    normalOriconCount,
    coolerBoxCount,
    caseCount,
    totalCount,
    memo,
    reviewReasons: initialReasons,
  };
}

function parseDispatchKeyParts(key: string) {
  const m = key.match(/^(?:(W[1-6])-)?(\d+)-(\d+)$/i);
  if (!m) return null;
  return {
    waveNo: m[1] ? m[1].toUpperCase() : null,
    vehicleNo: m[2],
    deliverySeq: parseInt(m[3], 10),
  };
}

function extractInvoiceFromMixedText(text: string): string {
  const m = text.replace(/[\s\-]/g, "").match(/\d{10,14}/);
  return m ? m[0] : "";
}

function extractPhoneFromText(text: string): string {
  const m = text.match(/0\d[\d\s\-]{8,11}/);
  return m ? m[0] : "";
}
