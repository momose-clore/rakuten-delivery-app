# 全体連携ステータス（ターミナル間コーディネーション）

> 最終確認: 2026-07-03 / 確認担当: γ（CARIO/API連携）
> 本ファイルは3ターミナル並行作業の**情報共有用**。各担当は自分の節を更新し、境界を尊重すること。

## 🆕📌 β → γ 依頼：CARIO 管理者ページに「楽天配送管理」への遷移ボタンを追加（2026-07-13・riku指示）

**背景**：riku指示「CARIO側の管理者ページに、この楽天管理へのボタンを表示させたい」。
楽天配送アプリ（β管轄）は別リポジトリのため β から CARIO 側は編集不可 → **CARIO のコードを持つ γ が追加する**方針でriku合意（2026-07-13）。

**やること（γ）**：CARIO 管理者ページのヘッダー/ダッシュボード等に、下記リンクボタンを1つ設置。

- **遷移先URL（本番・確定）**：`https://rakuten-delivery-app.vercel.app/admin/dashboard`
- ボタン文言：**「楽天配送管理」**（アイコンを付けるなら配送/トラック系）
- 新規タブ推奨（`target="_blank" rel="noopener noreferrer"`）。クリック後は楽天側のログイン（管理者ID/PW）を通す想定でOK。

**貼るだけスニペット例（CARIOがReact/Nextの場合）**：
```tsx
<a
  href="https://rakuten-delivery-app.vercel.app/admin/dashboard"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 rounded-md bg-[#26324F] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
>
  楽天配送管理
</a>
```
（プレーンHTMLでも同URLの `<a>` でOK。表示位置・デザインはCARIO側の既存トンマナに合わせて調整可。）

**補足**：riku決定により **相澤至人への楽天管理アカウント作成は不要**（対応なし）。表示可否の出し分けもCARIO側の判断でOK。

---

## 🆕📌 α → γ 依頼：CARIO に「稼働者の終了報告 pull API」を追加してほしい（2026-07-13・riku指示）

**背景**：美女木デポの台数確認表（`/admin/vehicle-count`・α実装）は、waveの終了報告1件＝1台として日付列に自動加算する。現状 α 側は「稼働者が当アプリで完了報告 → 加算」で動くが、**実運用では稼働者は群LINE【楽天スーパー美女木】で終了報告している**ため当アプリにデータが入らない。
riku判断：**群LINE直読みは方針違反（当アプリは楽天/CARIOのLINEに触らない）で不可** → **CARIO が保持する終了報告を当アプリが pull する**方式に決定。

**α が実機確認済み（2026-07-13）**：現行 CARIO API `/api/external/rakuten/assignments` は**予定（割当）データのみ**で完了/終了報告フィールドなし。`reports`/`completions`/`wave-status` 等は404。→ **新エンドポイントが必要**。

**γ / CARIO へお願いする契約（希望仕様。CARIO側の実データに合わせて調整可）**：
```
GET /api/external/rakuten/wave-completions?from=YYYY-MM-DD&to=YYYY-MM-DD[&site_id=]
Authorization: Bearer <RAKUTEN_APP_API_KEY>   ← 既存キーと共通で可

200 →
{
  "from":"2026-07-12","to":"2026-07-12",
  "completions":[
    {
      "work_date":"2026-07-12",
      "site":{ "id":"...", "name":"楽天ネットスーパー（美女木）" },
      "driver":{ "id":"...", "name":"..." },     // どちらか片方でも可（突合はid優先）
      "course":{ "course_no":1, "name":"1号車" },  // 任意（あれば号車突合に使う）
      "wave_no":3,                                // 1〜6（必須）
      "vehicle_type":"貼付|SP|増車",               // 任意。あれば区分加算、無ければ「貼付」扱い
      "completed_at":"2026-07-12T15:20:00+09:00"  // 終了報告時刻（必須）
    }
  ]
}
```
- **最小要件**：`work_date` / `wave_no` / `driver`(id or name) / `completed_at` の4つがあれば台数反映可能（貼付として日次加算）。`vehicle_type` があれば貼付/SP/増車に振り分ける。
- **フォールバック**：構造化が難しく「wave単位の完了台数」しか出せない場合は、`{work_date, wave_no, completed_count, vehicle_type?}` 形式でも可（driver粒度が無くても日付×waveの台数は埋められる）。
- **粒度/更新**：pull間隔は当アプリ側で調整（既存 cron/ポーリング流用）。CARIO側は「最新の完了状況を返す」だけでOK（重複排除は当アプリ側で driver×wave×date のユニークで担保）。

**分担**：
- **γ**：CARIO側エンドポイント調整 ＋ 当アプリ側 pull クライアント（`src/lib/cario/*`＝γ区画）。取得結果を **α提供の反映関数**へ渡す。
- **α**：受け取った完了データを台数確認表へ反映する部分（`src/lib/kpi/vehicle-count.ts`＝α区画）。**契約が固まり次第 α が反映I/Fを実装**（driver×wave×date 単位の upsert → 貼付/SP/増車 集計）。

→ **γ へ**：CARIO側で出せる実データ形（driver粒度が出せるか／vehicle_type有無）をこの節に1行返信ください。それに合わせて α が反映I/Fを確定します。

**✅ α側は実装完了（2026-07-13）＝CARIOがendpointを出せば即稼働**：
- `wave_completions` テーブル（migration `20260713120000`）＋ pull `src/lib/cario/getCompletions.ts`（**404/未設定は握って無害**）＋ 全刷新sync `src/lib/cario/completions-sync.ts`（driver突合 `carioDriverId`・重複排除・fallback対応）。
- 台数反映：`getVehicleCountProgress` が `wave_completions` を貼付/増車にマージ（**SPは手入力を正**として非取込）。
- 取込導線：`POST /api/admin/vehicle-count/sync-cario` ＋ 画面ボタン「CARIO終了報告を取込」＋ cron `cario-sync` に追加（best-effort）。
- 検証済：実CARIO APIで**404を握れる**こと、疑似データで貼付/増車マージ＋重複排除＋carioActiveバッジ。
- **γ対応事項**：CARIO側 `wave-completions` を実装（or パス名を `CARIO_COMPLETIONS_PATH` で通知）。当アプリ側の追加改修は基本不要。

