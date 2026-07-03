# 引き継ぎ仕様書：管理者レイアウト刷新 ＋ 号車GPSリアルタイム地図

- 作成: α（レイアウト担当）／ 宛先: **β（管理画面担当）**
- 日付: 2026-07-03
- 目的: 本レイアウトと GPS 機能を**正式仕様として確定**し、β が本番の管理者ページへ反映（統合）する作業を開始できるようにする。
- 大前提: **完全無料・課金ゼロ**（ユーザー厳命）。地図に Google Maps 有料APIは使わない。

---

## 0. まず動かして見る（確認URL）

| URL | 認証 | 内容 |
|---|---|---|
| `/admin-preview` | 不要 | **レイアウトの正式サンプル**（Amazon Logistics 風・美女木デポ仕様・サンプルデータ）。一覧クリックで地図追従 |
| `/admin/live-map` | 管理者 | **本番の号車GPSリアルタイム地図**（30秒ポーリング・実データ） |

dev は **:3001** が本コード（:3000は別インスタンスで404）。

---

## 1. α が実装済みのファイル（β は原則触らない＝競合回避）

| ファイル | 役割 |
|---|---|
| `src/app/admin-preview/` | レイアウト正式サンプル（認証不要・本番非影響） |
| `src/app/admin/live-map/page.tsx` + `LiveMapClient.tsx` | 本番ライブ地図（認証付き・30秒ポーリング） |
| `src/components/map/LiveVehicleMap.tsx` | **共有地図コンポーネント**（OSM+Leaflet・再描画・追従・サテライト） |
| `src/components/driver/DriverLocationTracker.tsx` | ドライバーGPS取得（不可視・12秒間引き） |
| `src/app/api/driver/location/route.ts` | 位置受信 API（driver認証） |
| `src/app/api/admin/driver-locations/route.ts` | 現在地一覧 API（admin認証） |
| `public/vendor/leaflet/` | Leaflet 自己ホスト（CSP `script-src 'self'` 対応） |
| `prisma/schema.prisma` | `DriverLocation` モデル**末尾に追記**（既存モデル非編集） |
| `prisma/migrations/20260703170000_add_driver_locations/` | テーブル定義（**ローカルのみ適用済**） |
| `src/app/driver/layout.tsx` | `DriverLocationTracker` をマウント（+数行） |

品質: `typecheck` / `lint` / `build` すべて ✅、ローカル migration 適用済、認証ガード疎通済（未認証=401/307）。

---

## 2. なぜこの地図構成か（設計判断・変更しないでほしい理由）

- **Google Maps JS API は不採用**：無料枠はあるが請求先カード必須＋超過課金リスク → 「課金ゼロ」を保証できない。
- **採用：OpenStreetMap + Leaflet**（表示）＋ Esri World Imagery（サテライト）。**アカウント/カード/APIキーすべて不要・恒久無料**。
- **Leaflet は自己ホスト**（`public/vendor/leaflet/`）。理由：`next.config.ts` のCSPが `script-src 'self'` のため CDN 読込は弾かれる。タイル画像は `img-src https:` で許可され表示可。
- **ナビ（1件ディープリンク）と住所補正（Geocoding）は従来どおり Google を継続**。表示タイルだけ OSM。

---

## 3. API 契約（β が実データを流す際の参照）

### POST `/api/driver/location`（driver 認証）
リクエスト（ドライバー端末が送信）:
```json
{ "lat": 35.83, "lng": 139.65, "accuracy": 12.5, "heading": 90, "speed": 4.2, "recordedAt": "2026-07-03T09:34:00.000Z" }
```
- lat/lng 必須・範囲チェックあり。それ以外は任意。
- `DriverLocation` を driverId で **upsert**（1人1行・履歴なし）。
- 位置情報（緯度経度）は個人情報のため **console.log しない**。

### GET `/api/admin/driver-locations`（admin 認証）
レスポンス:
```json
{
  "locations": [
    { "driverId": "...", "name": "田中 太郎", "vehicle": "3号車", "company": "田中運輸",
      "area": "埼玉北", "lat": 35.83, "lng": 139.65, "accuracy": 12.5,
      "heading": 90, "speed": 4.2, "recordedAt": "...", "staleSec": 8 }
  ],
  "serverTime": "..."
}
```
- `staleSec` = 何秒前の位置か。`LiveMapClient` は 90 秒超で「位置情報 古い」（グレー・半透明）表示。

