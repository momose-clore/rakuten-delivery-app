/**
 * 自動救済パイプライン（自己完結版・DB非依存）
 * 低信頼行を人間修正前提にせず、自動補正を先に実行する。
 *
 * ※ 元アプリでは step6 で「修正履歴パターン(DB)」を参照して安全補正するが、
 *   本モジュールはDB非依存のため、任意で `correctionLookup` を注入して同等機能を使える。
 */
import type { NormalizedDispatchRow } from "../../types/import";
import { extractDispatchKey } from "../ocr/extractors/dispatch-key";
import { extractInvoiceNo } from "../ocr/extractors/invoice";
import { extractPhone } from "../ocr/extractors/phone";
import { extractAddress } from "../ocr/extractors/address";
import { extractCounts } from "../ocr/extractors/counts";
import { correctAddressMisreads } from "../ocr/misread-dictionary";
import {
  buildOcrFieldSources,
  buildOcrFieldStatuses,
  buildOcrPredictionWarnings,
  type OcrAutoRescueFlags,
} from "../prediction/metadata";

/** 予測値メタデータを保持した拡張行型 */
export interface RescuedRow extends NormalizedDispatchRow {
  fieldSourceJson: string;
  fieldStatusJson: string;
  predictionWarningsJson: string;
}

/**
 * 修正履歴パターンの解決関数（任意注入）。
 * fieldName/beforeValue を受け取り、確定済みの afterValue を返す（無ければ null）。
 * 元アプリの ocr_correction_patterns 相当をDB等から供給したい場合に使う。
 */
export type CorrectionLookup = (
  fieldName: string,
  beforeValue: string
) => Promise<string | null> | string | null;

export interface AutoRescueOptions {
  correctionLookup?: CorrectionLookup;
}

export async function autoRescueRows(
  rows: NormalizedDispatchRow[],
  options: AutoRescueOptions = {}
): Promise<RescuedRow[]> {
  const rescued: RescuedRow[] = [];

  for (const row of rows) {
    const notes = [...row.notes];
    let wasRescued = false;

    const flags: OcrAutoRescueFlags = {
      dispatchKeyCorrected: false,
      invoiceNoExtracted:   false,
      phoneMoved:           false,
      addressNormalized:    false,
      totalCountFilled:     false,
      historyApplied:       false,
    };

    // 1. 配車No再試行
    if (!row.dispatchKey) {
      const retried = extractDispatchKey([row.invoiceNo ?? "", row.memo ?? ""].join(" "), row.waveNo);
      if (retried) {
        (row as NormalizedDispatchRow).dispatchKey = retried;
        notes.push("AUTO_CORRECTED_BY_HISTORY");
        flags.dispatchKeyCorrected = true;
        wasRescued = true;
      }
    }

    // 1b. W番号救済（配車No W#-#-# から復元）
    if (!row.waveNo && row.dispatchKey) {
      const m = row.dispatchKey.match(/^W([1-6])-/);
      if (m) {
        (row as NormalizedDispatchRow).waveNo = `W${m[1]}`;
        wasRescued = true;
      }
    }

    // 2. 伝票No再試行（住所・メモから抽出）
    if (!row.invoiceNo) {
      const retried = extractInvoiceNo([row.address ?? "", row.memo ?? ""].join(" "));
      if (retried) {
        (row as NormalizedDispatchRow).invoiceNo = retried;
        flags.invoiceNoExtracted = true;
        wasRescued = true;
      }
    }

    // 3. 電話番号が住所に混入していた場合の救済
    if (!row.customerPhone && row.address) {
      const { value, valid } = extractPhone(row.address);
      if (valid && value) {
        (row as NormalizedDispatchRow).customerPhone = value;
        const cleaned = extractAddress(row.address.replace(value, "")).value;
        if (cleaned) (row as NormalizedDispatchRow).address = cleaned;
        flags.phoneMoved = true;
        wasRescued = true;
      }
    }

    // 4. 住所地名誤読補正
    if (row.address) {
      const { value: corrected, corrected: wasCorrected } = correctAddressMisreads(row.address);
      if (wasCorrected) {
        (row as NormalizedDispatchRow).address = corrected;
        flags.addressNormalized = true;
        wasRescued = true;
      }
    }

    // 5. 数量合計の自動補完
    if (row.totalCount === 0 && (row.normalOriconCount + row.coolerBoxCount + row.caseCount) > 0) {
      const { totalCount, totalAutoFilled } = extractCounts(
        String(row.normalOriconCount),
        String(row.coolerBoxCount),
        String(row.caseCount),
        ""
      );
      if (totalAutoFilled && totalCount !== null) {
        (row as NormalizedDispatchRow).totalCount = totalCount;
        notes.push("AUTO_CORRECTED_BY_HISTORY");
        flags.totalCountFilled = true;
        wasRescued = true;
      }
    }

    // 6. 修正履歴による安全補正（任意注入・DB非依存）
    if (row.dispatchKey && options.correctionLookup) {
      try {
        const after = await options.correctionLookup("dispatchKey", row.dispatchKey);
        if (after) {
          (row as NormalizedDispatchRow).dispatchKey = after;
          if (!notes.includes("AUTO_CORRECTED_BY_HISTORY")) notes.push("AUTO_CORRECTED_BY_HISTORY");
          flags.historyApplied = true;
          wasRescued = true;
        }
      } catch { /* ignore */ }
    }

    // 7. 最終バリデーション後に confidence 更新
    const finalNotes = notes.filter((n, i, a) => a.indexOf(n) === i);
    const criticalMissing = !row.dispatchKey || !row.address;
    const confidence = criticalMissing ? "low" : finalNotes.length === 0 ? "high" : "medium";
    const finalNotesFull = criticalMissing ? [...finalNotes, "NEEDS_REVIEW"] : finalNotes;

    // 8. 予測値メタデータを構築
    const fieldSources = buildOcrFieldSources(wasRescued, flags);
    const fieldStatuses = buildOcrFieldStatuses(confidence, wasRescued, finalNotesFull);
    const warnings = buildOcrPredictionWarnings(wasRescued, flags, confidence);

    rescued.push({
      ...row,
      notes: finalNotesFull,
      confidence,
      autoRescued: wasRescued,
      fieldSourceJson:        JSON.stringify(fieldSources),
      fieldStatusJson:        JSON.stringify(fieldStatuses),
      predictionWarningsJson: warnings.length > 0 ? JSON.stringify(warnings) : "[]",
    });
  }

  return rescued;
}
