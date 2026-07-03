# セキュリティ監査レポート（楽天スーパー配送アプリ）

- 初版: 2026-07-03
- 担当: セキュリティ監視・レポート・修復（Claude Code / ターミナル α）
- 対象: 全コードベース（API routes 50+ / CARIO・LINE・external 連携 / OCR / ファイルアップロード / 認証 / 設定 / 依存関係）
- 監査手法: 認証認可・外部連携/シークレット・インジェクション/アップロード/PII・設定/依存 の4領域を並行監査 → 実コードで裏付け

---

## エグゼクティブサマリ

全体として防御は良好（生SQLなし・`eval`/`child_process`なし・`dangerouslySetInnerHTML`なし・PIIログ/audit_logの規律あり・タイミングセーフ比較・多くのルートで認証ロール制御あり）。ただし **遠隔悪用可能な認証バイパス1件（Critical）** と、fail-open な署名検証・SSRF・ヘッダ欠如・レート制限なし・脆弱依存 などの High が複数存在した。

| 重大度 | 件数 | 状態 |
|--------|------|------|
| Critical | 1 | ✅ 修復済 |
| High | 5 | ✅ 4件修復 / ⏳ 1件（xlsx）要判断 |
| Medium | 4 | ⏳ 順次対応 |
| Low | 3 | ✅ 1件修復 / ⏳ 2件 |

---

## Critical

### C1. test-driver エンドポイントの未認証トークンバイパス ✅修復済
- 場所: `src/app/api/admin/setup/test-driver/route.ts`
- 内容: `?token=clore-setup-2026`（**ソースにハードコードされたトークン**）を付ければ、**未ログインで**以下が可能だった:
  - 既知パスワード `driver1234` のドライバーアカウント作成（認証済みの足がかり）
  - `?action=cleanup` で assignment / deliveryItem / dispatchImage / follow / dayReport を**未認証削除**
- 修復: トークンバイパスを完全撤去し、常に ADMIN セッション必須化。
- 残タスク: 本番でこの一時ツール自体が不要なら**ルートごと削除**を推奨（要判断）。固定パスワード返却も廃止候補。

---

## High

### H1. LINE Webhook が署名検証を fail-open していた ✅修復済
- 場所: `src/app/api/line/webhook/route.ts`
- 内容: `LINE_CHANNEL_SECRET` 未設定時 `verifySignature` が `true` を返し、**偽造イベントを受理**（外向き LINE API 呼び出し誘発・source ID を未認証応答に反映）。
- 修復: 本番（`NODE_ENV==="production"`）では未設定なら拒否（fail-closed）。開発時のみスキップ可。

### H2. カメラOCR `process` の SSRF ✅修復済
- 場所: `src/app/api/admin/dispatch-import/camera/process/route.ts`
- 内容: リクエストボディの `imageUrl` を検証せず `storageProvider.read()`（= 任意 `fetch`）していたため、認証済みユーザが内部エンドポイント（例 `169.254.169.254`）等をサーバに fetch させられた。
- 修復: `imageUrl` を Vercel Blob ホスト（`*.blob.vercel-storage.com`）＋ローカル `/uploads/` のみ許可する allowlist を追加。

### H3. セキュリティヘッダーが全く無い ✅修復済
- 場所: `next.config.ts`
- 内容: CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy いずれも未設定（クリックジャッキング・MIMEスニッフィング・平文降格の余地）。
- 修復: `next.config.ts` に `headers()` を追加し全パスに付与。CSP は外部埋め込み（Google Maps 等）に合わせ調整余地あり。

### H4. レート制限が全く無い ⏳未対応
- 場所: アプリ全体（特に `src/lib/auth/auth.ts` のログイン、OCR/アップロード、`routes/geocode`、`external/*`）
- 内容: ログイン総当たり・クレデンシャルスタッフィング・OCR/Geocoding のコスト濫用（課金DoS）に対して無防備。
- 推奨: Vercel WAF/Firewall のレート制御（ログイン・external）＋アプリ層 `@upstash/ratelimit`（IPキー）を OCR/upload/geocode に。

