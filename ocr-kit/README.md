# ocr-kit

配送表の **OCR / 取込エンジン** を、DB(Prisma)・Next.js・NextAuth に依存せず切り出した自己完結モジュールです。
「ファイル（PDF / 画像 / CSV / Excel / 貼付テキスト）→ 構造化行（`NormalizedDispatchRow[]`）」を提供します。

楽天スーパー配送アプリの `src/lib/ocr` / `src/lib/import` から、純粋ロジックのみを抽出しています。

## エンジン方針

- OCR は **OCR.space のみ**（Gemini / Cloud Vision / Tesseract は含めない）
- **OCR.space 1画像1回**の原則
- 本番相当では **環境変数 `OCR_SPACE_API_KEY` が必須**（未設定時はデモキー `helloworld` に fallback＝開発時のみ・1MB/1日500回制限）
- CSV / Excel はテキスト解析、PDF はテキスト抽出 →（スキャンPDFなら）OCR.space の PDF エンジンへ自動フォールバック
- 低信頼行は **自動救済（`autoRescueRows`）** で先に補正（配車No・伝票No・電話混入・住所誤読・数量合計など）
- L1M配車表は専用プロファイル（`applyL1MProfile`）に対応

## インストール / ビルド

```bash
cd ocr-kit
npm install          # sharp / xlsx / pdf-parse 等
npm run build        # dist/ に .js + .d.ts を出力
# もしくは型チェックのみ:
npm run typecheck
```

> このモジュールは **TypeScript ソース配布**です。Next.js/バンドラを使うプロジェクトなら `src/index.ts` を直接 import しても、`npm run build` した `dist/` を使っても構いません。
> 内部は相対 import のみ（`@/` エイリアス不使用）なので、任意のプロジェクトにフォルダごとコピーして使えます。

## 使い方

### 1. まとめて取り込む（種別自動判定）

```ts
import { configure, parseDispatchFile } from "ocr-kit";

configure({ apiKey: process.env.OCR_SPACE_API_KEY }); // 環境変数を使うなら省略可

const { rows, source, ocr } = await parseDispatchFile({
  buffer,               // Buffer（ファイル内容）
  filename: "haisha.pdf", // 拡張子で種別判定（mimeType があればそちら優先）
  defaultWaveNo: "W3",  // ヘッダで便が取れない場合の既定（任意）
});

console.log(source);    // "csv" | "excel" | "pdf_text" | "pdf_ocr" | "image_ocr" ...
console.log(rows);      // NormalizedDispatchRow[]
```

### 2. 自動救済つきで取り込む

```ts
import { parseDispatchFileWithRescue } from "ocr-kit";

const { rows, rescuedRows } = await parseDispatchFileWithRescue({ buffer, filename });
// rescuedRows: RescuedRow[]（autoRescued フラグ・予測値メタJSON付き）
```

### 3. 個別API（低レベル）

```ts
import {
  recognizeDispatchImage,  // 画像/PDF Buffer → { rows, header, overallConfidence, qualityScore, rawText }
  runOcrSpace,             // OCR.space 生呼び出し（座標付き）
  parseCsvText,            // CSV文字列 → rows
  parseExcelBuffer,        // Excel Buffer → rows
  parsePasteText,          // 貼付テキスト → rows
  parsePdfBuffer,          // PDF Buffer → { rows, source }
  applyL1MProfile,         // L1M配車表 OCR結果 → ImportBatchResult | null
  autoRescueRows,          // rows → RescuedRow[]（低信頼値の自動補正）
} from "ocr-kit";
```

## 修正履歴による安全補正（任意）

元アプリでは「よく直す誤読パターン」をDBに蓄積し `autoRescueRows` の中で参照していました。
本モジュールはDB非依存のため、必要なら解決関数を注入できます。

```ts
await autoRescueRows(rows, {
  correctionLookup: async (fieldName, beforeValue) => {
    // 例: 自前DBから「fieldName=dispatchKey かつ before=beforeValue」の確定 after値を返す
    return await myDb.findCorrection(fieldName, beforeValue); // 無ければ null
  },
});
```

## 主な型

- `NormalizedDispatchRow` — 正規化済みの1行（配車No/伝票No/氏名/電話/住所/数量/confidence/notes …）
- `RescuedRow` — 上記＋予測値メタJSON（`fieldSourceJson` / `fieldStatusJson` / `predictionWarningsJson`）
- `RecognizeResult` — 画像OCRの結果（`rows` / `header` / `overallConfidence` / `qualityScore` / `rawText`）
- `ImportBatchResult` / `L1MMetadata` — L1Mプロファイル用

## 含まれるもの / 含まれないもの

含む: OCR.space呼び出し・画像前処理(sharp)・画像品質評価・表領域/グリッド検出・セルマッピング・
各項目抽出器（配車No/伝票No/電話/住所/氏名/数量）・誤読辞書・信頼度評価・CSV/Excel/PDF/貼付パーサ・
L1Mプロファイル・自動救済。

含まない（元アプリのDB/認証依存のため）: DB保存(`saveImportBatch`)・使用量ログ・監査ログ・
学習型修正パターンの永続化・ストレージ読取・レビューUI・再OCRの状態管理。
（これらは本モジュールの出力を受け取って、利用側で実装してください）
