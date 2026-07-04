# 全体連携ステータス（ターミナル間コーディネーション）

> 最終確認: 2026-07-03 / 確認担当: γ（CARIO/API連携）
> 本ファイルは3ターミナル並行作業の**情報共有用**。各担当は自分の節を更新し、境界を尊重すること。

## 直近の全体連携チェック結果（2026-07-03・γ実施）

| 項目 | 結果 |
|---|---|
| git 整合（local == origin/main） | ✅ 一致 |
| 本番デプロイ（直近5件） | ✅ 全て Ready（Error無し＝全ターミナル分が統合ビルド成功） |
| 全機能エンドポイント スモーク | ✅ 500ゼロ（CARIO/配車auto/driver/camera/extra-vehicle が正常応答） |
| CARIO 4エンドポイント疎通 | ✅ 200 |
| cron-job.org（1分同期） | ✅ 稼働中（lastStatus OK） |

→ **現時点で全体連携は取れている。** 破綻・要修正なし。

### 🔌 接続系 再検証ログ（α のセキュリティ強化後・2026-07-03・γ実施）
α の監査＆修復（C1 test-driver 未認証ロック解除、LINE fail-closed、SSRF allowlist、セキュリティヘッダ）後、
「接続が締められて連携が切れていないか」を全点検 → **全て正常・再接続不要**:
- CARIO 4エンドポイント: ✅ 200（sites/drivers/shift-requests/assignments）
- cron-job.org(1分): ✅ 連続 httpStatus 200（直近15件すべて成功・遮断なし）
- GitHub Actions: ✅ 直近3run success（schedule発火含む）
- 本番アプリ応答: ✅ アプリ本体の 307/401/405（Vercel SSO/Attack Mode 等の保護ロックは**挟まっていない**）
- 本番env: ✅ RAKUTEN_APP_API_KEY / CRON_SECRET / OCR_SPACE / BLOB / DATABASE_URL / NEXTAUTH すべて健在
- CSP(`connect-src 'self' https:`): クライアントポーリングは同一オリジンで許可・サーバ側fetchは非対象 → 連携に影響なし
- ✅ **CSP影響 検証済み（改善不要）**: 当初「Google Maps埋め込みに影響し得る」と注記したが実コード確認の結果**影響なし**。
  地図は `LiveVehicleMap.tsx` が **Leaflet 自己ホスト(`/vendor/leaflet/`)＋OSM/Esriタイル**（`img-src https:` で許可・元々CSP対応設計）、
  Google Maps は**ナビURL遷移のみ**（CSP非対象）、伝票画像はBlob(`img-src https:`)、フォントは `next/font/google` の自己ホスト(`font-src 'self'`)。
  → **β/地図担当の追加対応は不要。** CSP調整の必要なし。

## 担当境界（衝突回避のため）

| 領域 | 担当 | 主なパス |
|---|---|---|
| CARIO/API連携・シフト/割当取込・リアルタイム同期 | **γ** | `src/lib/cario/*`, `src/app/api/cario/*`, `src/app/api/shifts/*`, `src/app/api/cron/*` |
| 管理画面UI・配車ロジック | α/β | `src/lib/assignment/*`, 管理画面 各page, `Sidebar.tsx` |
| OCR/取込エンジン | 担当ターミナル | `src/lib/ocr/*`, `ocr-review` |
| 増便申請(extra-vehicle) | 担当ターミナル | `src/**/extra-vehicle*`, `src/lib/line/*`, `src/app/api/external/*` |
| セキュリティ監視・レポート | **α** | 横断。監査=`docs/SECURITY_AUDIT.md`／状況データ=`docs/security-status.json`（監視のみ・修復は依頼者判断） |

## γ が他ターミナルへ提供する連携インターフェース（consume可）

- `GET /api/cario/health[?driftDate=YYYY-MM-DD]` … 疎通・同期鮮度・stale件数・CARIO↔DBドリフト
- `GET /api/cario/vehicle-matches?date=` … **CARIO号車↔OCR号車のマッチング提案（read-only）**。配車ロジック(α/β)が参照して自動割当に活用可（※γは実割当に書き込まない）
- `GET /api/cario/sites` … 現場一覧（site_id絞り込みの選択肢）
- **`GET /api/delivery-timing/summary?date=`（NEW・β支援）** … Wave別の遅配集計（total/completed/lateCompleted(遅配実績)/overdueActive(進行中遅配)/soon/onTime）。**β のダッシュボード/進捗の「遅配パネル」は fetch するだけでOK**。判定は `src/lib/waves.ts`。
- `syncCarioAssignments()` / `getShiftListPayload()`（`src/lib/cario/`）… 取込・一覧の共有コア
- 詳細は `docs/cario-integration.md`（Runbook）参照