### DB モデル
```prisma
model DriverLocation {
  driverId   String   @id @map("driver_id") // Driver.id（relation は張らない＝既存Driver非編集）
  lat        Float
  lng        Float
  accuracy   Float?
  heading    Float?
  speed      Float?
  recordedAt DateTime @map("recorded_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  @@map("driver_locations")
}
```

---

## 4. β にお願いしたい「反映作業」チェックリスト

### (A) 導線追加（β の担当領域＝Sidebar）
- [ ] `src/components/admin/Sidebar.tsx` に **「号車リアルタイム地図」→ `/admin/live-map`** のリンクを追加。
  （α は Sidebar.tsx が編集中(`M`)のため触れていない。項目名・アイコンは β 裁量で。）

### (B) レイアウトの本採用（要方針決定）
`/admin-preview` は「形」の確定サンプル。本番 `/admin/dashboard` をこの形に寄せるか、部品だけ流用するかを決めてほしい。実データの割当先（下記マッピング参照）:

| UIブロック | 実データ候補 |
|---|---|
| メトリクス「号車」合計/遅延/未サインイン/稼働中 | `assignments` / `Shift` / `DriverDayReport` |
| メトリクス「クルー稼働状況」 | ログイン/位置更新状況（`DriverLocation.updatedAt`） |
| メトリクス「実行の進行状況」ドーナツ | `assignments.status`（完了率）・Wave進捗 |
| メトリクス「荷物ステータス」不在/持ち戻り/未着手 | `DeliveryItem` / `assignments.status` |
| 「持ち戻り・返品」 | 返品/不在の集計元（要定義） |
| 左の号車一覧の1行 | 号車 × ドライバー × Wave × 進捗（`assignments`集計） |
| 号車ステータス色 | 完了=teal / 配送中=blue / 遅延・不在=amber / 未出発=red |

- [ ] 上記マッピングで各メトリクスの集計クエリを実装（α はサンプル値のみ）。
- [ ] 地図の号車ピンに「配送ステータス色」を反映したい場合、`/api/admin/driver-locations` に status を足す（α に依頼 or β 実装。契約変更は本書を更新）。

### (C) 本番DB migration ＋ デプロイ（**γ と要調整・最重要**）
- [ ] `20260703170000_add_driver_locations` を**本番DBへ適用**（`prisma migrate deploy`／デプロイパイプライン）。
  - 本番DBは Sensitive で pull 不可・3ターミナル共有のため、**α 単独では適用していない**。適用タイミングを γ と合わせること。
- [ ] デプロイ後、ドライバー実機（HTTPS必須・Vercel本番はOK）で位置送信 → `/admin/live-map` に反映されるか確認。

### (D) プライバシー（既に driver/layout にポリシーリンク追加済）
- GPS は個人情報。**取得はブラウザ権限プロンプトで同意**、**ログ出力しない**、**現在地のみ保持（履歴なし）** の方針を維持。
- [ ] プライバシーポリシー本文（`/privacy`・`docs/PRIVACY_POLICY.md`）に「位置情報の取得・利用目的（配車管理）・保持方針」を記載（β/法務レビュー）。

---

## 5. 競合ルール（重要）

- **α の区画（§1のファイル）は β は編集しない**。変更要望は本書 or PROJECT_STATUS 経由で α に依頼。
- **β の区画（Sidebar・既存 admin ページ・メトリクス集計）は α は編集しない**。
- `prisma/schema.prisma` は共有。追記は**末尾に**・既存モデルは編集しない（マイグレ競合回避）。
- `PROJECT_STATUS.md` への記録は**末尾追記**で。

---

## 6. 未決・要相談

- レイアウト本採用の可否（§4-B）
- ピン色に配送ステータスを載せるか（API契約変更の要否）
- 本番 migration/deploy の実施主体とタイミング（γ 調整）