**🔄 実仕様に配線完了（2026-07-13・γから実API提供）**：
- 終了報告の実体は **`GET /api/rakuten/wave?driver_id=<uuid>`**（driver単位/当日固定/認証不要/site引数なし・`rakuten_wave_records`＋`rakuten_daily_reports`）。当初 `/api/external/rakuten/*` を探して404だった。
- α側 `getCompletions.ts` を実仕様へ変更：**assignments から美女木のdriver列挙→各driverに /api/rakuten/wave** →`waves[]`を貼付/増車(`zoubin_approved`)に対応付け。cron本日ぶんを日次蓄積。
- ライブ疎通OK（HTTP200・0件は稼働者未報告のため）。
- **γへ相談（任意・非ブロッカー）**：月次台数表向けに、**日付指定で美女木の全wave_recordsを一括返す read-only endpoint** があると過去日も一発で埋まる（現状は当日pull＋日次蓄積で運用）。難しければ現状仕様のままで可。

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
- **`GET /api/delivery-timing/summary?date=`（β支援）** … Wave別の遅配集計（total/completed/lateCompleted(遅配実績)/overdueActive(進行中遅配)/soon/onTime）。**β のダッシュボード/進捗の「遅配パネル」は fetch するだけでOK**。判定は `src/lib/waves.ts`。
- **`GET /api/admin/kpi/summary?date=`（NEW・β支援 `df8bdc0`）** … 日次KPI：稼働ドライバー数/完了率/オンタイム率/遅配(実績・進行中)/Wave別/ドライバー別。**ダッシュボード(item4)は fetch するだけ**。
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

## 🗺️ α → β 実装依頼：マップ性能向上（A ルート最適化 / D 住所精度）＝**全部 無料版のみ**（2026-07-04 riku指示・α調査確定）

riku 指示：Googleマップ連携の“性能”を上げる。**A（配送を実際に短く/速く）とD（住所ピンのズレ解消）を、追加課金ゼロ・カード登録不要のサービスのみで**実装する。α が方式・無料枠・工数を調査済み（出典は本ファイル末尾/報告参照）。

**🔒 絶対制約**：**課金ゼロ厳守（カード登録が要るサービスは使わない）／DB・既存データは壊さない／パス明示コミット（`git add -A`禁止）**。既存アルゴリズムはフォールバックとして残す。

**🚨 ビルド赤アラート（2026-07-04 α検知）**：`src/lib/ocr/barcode.ts` が型エラーで **origin/main のビルドが赤＝全ターミナルの本番デプロイ停止中**。原因＝`import sharp from "sharp"` なのに型を `sharp.Sharp`/`sharp.Metadata` と名前空間参照（未解決）。**OCR担当が修正中**（`import type * as SharpNS` 追加済だが使用箇所が未置換で**まだ赤**）。→ **OCR担当へ：残り3箇所 `sharp.Sharp`→`SharpNS.Sharp` / `sharp.Metadata`→`SharpNS.Metadata`（21,41,51行付近）を置換で緑化**。αは衝突回避で本ファイルに触れていない。

**α進捗**：
- [x] **A① 2-opt/Or-opt 実装済（α, `ac33711`・push済）**。`optimizeRoute`＝最近隣法→2-opt。build個別✅（※上記barcode.ts赤のため本番反映は緑化待ち）。
- A②(ORS) は **`ORS_API_KEY` が必要／αはアカウント登録不可（人手のWebサインアップ要）** → riku or β が無料登録。キー投入まで現行アルゴリズムにフォールバック実装予定。
- D①〜⑤ は次段でα実装可（D①キャッシュはDB追加＝additiveのみ・既存不変更）。

### 🅰 ルート最適化（道路ベース化）— 担当 β（＋地図描画のみ α）
- **現状**：`src/lib/routes/sortByNearest.ts` = 直線距離(ハバーサイン)＋貪欲な最近隣法（道路無視・部分最適）。
- [x] **A① 2-opt/Or-opt を追加** → **α完了（`ac33711`）**。`src/lib/routes/sortByNearest.ts` に `twoOptImprove`/`optimizeRoute`、`generateRoute` が使用。β再実装不要。
- [x] **A② 道路ベース最適化** → **α実装完了・origin反映済**（`src/lib/routes/ors.ts`＝ORS最適化API/VROOM、`generateRoute` が優先使用・失敗/未設定/70件超は A①(2-opt) へ自動フォールバック。使用エンジンを `optimizer(ors|local)` で監査記録）。ビルド緑。キー疎通テスト200確認済。
  - 🔑 **本番で有効化するには Vercel の Production env に `ORS_API_KEY` 設定が必要**（現在キーはローカル `.env.local` のみ＝gitignore・非コミット・漏洩なし）。未設定の本番では自動で A①(2-opt) にフォールバックするので**壊れない**。→ **riku/β：`vercel env add ORS_API_KEY`（or ダッシュボード）で本番投入を**。
  - 将来スケールで枠超過するなら OSRM+VROOM 自前ホスト（ソフト無料）だが**現状は不要**（12〜15号車/日＝1日十数リクエスト）。
- [x] **A③ 地図に道なり経路を描画** → **α完了（`9a8176d`）**。`LiveVehicleMap` に `routePath` prop（Leaflet polyline）追加、`getRouteGeometry`（ORS Directions）＋read-only API **`GET /api/routes/geometry?driverId=&date=&waveNo=&return=1`**（→`{path:[lat,lng][], stopCount}`）。**消費方法**：地図に `<LiveVehicleMap ... routePath={path} />` を渡すだけ。ドライバーの route_order 順を実道路で描画。ORS未設定/失敗時は線なし（壊れない）。βは地図ファイル非編集でOK。
- 工数目安：約2〜2.5人月 / 運用費 ¥0。

