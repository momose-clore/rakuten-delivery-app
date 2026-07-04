/**
 * L1M 明細ブロックパーサー
 * 1配送先 = 複数サブ行（伝票No/氏名/連絡先/住所）のブロック構造を復元する。
 */
import type { OcrWord } from "@/lib/ocr/ocrspace";
import type { NormalizedDispatchRow, L1MMetadata } from "@/types/import";
import { extractDispatchKey } from "@/lib/ocr/extractors/dispatch-key";
import { extractInvoiceNo } from "@/lib/ocr/extractors/invoice";
import { extractPhone } from "@/lib/ocr/extractors/phone";
import { extractAddress } from "@/lib/ocr/extractors/address";
import { extractCounts } from "@/lib/ocr/extractors/counts";
import { extractName } from "@/lib/ocr/extractors/name";
import { correctDigitMisreads, toHalfWidth } from "@/lib/ocr/misread-dictionary";

const DISPATCH_KEY_RE = /^\d{1,3}-\d{1,2}$/;

function numEnv(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 左カラムの同一行語から配車Noを復元する。
 * OCRが `11-1` を `11` + `1`（ハイフン欠落）や `l1-l` 等に分割・誤読しても、
 * 行内の数値トークン2つ（N=1〜3桁, M=1〜2桁）から `N-M` を組み立てて取りこぼしを防ぐ。
 * 実データ（CamScanner PDF）で分割・ハイフン欠落を確認したための復元処理。
 */
function reconstructDispatchKey(rowWords: OcrWord[]): string | null {
  // 1) 既に1単語で配車No形式（誤読補正込み）ならそれを採用
  for (const w of rowWords) {
    const s = w.text.trim();
    if (DISPATCH_KEY_RE.test(s)) return s;
    const c = correctDigitMisreads(toHalfWidth(s));
    if (DISPATCH_KEY_RE.test(c)) return c;
  }
  // 2) 分割ケース：左→右の数値トークン2つで N-M を復元
  const nums = rowWords
    .slice()
    .sort((a, b) => a.left - b.left)
    .map((w) => correctDigitMisreads(toHalfWidth(w.text)).replace(/[^\d]/g, ""))
    .filter((t) => t.length >= 1 && t.length <= 3);
  if (nums.length >= 2 && nums[0].length <= 3 && nums[1].length <= 2) {
    return `${nums[0]}-${nums[1]}`;
  }
  return null;
}

/**
 * 住所を正規順（都道府県→市区町村→町丁目→番地→建物）に組み直す。
 * OCRの語順で郵便番号・番地が先頭に来るなど並びが乱れるため、都道府県を起点に回転し、
 * 都道府県より前にあった非郵便番号部分（番地等）を末尾へ回す。郵便番号は本体から除去。
 */
function canonicalizeL1MAddress(raw: string): string {
  const s = (raw ?? "").replace(/[\s　]/g, "").replace(/〒/g, "");
  if (!s) return "";
  const zip = (s.match(/\d{3}-?\d{4}/) ?? [""])[0];
  const prefM = s.match(/(東京都|北海道|京都府|大阪府|[^\d\s]{2,3}県)/);
  if (!prefM) return zip ? s.replace(zip, "") : s;
  const pref = prefM[0];
  const idx = s.indexOf(pref);
  const afterPref = s.slice(idx);
  const before = s.slice(0, idx).replace(zip, "");
  return (afterPref + before).replace(zip, "");
}

/** 単語座標を画像回転（90/180/270°）に合わせて変換する。カメラの横向き/上下逆撮影対応。 */
function rotateWords(words: OcrWord[], W: number, H: number, deg: 90 | 180 | 270): OcrWord[] {
  return words.map((w) => {
    if (deg === 90) {
      // 時計回り90°：新画像は H×W。 (left,top)→(H-top-height, left)
      return { text: w.text, left: H - w.top - w.height, top: w.left, width: w.height, height: w.width };
    } else if (deg === 270) {
      // 反時計回り90°： (left,top)→(top, W-left-width)
      return { text: w.text, left: w.top, top: W - w.left - w.width, width: w.height, height: w.width };
    } else {
      // 180°： (left,top)→(W-left-width, H-top-height)
      return { text: w.text, left: W - w.left - w.width, top: H - w.top - w.height, width: w.width, height: w.height };
    }
  });
}

/**
 * OCR単語から L1M 明細ブロックを抽出。
 * カメラ写真は横向き/上下逆で撮られることがあり、座標ベース解析が破綻するため、
 * 0/90/180/270° の4方向を試し（再OCRなし・座標変換のみ）、配車Noブロックが最も多く
 * 復元できた向きを採用する。
 */
export function parseL1MRowBlocks(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number,
  meta: L1MMetadata
): NormalizedDispatchRow[] {
  const trials: Array<{ w: OcrWord[]; W: number; H: number }> = [
    { w: words, W: imageWidth, H: imageHeight },
    { w: rotateWords(words, imageWidth, imageHeight, 90), W: imageHeight, H: imageWidth },
    { w: rotateWords(words, imageWidth, imageHeight, 270), W: imageHeight, H: imageWidth },
    { w: rotateWords(words, imageWidth, imageHeight, 180), W: imageWidth, H: imageHeight },
  ];
  let best: NormalizedDispatchRow[] = [];
  for (const t of trials) {
    const rows = parseBlocksAtOrientation(t.w, t.W, t.H, meta);
    if (rows.length > best.length) best = rows;
    // 最初（無回転）で十分な件数が取れたら回転は試さない（通常のPDF/正立画像）
    if (t === trials[0] && rows.length >= 2) return rows;
  }
  return best;
}

function parseBlocksAtOrientation(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number,
  meta: L1MMetadata
): NormalizedDispatchRow[] {
  // y座標でソート
  const sorted = [...words].sort((a, b) => a.top - b.top);

  // 領域の境界（左: 配車No/特殊フラグ、中: お客様情報、右: 数量）
  // 配車No列は実測で左端10〜13%に分布するため 0.14 で列全体を含める（0.12だと2桁目が欠落し復元不能・実データで確認）。
  // 0.16以上にすると日付(2026/06/24)等を配車Noに誤検出するため上げすぎない。env で微調整可。
  const leftBoundary = imageWidth * numEnv("OCR_L1M_LEFT_BOUNDARY", 0.14);
  // 数量列は実測で 常温≈67% / クーラー≈78% / ケース≈88% / 箱計≈97%。お客様情報列との
  // 境界は常温列の手前(≈0.63)。0.76だと常温列を取りこぼすため 0.63 を既定にする。
  const quantityBoundary = imageWidth * numEnv("OCR_L1M_QTY_BOUNDARY", 0.63);
  // 各数量列の中心x（imageWidth比）。数値はこの最寄り列に割り当てる。
  const QTY_COL_CENTERS = [0.67, 0.78, 0.88, 0.97].map((f) => imageWidth * f);

  // 左カラム語を「行」にクラスタリング（top近接）し、配車Noを含む行をブロック開始として検出
  const leftIdx: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].left < leftBoundary) leftIdx.push(i);
  }
  const rowTol = Math.max(median(leftIdx.map((i) => sorted[i].height)) * 0.7, imageHeight * 0.012);
  const clusters: number[][] = [];
  let prevTop = -Infinity;
  for (const i of leftIdx) {
    if (sorted[i].top - prevTop > rowTol) clusters.push([]);
    clusters[clusters.length - 1].push(i);
    prevTop = sorted[i].top;
  }

  // 配車No は「{号車}-{連番}」。第1部が号車(vehicleNo)と一致するものだけ採用し、
  // 日付(例 06-21)やサマリー値の誤検出でできる偽ブロックを排除する。
  const expectedVehicle = meta.vehicleNo
    ? parseInt(correctDigitMisreads(toHalfWidth(meta.vehicleNo)).replace(/[^\d]/g, ""), 10)
    : NaN;

  // 配車Noクラスタ由来のアンカー（従来・正立/PDFで確実）
  const configTops: number[] = [];
  const configKeys: string[] = [];
  for (const cl of clusters) {
    const key = reconstructDispatchKey(cl.map((i) => sorted[i]));
    if (!key) continue;
    if (Number.isFinite(expectedVehicle)) {
      const head = parseInt(key.split("-")[0].replace(/[^\d]/g, ""), 10);
      if (head !== expectedVehicle) continue;
    }
    configTops.push(sorted[cl[0]].top);
    configKeys.push(key);
  }

  // 伝票No(20XX 長桁)由来のアンカー。配車Noは小さく分割されやすいがこちらは確実に読める。
  // L1Mの枠組みは固定で上から連番のため、配車Noは「号車＋順番」で補完できる。
  // 伝票Noアンカーが配車Noクラスタ以上に取れたら、そちら（＝正しい向き/歪みに強い）を採用。
  const invTopsRaw = sorted
    .filter((w) => /^20\d{9,14}$/.test(correctDigitMisreads(toHalfWidth(w.text)).replace(/[^\d]/g, "")))
    .map((w) => w.top)
    .sort((a, b) => a - b);
  const invTops: number[] = [];
  for (const t of invTopsRaw) {
    if (!invTops.length || t - invTops[invTops.length - 1] > rowTol * 2) invTops.push(t);
  }

  let keyTops: number[];
  let blockKeys: (string | null)[];
  if (invTops.length >= 2 && invTops.length > configTops.length) {
    keyTops = invTops;
    blockKeys = invTops.map((t, idx) => {
      // 同一行帯の左カラム語から配車Noを復元。ダメなら号車＋順番で補完。
      const rowWords = sorted.filter((w) => w.left < leftBoundary && Math.abs(w.top - t) <= rowTol * 1.8);
      let key = reconstructDispatchKey(rowWords);
      if (key && Number.isFinite(expectedVehicle) && parseInt(key.split("-")[0].replace(/[^\d]/g, ""), 10) !== expectedVehicle) key = null;
      if (!key && Number.isFinite(expectedVehicle)) key = `${expectedVehicle}-${idx + 1}`;
      return key;
    });
  } else {
    keyTops = configTops;
    blockKeys = configKeys;
  }

  if (keyTops.length === 0) return [];

  const rows: NormalizedDispatchRow[] = [];

  // 伝票No行は配車No行の少し上に来るため、全ブロック境界を上方向に upShift だけずらす。
  // これで各ブロック=[この配車No行−upShift, 次の配車No行−upShift) となり、伝票No行〜
  // 住所行までの1配送分のサブ行を過不足なく含む（index単純スライスの隣ブロック混入を回避）。
  const upShift = rowTol;
  for (let b = 0; b < keyTops.length; b++) {
    const lowerY = keyTops[b] - upShift;
    const upperY = b + 1 < keyTops.length ? keyTops[b + 1] - upShift : Infinity;
    const blockWords = sorted.filter((w) => w.top >= lowerY && w.top < upperY);

    // 配車No（行クラスタから復元済みの値を使用：分割・ハイフン欠落に対応）
    const dispatchKeyRaw = blockKeys[b] ?? "";
    const dispatchKey = extractDispatchKey(dispatchKeyRaw, meta.waveNo);

    // 中央列の単語（お客様情報エリア）
    const centerWords = blockWords.filter(
      (w) => w.left >= leftBoundary && w.left < quantityBoundary
    ).sort((a, b) => a.top - b.top);

    // 数量列の単語（左→右に整列＝常温/クーラー/ケース/総数 の並びを保証）
    const quantityWords = blockWords
      .filter((w) => w.left >= quantityBoundary)
      .sort((a, b) => a.left - b.left);

    // 伝票No・氏名・電話・住所をラベルベースで抽出
    const centerText = centerWords.map((w) => w.text).join(" ");
    // 伝票No：L1Mは「20XX始まり15桁」。中央語の数字を順に連結し 20XX+13桁 を直接狙う
    // （連結テキスト全体からだと 郵便番号/電話 と繋がって誤った数字列を拾うため）。
    const centerDigits = centerWords
      .map((w) => correctDigitMisreads(toHalfWidth(w.text)).replace(/[^\d]/g, ""))
      .join("");
    const invMatch = centerDigits.match(/20\d{13}/) ?? centerDigits.match(/\d{12,16}/);
    const invoiceNo = invMatch ? invMatch[0] : extractInvoiceNo(centerText);
    // 連絡先行を特定：電話は「090 - 1552 - 3598」のように語分割されるため、
    // 連絡先ラベルの y 帯にある中央語を丸ごと結合して電話番号を復元する。
    const renrakuLabel = centerWords.find(
      (w) => w.text.includes("連絡") || w.text.includes("絡") || w.text.includes("電話")
    );
    const renrakuTop = renrakuLabel ? renrakuLabel.top : -1;
    const phoneStr =
      renrakuTop >= 0
        ? centerWords
            .filter((w) => Math.abs(w.top - renrakuTop) <= rowTol && !/連絡|絡|電話|先/.test(w.text))
            .sort((a, b) => a.left - b.left)
            .map((w) => toHalfWidth(w.text))
            .join("")
        : "";
    let { value: phone, valid: phoneValid } = extractPhone(phoneStr);
    // 連絡先ラベルが読めない行のフォールバック：ブロック中央語からハイフン付き電話書式を探す
    // （0X-XXXX-XXXX / 0X0-XXXX-XXXX。ハイフン必須なので15桁伝票Noには誤マッチしない）。
    if (!phoneValid) {
      const joined = centerWords.map((w) => toHalfWidth(w.text)).join(" ").replace(/\s*-\s*/g, "-");
      const m = joined.match(/0\d{1,3}-\d{2,4}-\d{3,4}/);
      if (m) {
        const r = extractPhone(m[0]);
        phone = r.value;
        phoneValid = r.valid;
      }
    }

    // 氏名（「氏名」ラベル後の文字列）
    const nameMatch = centerText.match(/氏名[\s:：]*([\p{L}ぁ-んァ-ン一-龠\s]{2,20})/u);
    const customerName = nameMatch ? extractName(nameMatch[1]) : extractName(centerText);

    // 住所：L1Mのサブ行順（伝票No→氏名→連絡先→住所）を利用し、連絡先行の直下＝住所行と
    // みなして、その y 以下の中央語を (top,left) 順で結合する。文字列の非貪欲マッチや住所
    // ラベル依存だと語順の乱れ・ラベル読み落としで住所が欠落するため、y座標ベースで頑健に拾う。
    let addrTop = -1;
    if (renrakuTop >= 0) {
      addrTop = renrakuTop + rowTol * 0.6;
    } else {
      const addrLabel = centerWords.find((w) => w.text.includes("住所"));
      if (addrLabel) addrTop = addrLabel.top - 2;
    }
    let rawAddress: string;
    if (addrTop >= 0) {
      rawAddress = centerWords
        .filter((w) => w.top >= addrTop && !w.text.includes("住所"))
        .sort((a, b) => a.top - b.top || a.left - b.left)
        .map((w) => w.text)
        .join("");
    } else {
      rawAddress = centerText;
    }
    let { value: address, suspect: addressSuspect } = extractAddress(canonicalizeL1MAddress(rawAddress));
    // フォールバック：住所が空/地名なしなら、ブロック中央語から郵便番号or都道府県以降を住所として拾う
    // （連絡先・住所ラベルが両方読めない行の救済。元データに住所が無ければ空のまま＝要確認で正しく残る）。
    if (!address || !/[都道府県区市町村]/.test(address)) {
      const joined = centerWords
        .slice()
        .sort((a, b) => a.top - b.top || a.left - b.left)
        .map((w) => w.text)
        .join("");
      const m = joined.match(/(〒?\s*\d{3}-?\d{4}[\s\S]*|[都道府県][\s\S]*)$/);
      if (m) {
        const r = extractAddress(canonicalizeL1MAddress(m[1]));
        if (r.value && r.value.length > (address?.length ?? 0)) {
          address = r.value;
          addressSuspect = r.suspect;
        }
      }
    }

    // 数量：各数値を実測の列中心（常温/クーラー/ケース/箱計）の最寄りに割り当てる。
    // 単純な左→右順だと空セル(0/空欄)で列がズレるため、x座標で列を決める。
    const cols: string[] = ["", "", "", ""];
    for (const w of quantityWords) {
      const num = correctDigitMisreads(toHalfWidth(w.text)).replace(/[^\d]/g, "");
      if (!num) continue;
      const cx = w.left + w.width / 2;
      let ci = 0;
      let best = Infinity;
      for (let c = 0; c < QTY_COL_CENTERS.length; c++) {
        const d = Math.abs(cx - QTY_COL_CENTERS[c]);
        if (d < best) { best = d; ci = c; }
      }
      if (cols[ci] === "") cols[ci] = num;
    }
    const { normalOricon, coolerBox, caseCount, totalCount } = extractCounts(
      cols[0], cols[1], cols[2], cols[3]
    );

    // メモ（数量エリア下の文章）
    const memoWords = quantityWords.filter((w) => {
      const txt = w.text;
      return txt.length > 5 && !/^\d+$/.test(txt);
    });
    const memo = memoWords.map((w) => w.text).join("") || null;

    const notes: string[] = [];
    if (!dispatchKey) notes.push("DISPATCH_KEY_MISSING");
    if (!invoiceNo) notes.push("INVOICE_MISSING");
    if (!address) notes.push("ADDRESS_EMPTY");
    else if (addressSuspect) notes.push("ADDRESS_SUSPECT");
    if (!phoneValid && phone) notes.push("PHONE_INVALID");
    const n = normalOricon ?? 0, c = coolerBox ?? 0, k = caseCount ?? 0, t = totalCount ?? 0;
    if (t > 0 && n + c + k !== t) notes.push("COUNT_MISMATCH");

    rows.push({
      source: "camera_ocr",
      rowNo: b + 1,
      waveNo: meta.waveNo,
      deliveryDate: meta.deliveryDate,
      area: meta.depotName,
      dispatchKey,
      invoiceNo,
      customerName,
      customerPhone: phoneValid ? phone : null,
      address,
      specialFlag: null,
      normalOriconCount: normalOricon ?? 0,
      coolerBoxCount: coolerBox ?? 0,
      caseCount: caseCount ?? 0,
      totalCount: totalCount ?? 0,
      memo,
      confidence: notes.length === 0 ? "high" : notes.length <= 2 ? "medium" : "low",
      notes,
      layoutProfile: "l1m_cargo_list",
    });
  }

  return rows;
}
