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

/**
 * レイアウトマッピング済みの行から配送明細を抽出
 */
export function extractItemFromRow(
  row: MappedRow,
  defaultWaveNo?: string | null
): ParsedDeliveryItem {
  const get = (field: keyof MappedRow["cells"]) =>
    (row.cells[field] ?? []).join(" ").trim();

  // 配車No
  const dispatchKeyRaw = get("dispatchKey");
  const dispatchKey = normalizeDispatchKey(dispatchKeyRaw, defaultWaveNo);

  // 伝票No（配車No列・住所列に混入している可能性も考慮）
  const invoiceRaw = get("invoiceNo")
    || extractInvoiceFromMixedText(get("address"))
    || extractInvoiceFromMixedText(get("customerName"));
  const invoiceNo = normalizeInvoiceNo(invoiceRaw);

  // 電話番号（住所欄からも抽出試み）
  const phoneRaw = get("customerPhone") || extractPhoneFromText(get("address"));
  const { value: customerPhone, valid: phoneValid } = normalizePhone(phoneRaw);

  // 住所（電話番号・伝票Noを除去）
  const addressRaw = get("address");
  const address = normalizeAddress(addressRaw);

  // 氏名（住所が混入していないかチェック）
  const nameRaw = get("customerName");
  const customerName = normalizeName(nameRaw);

  // 数量
  const normalOriconCount = normalizeCount(get("normalOricon"));
  const coolerBoxCount = normalizeCount(get("coolerBox"));
  const caseCount = normalizeCount(get("caseCount"));
  const totalCount = normalizeCount(get("totalCount"));

  // 特記・メモ
  const specialFlag = get("specialFlag") || null;
  const memo = get("memo") || null;

  // 配車No分解
  const keyParts = dispatchKey ? parseDispatchKeyParts(dispatchKey) : null;

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
    reviewReasons: [], // confidence.ts で付与
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