### 🅳 住所精度（ピンのズレ解消）— 担当 β
- **前提**：無料のGSI(国土地理院)は町丁目レベルで**番地精度はGoogleに劣る**→ **Google置換ではなくフォールバック/検算に限定**。
- [x] **D① ジオコーディング・キャッシュ** → **α完了（`56f578c`）**。`GeocodeCache` モデル＋migration `20260704145258_add_geocode_cache`（geocode_cache テーブル・additive/既存非変更）。`geocodeAddress` が正規化キーで参照→ヒット即返却/ミス時のみGoogle・GSI→結果保存（fire-and-forget）。生成クライアントはgitignore＝Vercel build時に再生成・migrationは `prisma migrate deploy` で本番自動適用。ビルド緑・migrationローカル適用確認済。氏名/電話/伝票Noは保存せず住所キーと座標のみ。
- [x] **D② 住所正規化を変換前に強化** → **α完了（`2200ca4`）**。`geocodeAddress` が `normalizeAddress().normalizedAddress`（建物名除去・全角半角統一）で問い合わせ→取れなければ生住所。`src/lib/maps/geocode.ts`。
- [x] **D③ 精度ランクで自動フラグ** → **α完了（`9ad5134`）**。`geocode` route が結果精度から `coordinateConfidence` を HIGH/MEDIUM/LOW 判定（gsi・APPROXIMATE等=LOW→UIの低信頼「⚠要確認」に反映）。
- [x] **D④ 承認済みピン(override)の同一住所 自動再利用** → **α完了（`9ad5134`）**。`findApprovedOverride` を geocode route に接続。承認済みピンを再利用しGoogle呼び出し節約（`reusedCount`）・ADMIN_APPROVED確定座標。
- [x] **D⑤ GSI 無料フォールバック** → **α完了（`2200ca4`）**。Google失敗時に国土地理院(GSI・無料・キー不要・町丁目レベル)へフォールバック。`source="gsi"` で低精度を明示。
- 工数目安：約2〜2.5人月 / 運用費 ¥0（むしろD①でGoogleコスト減）。

**β へ**：着手可否・順序・`ORS_API_KEY` 登録の要否をこの節に1行で返信。**A③の地図描画は α が担当**するので、経路ジオメトリの返却仕様だけ決めて渡してください。優先は **A②（走行距離が実際に減る）** から。

## 🚚 α → β/γ 実装依頼：ドライバー詳細（配達先ピン＋遅配赤マーク）（2026-07-04 riku指示・α調査確定）

> ✅【2026-07-06 完了・α が全実装（riku「全部やって」指示）】β/γ の着手不要。`62cae0d`/`54a3338`/`e0895d1` で origin反映済・本番ビルド緑・**管理者ログインで実レンダリング検証済(200)**。
> - 一覧のドライバー名クリック→`/admin/progress/[driverId]`（`ProgressDriverCard`）
> - 詳細ページに配送先マップ（`DriverRouteMap`＝`LiveVehicleMap`＋geometryの道なりルート・配送順番号ピン）
> - **遅配の前向き予測**（`src/lib/delivery/route-eta.ts`＝残件×所要 vs Wave締切）→ late/atRisk(遅配見込み)/soon をテーブルバッジ・地図ピン(赤/橙)・上部アラートに反映。
> - 課金ゼロ（OSM+Leaflet・純計算）。`waves.ts`/geometry API は read-only 消費のみ＝γ非競合。**β は progress ページ改修不要**。

riku 要望：**管理ページでドライバー名クリック→詳細**を開き、**その号車の配達先住所を地図にピン表示**、さらに**Wave時間帯（配送時刻）までに配りきれなさそうな配達を赤マークで警告**したい。α が現状調査＆自分の担当分（地図の赤マーク）を実装済み。

### ✅ 既に在るもの（再実装不要）
- 配達先ピン＋番号＋道なりルート：`LiveVehicleMap`（routeStops/routePath）＋ `GET /api/routes/geometry?driverId=&date=`（stops返却）＝**動作済み**（/admin/live-map で号車選択時に表示）。
- 遅配判定の単一真実源：`src/lib/waves.ts`（`deliveryTimingStatus()` = ON_TIME/SOON/LATE、Wave時間帯 w1 10-12〜w6 20-22）。
- **【α実装済 `c1c8fd5`】地図の配達先ピンを遅配色分け**：`RouteStop.status`（"late"=赤/"soon"=橙/既定=紺・赤リング＋⚠）。**β は status を渡すだけ**で地図に赤マークが出る。

### 🟦 β（管理画面UI）にお願い＝ドライバー詳細の組み立て
- [ ] **一覧でドライバー名をクリック可能に** → `/admin/progress/[driverId]`（詳細は既存・コミット済）。現状 `/admin/progress/page.tsx` に名前クリック導線が無い。
- [ ] **詳細ページに地図を追加**：`LiveVehicleMap` を置き、`/api/routes/geometry` の `stops` を `routeStops`、`path` を `routePath` に渡す（配達先ピン＋ルート）。地図描画部品は α 提供済みなので **設置＋データ受け渡しだけ**。
- [ ] **遅配の赤マーク（テーブル＋地図）**：**自前計算は不要**。`GET /api/routes/geometry` の各 `stops[]` が **`status`（onTime/soon/late）＋`waveNo` を既に返します**（α `85301a7`）。→ ①テーブル行は `status` で赤/橙バッジ ②`stops` をそのまま `routeStops` に渡せば地図ピンも赤/橙。**β は fetch して渡すだけ**。
- ⚠ **α区画（`LiveVehicleMap.tsx`）は編集不要**（status対応済み）。必要な地図側の追加があれば α受付ボックスへ。

> 📣 **α→β 共有（`85301a7`）**：geometry API が per-stop の `status`＋`waveNo` を供給開始。詳細ページの地図（上記）も遅配赤マークも、**`/api/routes/geometry` を fetch → `stops`→`routeStops` / `path`→`routePath` に渡すだけ**で完成します（計算・地図編集 不要）。

### 🟩 γ（データ）にお願い（任意・βが自前計算でも可）
- [x] `GET /api/routes/geometry` の `stops[]` に **per-stop `status`（waves.ts判定：onTime/soon/late）と `waveNo`** を付与 → **α完了（`85301a7`）**。β はテーブル/地図に**渡すだけ**で遅配の赤/橙表示ができます（`RouteStop.status`/`waveNo`）。
- [ ] 「配りきれなさそう」の**前向き予測**（残未配達件数×平均所要 vs 締切までの残り時間）を出すなら γ ロジック。v1は現在時刻ベースの LATE/SOON で十分（waves.ts）。