### H5. `xlsx@0.18.5`（SheetJS）に既知CVE、npm修正なし ⏳要判断
- 場所: `package.json`（`src/lib/import/csv/excel-parser.ts` → `admin/dispatch-import/file`）
- 内容: Prototype Pollution（CVE-2023-30533, 修正 >=0.19.3）/ ReDoS（CVE-2024-22363, 修正 >=0.20.2）。ユーザアップロードの Excel が直接 `XLSX.read` に流れる。npm には修正版が無い（`fixAvailable:false`）。
- 推奨: 公式CDN版へ差し替え `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`、または `exceljs` へ移行。あわせて file/pdf/camera-upload にサイズ上限を追加（`dispatch-images/upload` は10MB制限あり）。

---

## Medium

### M1. アップストリームの `err.message` をクライアントに返却 ⏳未対応
- 場所: `cario/sites/route.ts:21`, `shifts/import/route.ts:39`, `cron/cario-sync/route.ts:46`, `shifts/realtime/route.ts:44`
- 内容: CARIO API のエラー文字列など連携内部情報が漏れる可能性（スタックトレースは返していない）。
- 推奨: クライアントには汎用メッセージ、詳細はサーバログのみ。

### M2. Postgres の SSL がコード上で強制されていない ⏳未対応
- 場所: `src/lib/prisma.ts` / `.env.example`
- 内容: `PrismaPg` に明示 `ssl` 指定がなく、`DATABASE_URL` に `sslmode=require` が無いと平文接続の恐れ。`.env.example` にも sslmode 記載なし。
- 推奨: 本番 `DATABASE_URL` に `sslmode=require`（可能なら `verify-full`）を必須化・ドキュメント化。

### M3. next-auth を beta 固定で本番運用 ⏳未対応
- 場所: `package.json`（`next-auth@^5.0.0-beta.31`）
- 推奨: exact 固定＋v5安定版の追跡。

### M4. next 経由 postcss の XSS 系 transitive 脆弱性（ビルドツール） ⏳監視
- 場所: `package.json`（next 16.2.9）
- 推奨: 実害は低め。Next 16.x のパッチ版が出たら追随。

---

## Low

### L1. cron の CRON_SECRET 比較が非タイミングセーフだった ✅修復済
- 場所: `src/app/api/cron/cario-sync/route.ts`
- 修復: `timingSafeEqual` に統一（external 認証と同方式）。fail-closed は元から良好。

### L2. 画像配信の Content-Disposition 未設定 ⏳未対応（多層防御）
- 場所: `src/app/api/dispatch-images/[id]/file/route.ts`
- 内容: 拡張子は jpg/png/webp に制限済・サーバ生成ファイル名のため実害は低いが、`Content-Disposition: inline` と（全体ヘッダで付与済の）`nosniff` で多層防御。

### L3. Prisma dev-only `@hono/node-server` のパストラバーサル ⏳監視
- 場所: `package.json`（dev依存）。本番非同梱のため実害低。

---

## 良好（対応不要）だった項目
- 生SQL（`$queryRaw`/`$executeRaw`）なし・Prisma パラメタライズ徹底
- `eval`/`new Function`/`child_process` なし、`dangerouslySetInnerHTML` なし
- PIIログ違反なし（氏名/電話/住所/伝票No を console に出していない）
- audit_logs は件数/status/source/fieldName のみ（PII値なし）
- ハードコードされた実シークレットなし（`.env.example` は空・`.gitignore` 適正・実 `.env` 未コミット）
- CORS はデフォルト同一オリジン（`Access-Control-Allow-Origin:*` なし）
- external / LINE(secret設定時) の認証はタイミングセーフ・fail-closed
- CARIO キー・接続文字列をログに出さない、CARIO 経路に SSRF なし
- Google Maps キーはサーバ専用（`NEXT_PUBLIC_` 露出なし）
- driver `[id]` 系は所有者検証あり（IDOR なし）

---

## 監視運用（本日以降）
- 日次: `npm audit` 差分 / git 変更のセキュリティレビュー / 新規 API ルートの認証確認 → 本ファイル追記＋`PROJECT_STATUS.md` 反映
- 変更検知: 認証・external・cron・upload・OCR 系ファイルの変更は重点レビュー
- 未対応項目（H4/H5/M1-M4/L2）を優先度順にトラッキング