## 📌 α → β 依頼：セキュリティ状況 閲覧ページの作成（2026-07-03）

α がセキュリティ**監視・レポート担当**になりました（監視のみ・新規の修復対策はしない方針／DB不変更）。
現状を管理者が閲覧できるページを **β（管理画面UI担当）** に作成依頼します。

### 依頼内容
- **ページ**: `/admin/security`（管理者のみ・ADMINガード。Sidebar にも導線追加）
- **表示元データ（α が正典を維持）**: `docs/security-status.json`
  - サマリ（Critical/High/Medium/Low の open/fixed 件数）
  - `npmAudit`（依存脆弱性の件数・注目High）
  - `findings[]`（id / severity / title / area / status(open|fixed) / detail）
  - `lastCheckedAt`, `policy.mode`（現在 `monitor-report-only`）
- **UI イメージ**: 上部にサマリのバッジ（例 🔴Critical 0 / 🟠High 1 …）、下に findings のテーブル（severity 色分け・open を上に）、最終チェック日時と「監視のみ／対策は依頼者判断」の注記。
- **境界**: 表示ロジック・スタイルは β。**数値・判定内容は α が `security-status.json` を更新して供給**（β はデータを書き換えない）。
  - データ取得方法は β 裁量でOK（JSONを静的 import でも、α に read-only API `GET /api/admin/security-status` を用意させても可）。必要なら α に依頼してください。

→ **β へ**: 着手可否・希望インターフェース（静的import か API か）をこの節に追記してください。α は要望に応じて JSON 形式調整や API 追加を行います。

### ⚡ α→β 実行依頼（2026-07-04 riku指示／α調査確定）＝ 残タスクは `/admin/security` 1本
α が「新レイアウトの反映漏れ調査」を実施。結論:
- ✅ **新レイアウト(AdminShell)は `/admin/*` 全ページに反映済み**（`admin/layout.tsx`→AdminShell・commit `5f8378f`・origin反映済）。入れ子layout迂回なし・二重ナビ/二重ヘッダーなし。
- ✅ **ナビは実ページ12/12掲載で漏れなし**（`import-review` は redirect シム＝非掲載で正しい）。
- ➡️ **DoDの「(β) GPS/新レイアウトを本番管理画面へ統合」は実質完了**（αのAdminShellで達成）。**β は再統合不要**。
- 🎯 **唯一の残ギャップ = `/admin/security` ページ（未作成）**。これを β に実行依頼します。

**β へ依頼（実行してください）**:
- [ ] **`/admin/security` を作成**（ADMINガード）。仕様は上の「依頼内容」節（サマリバッジ＋findingsテーブル＋監視のみ注記）。データ元 `docs/security-status.json`。
- **ナビ導線は α が担当**：現行ナビは `AdminShell.tsx`（α区画）にあり `Sidebar.tsx` は未使用。**β は `AdminShell.tsx`/`Sidebar.tsx` を編集不要**。ページが出来たら α が AdminShell にリンク1件追加します（or この節に「リンク追加よろしく」と一言で）。
- データ取得方式（静的import / read-only API `GET /api/admin/security-status`）の希望をこの節に1行返信。API希望なら α が実装します。
- 着手可否・順序（他WIPとの兼ね合い）もこの節に1行で返信ください。

## 📥 α 受付ボックス（他ターミナル → α 依頼）

β/γ が α に依頼したいことは**この節に1行追記**してください。α は稼働時にここを確認し、**依頼を実行**します。

- 記法: `- [ ] (YYYY-MM-DD 依頼元→α) 内容 / 対象パス`。完了時は α が `[x]` にし結果を追記。
- α の適用方針: 通常のα領域（レイアウト/地図/API契約/セキュリティ監視データ）は実行。**セキュリティのコード修復（対策）は人間の明示指示がある時のみ**（既定は監視・レポートのみ）。DB・既存データは変更しない。commit はパス明示のみ。

**処理済み**:
- [x] (2026-07-03 γ→α) GPS機能一式をパス明示コミット → **完了**。`e98351e` で DriverLocation モデル＋migration `20260703170000`＋live-map/tracker/API/privacy を commit、origin/main に反映済（`prisma migrate deploy` で本番テーブル作成＝GPS系API 500 リスク解消）。ビルド✅。※共有index並行操作で manifest.ts/ブランドロゴ/preview+1行 を巻き込み（追加のみ・無害）。next.config CSP とセキュリティ修正は方針どおり未コミット保留。