**返信**：β は着手可否・順序をこの節 or β節に1行で。α は地図側対応済みなので、追加要望が出たら対応します。

## 📊 α → γ 実装依頼：台数管理表（Excel）の取込＆反映（2026-07-06 riku指示・実行までγに委任）

riku依頼：**デポ美女木の「台数管理表」Excelを読み込んでアプリにデータ反映**。riku が「γに実行まで依頼して」と明言 → **γが設計〜実装〜本番反映まで担当**。以下、α が事前調査した内容を全部渡します。

### 対象ファイル
`~/Downloads/06_表計算/③デポ美女木　台数管理表_トップラン管理者用.xlsx`（riku PC。取り込むにはriku提供 or アプリにアップロード動線が必要）

### シート構造（αが `xlsx`(SheetJS) で解析済み）
- シート：`26年6月` / `26年7月` / `26年8月`（月別）。各シート17行。
- レイアウト：
  - r0: 「M/1～M/末 台数確認表」
  - r1-r2: 日付（Excelシリアル値。**3列で1日**）
  - r3: 各日の見出し **`貼付 | SP | 増車`**（この3列が1日分）
  - r4-r9: 行 **W1〜W6**（waveごと）
  - r10: **合計**行 ／ 店舗名「美女木デポ」
- 現状は概ねテンプレ（値は0/空、右端に少し「1」）。＝日々埋めていく運用と思われる。

### マッピング（riku指定）
- **貼付 → 通常稼働**（1名 = W1〜W6に各+1 ＝ 計6）
- **SP → 無視（いらない）**
- **増車 → フォロー**（＝当アプリの follow 機能に相当）
- **wave終了ごとに加算**（例：1名通常稼働がW1〜W6を消化すると計6）

### αからの申し送り（未確定＝γがrikuと詰めて）
1. **反映先**：管理画面に「日別×wave別 稼働台数」表を出す？ / 消化(完了)台数の進捗？ / 他 → riku要確認
2. **入力元**：Excelを継続的に取込む運用？ / アプリ内入力にする？
3. **加算の意味**：予定台数の表示か、wave完了に応じた消化台数か

### 使える既存IF（αが提供済み・「wave完了で加算」に直結）
- **`GET /api/external/crew-reports?date=`**（Bearer `EXTRA_VEHICLE_PULL_TOKEN`）：ドライバー×当日で **各waveの完了(allDone/waveDoneAt)・件数・エリア・倉庫到着・業務終了** を返す。「wave終了で加算」はこれをそのまま使える。
- follow機能（増車=フォロー）：`deliveryFollow` / `/api/driver/follow` 系。
- Excel取込は `xlsx` パッケージ導入済み（`sheet_to_json({header:1})` で上記グリッドが読める）。

**γへ**：この節を起点に、refl先をrikuと確定 → 実装 → 本番反映までお願いします。完了/質問はこの節に追記を。

**✅ γ完了（2026-07-06・`6b9a3bf`）**：rikuと確定＝**「wave完了に応じた消化進捗（完了台数/予定台数）を実績から自動集計」**（Excel継続取込やアプリ内手入力ではなく、assignment/follow実績から自動）。
- 実装：`src/lib/kpi/vehicle-count.ts`（集計）／`GET /api/admin/vehicle-count?date=`（read-only）／`/admin/vehicle-count` ページ（日別・**30秒自動更新**・wave別 完了/予定・消化率バー・増車=フォロー列）。
- マッピング反映：**貼付=通常稼働（wave割当ありドライバー=予定台数）／SP=無視／増車=フォロー**。waveを消化(全明細terminal)したクルーを完了台数に加算。
- typecheck(自ファイル)/lint緑・CI通過・本番デプロイ済み。Excelファイル自体の取込は不要になった（実績自動集計のため）。
- **α宛（nav）**：`/admin/vehicle-count` への導線を `AdminShell`(α区画) に1件追加 → **✅完了（α, `af9334e`）**。「配車」グループに「台数管理」を追加・build緑・origin反映済。

## 📥 α 受付ボックス（他ターミナル → α 依頼）

β/γ が α に依頼したいことは**この節に1行追記**してください。α は稼働時にここを確認し、**依頼を実行**します。

- 記法: `- [ ] (YYYY-MM-DD 依頼元→α) 内容 / 対象パス`。完了時は α が `[x]` にし結果を追記。
- α の適用方針: 通常のα領域（レイアウト/地図/API契約/セキュリティ監視データ）は実行。**セキュリティのコード修復（対策）は人間の明示指示がある時のみ**（既定は監視・レポートのみ）。DB・既存データは変更しない。commit はパス明示のみ。

**処理済み**:
- [x] (2026-07-03 γ→α) GPS機能一式をパス明示コミット → **完了**。`e98351e` で DriverLocation モデル＋migration `20260703170000`＋live-map/tracker/API/privacy を commit、origin/main に反映済（`prisma migrate deploy` で本番テーブル作成＝GPS系API 500 リスク解消）。ビルド✅。※共有index並行操作で manifest.ts/ブランドロゴ/preview+1行 を巻き込み（追加のみ・無害）。next.config CSP とセキュリティ修正は方針どおり未コミット保留。

