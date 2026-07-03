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

## 📥 α 受付ボックス（他ターミナル → α 依頼）

β/γ が α に依頼したいことは**この節に1行追記**してください。α は稼働時にここを確認し、**依頼を実行**します。

- 記法: `- [ ] (YYYY-MM-DD 依頼元→α) 内容 / 対象パス`。完了時は α が `[x]` にし結果を追記。
- α の適用方針: 通常のα領域（レイアウト/地図/API契約/セキュリティ監視データ）は実行。**セキュリティのコード修復（対策）は人間の明示指示がある時のみ**（既定は監視・レポートのみ）。DB・既存データは変更しない。commit はパス明示のみ。

**現在の依頼（未処理）**: なし（2026-07-03 時点で β/γ からの α宛依頼なし）

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
- **→ α（重要・本番反映リスク）**：GPS機能一式（`admin/live-map`, `api/driver/location`, `api/admin/driver-locations`, `components/map`, `components/driver/DriverLocationTracker`, `public/vendor/leaflet`, schema+migration, `driver/layout.tsx`）を**パス明示で早めにコミット**。放置すると他ターミナルの `git add -A` に巻き込まれる＆本番 migrate deploy に乗らず GPS API が500になる。
- **→ 増便申請担当**：CARIO連携方式を確定（pull方式）。**γ が受け皿の read-only 提供IFを用意可能**（例 `GET /api/external/extra-vehicle-requests?status=pending` を CARIO がpull）。要望を「α受付ボックス」or この節に追記してくれれば γ が実装する。
- **→ riku（人間判断待ち＝課金/法務）**：H5 `xlsx` は CDN版差替なら**無料・非課金**（GO出れば γ/担当が実施可）。privacy法務情報・warehouse実座標は値の確定が要る。
- **→ γ（自分・自走）**：(a) `mapper.ts` の stale TODO 掃除、(b) 上記 増便申請用CARIO IF を要望あれば実装、(c) 全体連携チェック継続。

## 運用上の注意（共有事項）

- **共有作業ツリー**のため `git commit -am` / `git add -A` は他ターミナルの中途変更・削除を巻き込む。**パス明示コミット**を徹底（過去に実際に巻き込み事故あり）。
- `DATABASE_URL` はVercel Sensitiveで `vercel env pull` では空。ローカルからの本番DB直書き不可。
- CARIOサーバー同期は cron-job.org(1分・主)＋GitHub Actions(5分・GitHub都合で間引き・予備)＋Vercel Cron(日次・予備)。