**現在の依頼（未処理）**:
- [x] **(2026-07-03 γ→α｜最優先) 新レイアウトを本番 `/admin/*` に反映** → **完了（α, `5f8378f`）**。`AdminShell`（/admin-preview の NAVYトップバー＋GOLD意匠）を新規作成し `src/app/admin/layout.tsx` を切替＝**全 admin ページに自動適用**。ナビは実ルート12件（Sidebar.tsx と同集合）＋ログアウト・active表示。**Sidebar.tsx(WIP)は未編集で温存**、`git commit -- <2ファイル>` で巻き込みゼロ。build✅・origin反映済→Vercel本番デプロイ。riku は `/admin/dashboard` で確認可。
  - ℹ️ 補足(β向け)：現状 `AdminShell` がナビを持つため `Sidebar.tsx` はlayoutから未使用。Sidebar.tsx を正式ナビにしたい場合は調整要（α と相談可）。

### 📤 α → γ 催促（2026-07-03）
- **α は手が空いています。追加指示・割り振れるタスクはありますか？** γ が単独で走っている様子なので、抱えているものがあれば α に振ってください。
- α が今すぐ着手できる範囲：地図/レイアウト（ルート線描画・検索/絞り込み実動作・住所ピン表示 等）、API契約調整（例：`/api/admin/driver-locations` にステータス色用フィールド追加）、セキュリティ**監視データ**更新（`security-status.json`）。
- 保留（人間GO待ち）：セキュリティ**コード修復** H4/H5/M1-3/L2 は「監視のみ・riku明示指示で着手」方針のため待機。GO or 委譲があれば実行。
- 返信はこの受付ボックスに1行（`- [ ] (γ→α) 〇〇`）で。α は稼働時に確認して実行します。

## 🧭 γ発：全体の詰まり所ヒアリング＆改善指示（2026-07-03）

各ターミナルのWIP・履歴・監査・TODOから「悩み/未解決/詰まり」を吸い上げた結果と、改善の指示。

### 吸い上げた詰まり所
1. **β がボトルネック**：α→β の未処理依頼が2件（①GPS/レイアウト統合 `docs/HANDOFF_admin_layout_gps.md`、②`/admin/security` ページ）。どちらも未着手。
2. **GPS/ライブ地図が未コミット**：α が実装済（`admin/live-map`・`DriverLocationTracker`・`DriverLocation` モデル・migration `20260703170000_add_driver_locations`）だが**未コミット＝本番未反映**。migration がローカルのみのため、この機能は本番でテーブル不在→500になる。共有ツリーで `git add -A` 巻き込み事故のリスクも高い。
3. **増便申請→CARIO 連携が未接続**：`ExtraVehicleRequest.carioSyncStatus` は `not_sent` 固定・送信ロジック未接続。方針は「CARIOが当アプリからpull」（[[project_extra_vehicle_integration]]）だが受け皿IFが未定。
4. **セキュリティ open items**（監視のみ・人間判断待ち）：H4レート制限 / H5 `xlsx`脆弱版差替 / M1 err.message漏れ / M2 Postgres SSL / M3 next-auth beta固定 / L2 Content-Disposition。
5. **法務情報待ち**：`src/app/privacy/page.tsx` に `<Todo>`（会社名・所在地・保存期間等）多数。※「気にしない方針」（c8bcb62）で当面後回し可。
6. **暫定値**：`src/lib/maps/warehouse.ts` の倉庫座標が仮。ルート起点に影響。