**現在の依頼（未処理）**:
- [x] **(2026-07-06 β→α｜riku指示) 号車ピンのラベルは「ドライバー名」表示で確定** → **完了確認（α, `23b9ad9`）**。`label: l.name || l.vehicle`（ドライバー名）＝β反映済でそのまま確定。**色分け(`colorForDriver`)・吹き出し型ピン(`LiveVehicleMap.pinIcon` 下向きポインター)は維持**（両取り達成）。号車番号は `popupHtml`（`<b>${l.vehicle}</b> ${l.name}`）に保持。号車リストの色ドットもドライバー色に統一済。→ αの「号車のみコンパクト」案は撤回済（名前表示で確定）。本番反映済。
- [x] **(2026-07-04 γ→α｜riku指示) カメラ/PDFのOCR精度を改善して** → **解決済（α・Gemini採用。下の「✅α返信」参照）**。前提：**バーコード案は撤回**（中身は楽天内部の10桁管理番号＋商品GTINのみ＝住所なし・照合先は楽天DBでアクセス不可・自伝票Noとも別物＝実利ゼロ。詳細は下の「📷バーコード…撤回」節）。なので**バーコードに頼らず王道で精度を上げる**：
  1. **前処理強化（今すぐ・OCR.space方針のまま可）**：傾き補正(deskew)・書類の縁検出/自動クロップ・二値化・影除去・高解像度化。既存の `src/lib/ocr/image-preprocess.ts`/`image-quality.ts` の延長。→ OCR.spaceに“きれいな画像”を渡して精度↑。**PROJECT_STATUSの「未実装：傾き補正/縁クロップ/二値化」がこれ**。
  2. **無料エンジン＝PaddleOCR自己ホスト（riku GO済 2026-07-04）**：γが**実配車表画像でベンチ実施済み**。結果:

     | エンジン | 平均信頼度 | 電話番号検出 | 検出セル数 |
     |---|---|---|---|
     | Tesseract(全ページ) | **21〜24%** ❌ | 0件 | 〜38行(崩れ) |
     | **PaddleOCR(検出+認識)** | **87〜90%** ✅ | 10〜11件 ✅ | 488〜502セル |

     → **PaddleOCR(完全無料・自己ホスト)は実データの密な表を高精度で読める**（Tesseractは全ページ投入だと表に弱い）。**推論は無料**、学習不要。
     - **α/OCR担当への改善依頼**：**PaddleOCR を精度改善の本線に採用**。実装方針:
       - **Python推論が必要** → (a) Vercel の Python Function(Fluid Compute) or (b) 別Pythonマイクロサービスを Next から呼ぶ。`PaddleOCR(lang="japan").predict(img)`。
       - **既存のセル切り出しパイプライン(`src/lib/ocr/*` grid/table/cell)にPaddleを噛ませる**とさらに精度↑（今回は全ページ一括でこの数字）。
       - **OCR.space はフォールバック/移行期に併存**（`CLAUDE.md`「OCR.spaceのみ」方針は riku GO済で見直し可）。
     - **①前処理強化は今すぐ着手可**（deskew/クロップ/二値化）＝PaddleでもOCR.spaceでも効く土台。**まず①→次②**推奨。
  - **γ支援**：正解セットでの **PaddleOCR vs OCR.space 精度%確定ベンチ**（要:正解セット/実画像 or OCR.spaceキー）、推論サービスの叩き口設計、前処理検証を γ が担当可。要望はこの節へ。
  - 着手可否・順序をこの節に1行返信して。
  - **✅ α返信（2026-07-06・riku承認済の後続方針で解決）**：**カメラOCRは Gemini(画像AI/無料枠) 採用で解決済み・本番稼働中**（riku承認 `feedback_gemini_camera_ocr`）。実写真(横向きIMG_7705)で **配車No/伝票/電話/住所/数量すべて正解**（OCR.spaceで散乱していた写真がGeminiで満点）。`src/lib/ocr/gemini.ts`＋`camera/process`(Gemini優先→OCR.spaceフォールバック)、モデル`gemini-flash-latest`、`GEMINI_API_KEY`本番登録済。**PDF/スキャンは従来OCR.space=満点**（ハイブリッド）。
    - **①前処理強化(deskew/縁クロップ/二値化)**：α が実写真で検証済 → **効果頭打ち**（横向き＋密表はOCR.spaceの読み順が崩れ、二値化/CLAHE/回転でも改善せず）。**Geminiで根本解決したため前処理強化・PaddleOCR自己ホストは不要**（Python Function等の追加インフラ回避）。四隅補正ステップも撤去済（Geminiは斜め/横向きOK）。
    - → **本件クローズ提案**。PaddleOCRベンチ提供ありがとう。もしPDFで読めない帳票が出たら都度対応。異論あれば戻してください。
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

## 🕒 配達時間帯（Wave/便）と遅配定義 — riku提供【重要・全ターミナル共通】（2026-07-09 更新）

各 Wave（便）に配達時間帯があり、**終了時刻を過ぎて配達すると「遅配（遅延）」扱い**になる（業務用語=遅配）。

> ⚠️ **2026-07-09 更新（riku提供・α反映 `12e453a`）**：**W5 の開始を 19:00 → 18:00 に修正**（終了20:00は不変＝遅配判定に影響なし）。**積み込み時間 08:30〜09:00 を追加**（`LOADING_WINDOW`）。値は下表＝`src/lib/waves.ts` が最新・正典。

| Wave | 時間帯（JST） | 終了＝遅配ライン |
|---|---|---|
| 積み込み | 08:30〜09:00 | （配達Waveではない・作業枠） |
| w1 | 10:00〜12:00 | 12:00 超で遅配 |
| w2 | 12:00〜14:00 | 14:00 超で遅配 |
| w3 | 14:00〜16:00 | 16:00 超で遅配 |
| w4 | 16:00〜18:00 | 18:00 超で遅配 |
| w5 | **18:00**〜20:00 | 20:00 超で遅配 |
| w6 | 20:00〜22:00 | 22:00 超で遅配 |

- **単一の真実源＝`src/lib/waves.ts`**（γ作成・α更新）。`WAVE_WINDOWS` / `LOADING_WINDOW` / `isLate(waveNo, at?)` / `deliveryTimingStatus()`(ON_TIME/SOON/LATE) / `minutesToDeadline()` / `parseWaveNo()`。**値をハードコードせず必ず import して使う**（全体で判定を統一するため）。import して使っていれば**再取り込み(git pull)だけで自動反映**（各担当のコード修正不要）。
- 表記ゆれ（`w6`/`6w`/`6`/`6便`）は `parseWaveNo` が吸収。判定は **JST基準**。
- **各担当への反映依頼**：
  - **(β/進捗UI)** ドライバー画面・進捗・ダッシュボードに「遅配バッジ／締切カウントダウン／遅配件数集計」。`deliveryTimingStatus()` を使えば色分け(余裕/締切間近/遅配)が即出せる。
  - **(OCR/配車)** waveNo を持つ明細に締切概念を付与。ルート順の目安にも活用可。
  - **(γ)** 本モジュール提供済み。要望あれば「遅配集計API」等を追加する。

## 📷 バーコード直接デコード → ❌ **撤回・不採用**（riku判断 2026-07-04）

> **結論：やらない。** バーコードの中身は **10桁の楽天内部管理番号（`2606085017`型）＋商品GTIN のみで、住所・顧客情報は入っていない**。しかもその番号→住所の照合は**楽天側DBが必要で我々はアクセス不可**（CARIO APIにも受注明細住所は無い）。さらにその番号は**我々の伝票Noとも別物**で自アプリ内の検証にも使えない。→ 実利なしと判断し**撤回**。
> **α へ：配線しないでください（不要）。** γ側の実装（`src/lib/ocr/barcode.ts`＋`zxing-wasm`依存）は**削除済み**（typecheck緑）。以下は経緯記録として残す。

### γの調査結果（実データでデコード確定）
riku の Downloads の実ファイルを無料デコーダ(zxing)で実測:
- **配車表左上の管理番号バーコード = `Code128`・「26始まり10桁」**（例 `2606085017`）。**住所は入っていない＝数値キー**。
- 商品オリコンのバーコードは `GS1 DataBar`・GTIN（商品コード）＝住所ではない。
- → α の既存 `l1m-metadata-extractor.ts` の `barcodeText` 正規表現 `26\d{8}` と**完全一致**。現状は「印字数字をOCR」で誤読リスクあり。

### γ の成果物（実装・検証・commit済 `f931975`）
- `src/lib/ocr/barcode.ts`（`zxing-wasm`＝無料・ローカル・**非AI**）:
  - `decodeBarcodes(buffer)` … 全体＋左上クロップで Code128/QR/DataMatrix/GS1 をデコード
  - `decodeL1MBarcode(buffer)` … 左上管理番号を返す（26始まり10桁優先）
  - **実データ検証済**：IMG_7677 → `2606085017` を正確取得（印字OCRより確実）

### α への配線依頼（OCRパイプラインはαレーン）＝ここをお願い
画像バッファがある地点で `decodeL1MBarcode()` を呼び、`barcodeText` を**確定値**にする（印字OCRより優先）:
1. `src/lib/ocr/index.ts runOcr()`：`rawBuffer` 取得後に `const bc = await decodeL1MBarcode(rawBuffer)` → 取れたら metadata/結果へ確定値としてセット。
2. `camera/process/route.ts`・`pdf/route.ts`：同様に画像から decode → `barcodeText` 上書き（カメラ/PDF精度改善の本命）。
3. 予測値システムで `barcodeText` を **source=BARCODE / 高信頼** 扱いに（OCR推定値と区別）。
4. ⚠️ **Vercel(Node serverless)での zxing wasm 読込は要デプロイ検証**。失敗時は `setZXingModuleOverrides` で wasm パス指定 or 関数同梱で対応。

### 進め方
γ は decoder 完了。**α が配線** → barcodeText 確定値化で完了。**αとγ独立並行で完了まで**。質問/要望はこの節 or α受付ボックスへ。

## 🚀 改善・追加バックログ（riku「全部やる」2026-07-04・γ集約）

γが全体調査して抽出した改善/追加。**各担当は自分の項目を進めて `[x]`＋結果1行を追記**。進行中の別件（OCR精度=PaddleOCR / ルート=ORS / 住所=D / セキュリティページ）とは別枠。

| # | 項目 | 担当 | 優先 | 状態 |
|---|---|---|---|---|
| 3 | **CI（型/lint/test自動チェック）** ビルド破壊の再発防止 | **γ** | ★高 | ✅ **完了**（`.github/workflows/ci.yml`・`60b0463`。push/PRで typecheck/lint/test） |
| 1 | **遅配のリアルタイム活用＆通知**：締切カウントダウン/遅配バッジ/遅配リスト＋Wave締切間近のLINE通知 | β(UI)＋γ(API済)＋LINE担当(通知) | ★高 | 🟡 基盤済(`waves.ts`/`/api/delivery-timing/summary`)・**UI/通知未接続** |
| 2 | **配達完了時刻 `completedAt` 記録**（遅配の実績計測・KPI化） | schema/OCR or β | ★高 | ⬜ schema追加（生成client差分に注意＝ツリー安定時に） |
| 4 | **KPIダッシュボード**（遅配率/完了率/ドライバー別/OCR精度推移） | β(UI)＋γ(API済) | 中 | 🟡 **γがKPI集計API提供済**（`GET /api/admin/kpi/summary?date=`・`df8bdc0`）。β はUI描画のみ |
| 5 | **不在→再配達フロー**（ABSENT/RETURNED の再配達導線） | β | 中 | ⬜ |
| 6 | **通知全般**（新規割当・シフト変更・不在）LINE基盤(`lib/line/send.ts`)活用 | LINE担当 | 中 | ⬜ |
| 7 | **ドライバーPWA/オフライン**（電波断でもtodayルート閲覧＋更新キュー） | β | 中 | ⬜ PWA土台あり |
| 8 | **カメラ画像のクライアント圧縮**（アップ前圧縮で高速化・通信量減） | OCR担当 | 低 | ⬜ |
| 9 | **締切考慮の割当最適化**（auto-assign＋waves＋routeで「Wave締切を守る割当」） | β(配車)＋γ(waves/CARIO支援) | 中 | ⬜ |

**γが自走で担える支援**：①遅配の集計/ドライバー向けtiming API、④KPI集計API、⑨割当への遅配締切データ供給。UI描画・配車ロジック本体はβ、通知はLINE担当、画像処理はOCR担当。**各担当は上表の自分の行から着手を**。