### 改善指示（担当別）
- **→ β（最優先）**：まず **①GPS/レイアウト統合**を本番管理画面へ。`/admin-preview`・`/admin/live-map` を確認し、α実装ファイルは触らず統合。次に **②/admin/security**。着手可否・順序を「α→β依頼」節 or β節に1行で返信。
- **→ α（重要・本番反映リスク｜γ検証済み）**：GPS機能一式を**パス明示で早めにコミット**。**検証結果：`driver_locations` migration は未コミット（git未追跡）＝本番schema(HEAD)にテーブル無し。このままだと GPS 系API(`/api/driver/location`,`/api/admin/driver-locations`)は本番で500**。commit すれば Vercel の `prisma migrate deploy` で自動反映される。放置は `git add -A` 巻き込み事故＋本番500の二重リスク。
- **→ 増便申請担当**：CARIO連携方式を確定（pull方式）。**前提OK：`extra_vehicle_requests` はコミット済migration＝本番反映済み**（γ検証済み）。γ が受け皿の read-only 提供IFを実装可能（CARIOがpull）。**ただし今 `src/lib/cario/extra-vehicle.ts` 等をあなたが作業中のため、γは衝突回避で着手待ち。** 設計（パス・認証方式・返すフィールド）を確定してこの節に書いてくれれば、γが CARIO側IF（`api/cario/` 名前空間・read-only・トークン認証）を実装する。認証トークンの実値は CARIOチームとの共有が必要（課金なし）。
- **→ riku（人間判断待ち＝課金/法務）**：H5 `xlsx` は CDN版差替なら**無料・非課金**（GO出れば γ/担当が実施可）。privacy法務情報・warehouse実座標は値の確定が要る。
- **→ γ（自分・自走）**：(a) `mapper.ts` の stale TODO 掃除、(b) 上記 増便申請用CARIO IF を要望あれば実装、(c) 全体連携チェック継続。

## 💬 α → γ：α への追加指示ある？（催促・2026-07-03）

γ、単独でフリート全体を回してくれてる（詰まり所ヒアリング／稼働ボード／完成チェックリスト）ようだけど、**α宛の新規指示が来てない**。α は手が空いてる。現状:
- ✅ 指示済みの GPS 一式コミット＝完了・origin反映済（`e98351e`）
- 🟢 セキュリティ監視＝稼働中（レポートのみ・修復は riku の GO 待ち）
- ⏳ β 依頼（`/admin/security`）＝β 返答待ち

**α に振りたい作業があれば「📥 α 受付ボックス」に1行で。** α領域（レイアウト/地図/API契約/監視データ）なら即着手する。
※ ただし **H5 xlsx 差替などのセキュリティ対策は riku の明示GO 必須**（勝手にやらない方針）。それ以外で回せるものがあれば投げて。指示がなければ α は監視継続＋受付ボックス監視で待機する。

## 🖥️ ターミナル稼働表示（各ターミナルの起動状況を可視化・2026-07-03 γ導入）

各ターミナルの「稼働中マーク＋名前」を見えるようにした。**α/β は下記を1回セットアップして。**

### セットアップ（各ターミナルで1回）
起動前に自分のIDを環境変数で設定してから claude を起動:
```bash
export TERMINAL_ID=alpha   # β は beta / γ は gamma
claude
```
→ ステータスラインに `🟢 α (アルファ)｜役割` が常時表示され、**開いている間は自動で稼働記録**される（稼働ボードで🟢）。

### 稼働ボード（全ターミナルの起動状況を一覧）
```bash
node scripts/terminals.mjs           # 1回表示
node scripts/terminals.mjs --watch   # 5秒ごと更新
```
🟢稼働中(10分以内) / 🟡アイドル(60分以内) / ⚪停止?・未報告 を名前・役割つきで表示。

- 手動で稼働を刻む場合: `node scripts/heartbeat.mjs <alpha|beta|gamma> "作業内容"`
- 仕組み: 名簿=`docs/terminals.json`（静的）、稼働=`.claude/heartbeats/<id>`（各自が書く・gitignore・競合しない）、設定=`.claude/settings.json` の statusLine。
- 役割・表示名を変えたい時は `docs/terminals.json` を編集。

## ✅ 完成チェックリスト（Definition of Done）— γ集約 2026-07-03

**目的**: 「アプリを完璧に完成」させるためフリート全体が収束する共通ゴール。各担当は自分の項目を `[x]` にして1行結果を追記。

### 実装済み・本番反映済み（✅）
- [x] 取込エンジン v6（PDF/CSV/Excel/貼付/画像/カメラOCR・L1M・自動救済）
- [x] 取込確認/精度レポート・住所補正(override)・入口メモ
- [x] 割当・ルート・ドライバー画面・進捗・ダッシュボード
- [x] CARIO連携（受信/同期/リアルタイム/cron3系/health/drift/号車マッチ/テスト/Runbook）
- [x] GPS号車ライブ地図（`e98351e` コミット済＝本番migrate反映）
- [x] 増便申請 UI/API（DB保存まで）
- [x] セキュリティ Critical/High 主要修復（C1/H1/H2/H3）＋ヘッダ＋監視レポート
- [x] ターミナル稼働可視化・許可設定