## 📨 LINE 増便申請グループ 本番設定完了（γ 2026-07-04）
- 公式アカウント「**CARIO【楽天】**」(@753kuddz) の**増便申請専用グループ**を本番送信先に設定。
- **本番 `LINE_EXTRA_VEHICLE_GROUP_ID` = `C79793f47e7bb25ec3d58064ee7200ccb`**（redeploy反映済み）。旧Webhook URL（死んだtrycloudflareトンネル）を本番`/api/line/webhook`へ修正→疎通OK・ボットのID返信で取得。
- 送信導線 `POST /api/admin/extra-vehicle-requests/[id]/line-send` → このグループへ投稿→`carioSyncStatus=sent`。**増便担当**：承認時自動送信にするか手動ボタンのままかは設計次第。テストは相手(CARIO)本番グループのため文面注意 or `LINE_TEST_GROUP_ID` 利用を。

## 🧰 機能依頼：増便理由の Gemini バリエーション生成（riku指示 2026-07-04）＝増便担当＋OCR(Gemini)＋γ

riku 要望：増便申請フォームの「増便理由」を**Geminiで毎回バリエーション豊かに生成**（プリセットも混ぜつつ、毎回違うパターン）。将来は配達進捗/遅配などの**実データから原因を拾って理由に反映**（＝下記【案・保留】）。

**現状**：`src/lib/extra-vehicle/reason-templates.ts` の `waveReasonVariants(wave, areas)` が固定バリアント生成、`/api/extra-vehicle-requests/wave-areas` が市区町村(PII配慮)を供給、フォームはプリセットボタン＋編集可textarea。Geminiは `src/lib/ocr/gemini.ts` に `extractL1MWithGemini`/`isGeminiConfigured` あり（理由生成には未使用）。

**依頼（今すぐ・増便担当＋OCR）**：
1. **Gemini理由生成を追加**：`waveReasonVariants` にGemini生成分をミックス（プリセット＋AI・**毎回違う文面**・同種も混ぜる）。`src/lib/ocr/gemini.ts` に `generateExtraVehicleReasons(ctx)` を足す or 増便側から呼ぶ。
2. **文脈**：wave / areas(市区町村) / depot。**GEMINI_API_KEY 前提**（未設定時はプリセットにフォールバック＝壊れない）。
3. UIは「別パターン再生成」ボタンで引き直せると良い（毎回変える要望に合致）。

**γ提供（文脈強化・任意で今使える）**：`GET /api/delivery-timing/summary?date=` / `GET /api/admin/kpi/summary?date=` を Gemini に渡せば、**その日の遅配・進捗・未配・wave別状況に即した理由**が出せる。

**📌【案・保留】データ駆動の増便理由自動生成**（riku「案として置いといて」）：
配達進捗が取れ次第、**遅配・進捗・未配・号車遅れ等の実データから「増便が必要そうな原因」をGeminiに逐一拾わせ、理由に自動反映**。→ γが「**原因シグナル集約API**」（date/wave/depotの遅配・進捗・未配・締切超過等を返す）を用意 → Geminiが理由文化。**着手時期はriku判断（今は保留）**。γは要請あれば即コンテキストAPIを実装。

**※Gemini前提**：CLAUDE.md「Gemini禁止」方針と矛盾。riku が Gemini採用を指示中（無料枠）＝**方針更新前提**で進める（別途 riku が方針確定→CLAUDE.md更新を推奨）。

## 🚚 当日の号車配置（VehicleRoster）＝γ実装・自動割当のベース（2026-07-06 riku指示）

riku運用：**号車→ドライバーは日替わり**（今日1号車=牧田、翌日牧田休みなら1号車=飯田…シフトで変わる）。号車は**1〜4＋今後増える**（固定しない）。→ 自動割当のベースに使う「当日号車配置」をγが実装。

**γ実装済み・本番反映済み（`6625da9`/`97fa050`・migration適用確認済）**:
- `VehicleRoster` テーブル（`work_date`×`vehicle_no` unique・driverId文字列・**純粋additive/既存非編集**。Prisma生成のドリフト補正は本番破壊回避のため除去済み）。
- `GET/PUT /api/admin/vehicle-roster?date=`（当日の号車→ドライバー取得/保存・シフト候補も返す）。
- `/admin/vehicle-roster` ページ（日付・号車ごとにドライバー選択・行追加で号車増設・**候補のvehicleId(号車)から自動プリフィル**）。
- 補足：現状 `driver.vehicleId` は既に「1号車/2号車…」を持つ（2026-07-06 実データで 牧田=1号車/片野=2号車/吉元=4号車 を確認）。号車体系はデポの1〜4で揃ってきている。

**→ β へ依頼（配車レーン）**：
1. **自動割当のベースに VehicleRoster を使用**：`autoAssign` が「その号車の担当ドライバー」を VehicleRoster(当日) から引いて、明細を号車→担当に割当。過去実績スコア（エリア→号車）を足すなら γ がスコアAPIを追加可。
2. **nav リンク**：`/admin/vehicle-roster` と `/admin/vehicle-count` を AdminShell(α区画) に追加（αへ）。

## 📄 CARIO連携 仕様書兼依頼書（PDF）作成・共有（γ 2026-07-09）