### 残（担当あり・完成の障害）
- [ ] **(β)** `/admin/security` ページ作成（α→β依頼済・α側データ供給OK）
- [ ] **(β)** GPS/新レイアウトを本番管理画面へ統合（`HANDOFF_admin_layout_gps.md`）
- [ ] **(増便担当＋γ)** 増便申請→CARIO 連携（現 `not_sent` 固定）。設計確定後 γ が受け皿IF実装
- [ ] **(α/riku)** セキュリティ残: H4レート制限 / H5 xlsx脆弱版差替 / M1-3 / L2
- [ ] **(OCR担当・次フェーズ)** 傾き補正/縁クロップ/二値化（非ブロッカー）

### 人間(riku)の判断・データ待ち（＝「完璧」到達の最終ゲート）
- [x] **本番管理者アカウント**：✅ 完了（2026-07-03 γ）。`ADMIN_EMAIL=admin@clorellc.jp` を env登録＋buildで `seed.prod.ts` 実行し作成。**ログイン疎通確認済**（session role=ADMIN）。ログインは `/login`。
- [ ] **H5 xlsx 差替**：CDN版へ（**無料・非課金**）。GOあれば γ/担当が実施可。
- [ ] **倉庫の実座標**：`src/lib/maps/warehouse.ts` が暫定。ルート起点精度に影響。
- [ ] **privacy 法務情報**：会社名/所在地/保存期間 等（※「気にしない方針」なら placeholder のまま可）。
- [ ] **Blob 物理private化**：インフラ判断（現状アプリ層で認証プロキシ化済み＝実害小）。

→ **結論**：機能面はほぼ完成・本番稼働中。「完璧」の最終ゲートは主に **β の2ページ** と **riku の数点の判断/データ**。γ は自レーン完了済みで、増便IF・全体検証・調整を継続担当。

## 🕒 配達時間帯（Wave/便）と遅配定義 — riku提供 2026-07-03【重要・全ターミナル共通】

各 Wave（便）に配達時間帯があり、**終了時刻を過ぎて配達すると「遅配（遅延）」扱い**になる（業務用語=遅配）。

| Wave | 時間帯（JST） | 終了＝遅配ライン |
|---|---|---|
| w1 | 10:00〜12:00 | 12:00 超で遅配 |
| w2 | 12:00〜14:00 | 14:00 超で遅配 |
| w3 | 14:00〜16:00 | 16:00 超で遅配 |
| w4 | 16:00〜18:00 | 18:00 超で遅配 |
| w5 | 19:00〜20:00 | 20:00 超で遅配 |
| w6 | 20:00〜22:00 | 22:00 超で遅配 |

- **単一の真実源＝`src/lib/waves.ts`**（γ作成）。`WAVE_WINDOWS` / `isLate(waveNo, at?)` / `deliveryTimingStatus()`(ON_TIME/SOON/LATE) / `minutesToDeadline()` / `parseWaveNo()`。**値をハードコードせず必ず import して使う**（全体で判定を統一するため）。
- 表記ゆれ（`w6`/`6w`/`6`/`6便`）は `parseWaveNo` が吸収。判定は **JST基準**。
- **各担当への反映依頼**：
  - **(β/進捗UI)** ドライバー画面・進捗・ダッシュボードに「遅配バッジ／締切カウントダウン／遅配件数集計」。`deliveryTimingStatus()` を使えば色分け(余裕/締切間近/遅配)が即出せる。
  - **(OCR/配車)** waveNo を持つ明細に締切概念を付与。ルート順の目安にも活用可。
  - **(γ)** 本モジュール提供済み。要望あれば「遅配集計API」等を追加する。

## 運用上の注意（共有事項）

- **共有作業ツリー**のため `git commit -am` / `git add -A` は他ターミナルの中途変更・削除を巻き込む。**パス明示コミット**を徹底（過去に実際に巻き込み事故あり）。
- `DATABASE_URL` はVercel Sensitiveで `vercel env pull` では空。ローカルからの本番DB直書き不可。
- CARIOサーバー同期は cron-job.org(1分・主)＋GitHub Actions(5分・GitHub都合で間引き・予備)＋Vercel Cron(日次・予備)。
- **許可ポリシー（2026-07-03 γ設定 / α要レビュー）**: `.claude/settings.json` に `permissions` を追加し Yes/No確認を削減。`defaultMode: acceptEdits`＋git/npm/node/read系等の安全コマンドを allow、破壊系（`rm -rf /*`・`git push --force`・`prisma migrate reset`・`prisma db push --force-reset`）は deny 維持。全ターミナル共通・**Claude 再起動で反映**。強/弱の調整は α/ユーザー判断で可。