CARIOへ渡す**連携仕様書 兼 依頼書**を作成（両方向・全エンドポイント・データ契約・チェックリスト）。riku PC の `~/Desktop/CARIO連携_仕様書兼依頼書.pdf`（3ページ）＋ソース `CARIO連携_仕様書.html`。内容の要点（フリート共有）:
- **受信**（当アプリ→CARIO・稼働中）：`/sites`,`/drivers`,`/shift-requests`,`/assignments`（Bearer `RAKUTEN_APP_API_KEY`）。CARIO確認事項＝shift-requests投入/号車体系(12-16↔デポ1-4)/勤務時間・wave付与/キー継続。
- **送信**（CARIOがpull→公式LINE投稿）：`GET /api/external/crew-reports?date=`（着車`warehouseArrivalAt`/各便`waves[].waveDoneAt`(NW終了)/`finishedAt`業務終了・Bearer `EXTRA_VEHICLE_PULL_TOKEN`）。依頼＝定期pull＋LINE投稿の有効化・間隔/フォーマット。
- **増便申請**：(A)LINE増便グループ受領 / (B)`GET /api/external/extra-vehicle-requests`＋`/ack` pull のどちらか選択。
- 実装は稼働・本番トークン設定済み。**CARIO側の運用有効化＋数点の仕様確認が残**（詳細はPDF/`docs/cario-integration.md`）。
- ※関連の当アプリ実装は γ 担当（`api/external/*` の crew-reports/extra-vehicle は増便/LINE担当実装、CARIO受信は γ）。
- ✅ **2026-07-09：PDFはrikuがCARIOへ送付済み**。ボールはCARIO側（pull→LINE投稿の有効化・増便受領方式・各確認）。
- ✅ **2026-07-09：CARIO側 実装完了**。`EXTRA_VEHICLE_PULL_TOKEN` の実値をrikuがCARIOへ共有（当アプリ本番で有効・疎通200確認済み／ローテート不要）。CARIOが自Vercelにトークン設定→pull開始で**送信連携が有効化フェーズ**へ。次はCARIOがcrew-reports/extra-vehicle-requestsを叩き始めたら実データ疎通を確認。
- 🟡 **PDF未記載の追加確認（rikuが口頭でCARIOへ）**：**crew-reports連携後、ドライバーのCARIO側「出退勤・終了連絡」は不要（当アプリ一本化）か／併用か。出退勤が勤怠・給与用途の場合の扱い。** ← 二重報告回避のため運用を握る。CARIO返答待ち。

### ✅ 2026-07-09：CARIO 6項目 回答受領（ボールの整理）
| # | 項目 | CARIO側 | 結論/次アクション |
|---|---|---|---|
| 1 | crew-reports pull→LINE投稿 | ✅ 実装済（`rakuten-crew-pull` cron・5分毎）。トークン設定済なら稼働 | ✅ **稼働**（当アプリ側 疎通200・構造正常。トークン共有済＝有効化済み）。ドライバー報告が入り次第データが流れる |
| 2 | 増便受領方式 | ✅ **API pull方式で実装**（CARIO `/manager/rakuten-requests`画面） | ✅ 当アプリ `GET /api/external/extra-vehicle-requests`（実データ2件返却確認）をCARIOがpull。→ **LINE増便グループ投稿は冗長（当面は保険/内部用。停止も可）** |
| 3 | 号車番号体系（12〜16↔1〜4） | 🟡 terminal_no→course_no変換のマッピング未確定 | 🔵 **riku判断待ち**（下記Q1） |
| 4 | shift-requests投入 / wave・時間付与 | 🟡 技術的に可能・仕様待ち | 🔵 **riku判断待ち**（下記Q3） |
| 5 | RAKUTEN_APP_API_KEY 継続 | ✅ Vercel env にある限り有効（期限なし） | ✅ 解決 |
| 6 | 出退勤・終了連絡 一本化/併用 | 🟡 代表の運用方針判断が必要 | 🔵 **riku（代表）判断待ち**（下記Q2） |

**→ riku（代表）が決める3点（決まり次第CARIOへ回答）**：
- **Q1 号車マッピング**：デポ号車は当アプリ「当日号車配置(VehicleRoster)」で**日次・ドライバー単位**に割当（riku指示：号車はシフトで変動）。→ 推奨=**固定番号マッピングはしない／突合はドライバーで**。CARIOはterminal_no/連番のままでOK。
- **Q2 出退勤一本化**：crew-reports は着車(warehouseArrivalAt)・業務終了(finishedAt)を返す→CARIOが勤怠として利用可。推奨=**楽天アプリに一本化**（ドライバーの二重報告回避）。ただし勤怠/給与の実運用は代表判断。
- **Q3 shift-requests投入**：現状=CARIOクルーアプリでシフト提出→楽天アプリが読む一方通行。推奨=**現状維持（投入不要）**。

**✅ 2026-07-09 riku（代表）決定**：
- **Q1 → 固定マッピングしない／ドライバーで突合**。CARIOはterminal_no/連番のままでOK。デポ号車は当アプリ「当日号車配置」で日次・ドライバー単位に割当。
- **Q2 → 併用**（CARIO出退勤は継続＝勤怠用／crew-reportsはLINE通知用。役割が別なので二重ではなく併存）。
- **Q3 → 現状維持・投入不要**（CARIO→楽天の一方通行のまま）。
- 補足：#4のうち **assignments への wave・勤務時間 付与**は「あれば配車精度向上・現状は必須でない」→ 将来仕様を詰める（今回は保留）。
- → **6項目すべてriku側の判断完了。CARIOへ回答送付するのみ**（送信連携は稼働中）。

### 📌 γ 保留タスク（riku依頼・2026-07-11）：アプリ仕様書PDF
- **依頼**：**α の開発完了後**に、このアプリの「分かりやすい仕様書PDF」を作成。
  - タイトル＝**「楽天マート配送アプリ仕様書」**／出力先＝**デスクトップ**。
- **発火条件**：α の開発が完了したら（＝rikuが「αは終わった」と合図 or 本ファイルにα完了記載）。→ それまで着手しない。
- 状態：🟡 **α完了待ち**（未着手）。

## 運用上の注意（共有事項）

- **共有作業ツリー**のため `git commit -am` / `git add -A` は他ターミナルの中途変更・削除を巻き込む。**パス明示コミット**を徹底（過去に実際に巻き込み事故あり）。
- `DATABASE_URL` はVercel Sensitiveで `vercel env pull` では空。ローカルからの本番DB直書き不可。
- CARIOサーバー同期は cron-job.org(1分・主)＋GitHub Actions(5分・GitHub都合で間引き・予備)＋Vercel Cron(日次・予備)。
- **許可ポリシー（2026-07-03 γ設定 / α要レビュー）**: `.claude/settings.json` に `permissions` を追加し Yes/No確認を削減。`defaultMode: acceptEdits`＋git/npm/node/read系等の安全コマンドを allow、破壊系（`rm -rf /*`・`git push --force`・`prisma migrate reset`・`prisma db push --force-reset`）は deny 維持。全ターミナル共通・**Claude 再起動で反映**。強/弱の調整は α/ユーザー判断で可。
