# 楽天スーパー配送アプリ

配車表OCR取込・CARIOシフト連携・自動割当 Web アプリ（MVP）

---

## プロジェクト概要

専用配送サイト上の「L1M貨物一覧表／配車予定表」画像を OCR で読み取り、
CARIO から取得したシフトデータと突合して、稼働ドライバーへ配送先を割り当てるシステム。

- **CARIO は改修しない**。シフトデータのみ取得元として使用。
- ドライバーは Web アプリで自分の配送先を確認し、Google マップでナビを起動できる。

---

## 技術スタック

| レイヤー | 技術 | バージョン |
|---|---|---|
| フレームワーク | Next.js App Router | 16.x |
| 言語 | TypeScript | 5.x |
| スタイリング | Tailwind CSS + shadcn/ui | v4 |
| ORM | Prisma + @prisma/adapter-pg | 7.x |
| DB | PostgreSQL | 16 |
| 認証 | NextAuth.js v5 / Credentials + JWT | beta |
| OCR | OCR.space（1画像1回・Gemini/AI/Cloud Vision 不使用） | — |
| 地図 | Google Maps Geocoding API + Maps URL | — |

---

## セットアップ手順

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数設定

`.env.example` をコピーして `.env.local` を作成し、各値を設定します。

```bash
cp .env.example .env.local
```

必須の環境変数：

| 変数 | 説明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 接続 URL |
| `NEXTAUTH_SECRET` | JWT 署名用シークレット（32文字以上推奨） |
| `NEXTAUTH_URL` | アプリの URL（例: http://localhost:3000） |
| `OCR_SPACE_API_KEY` | **⚠️ 本番必須**（未設定で OCR 実行不可・デモキー fallback 禁止）/ 開発はデモキー可 |
| `GOOGLE_MAPS_API_KEY` | 住所 Geocoding 用（STEP 7 以降必須） |

NEXTAUTH_SECRET の生成例：
```bash
openssl rand -base64 32
```

### 3. Docker で PostgreSQL を起動

```bash
docker compose up -d
```

### 4. DB マイグレーション

```bash
npm run db:migrate
# プロンプトが出たら migration 名を入力（例: init）
```

### 5. 初期データ投入（seed）

```bash
npm run db:seed
```

作成されるアカウント：

| 種別 | メール | パスワード |
|---|---|---|
| 管理者 | admin@delivery-app.local | ******** |
| ドライバー① | tanaka@delivery-app.local | ******** |
| ドライバー② | sato@delivery-app.local | ******** |
| ドライバー③ | suzuki@delivery-app.local | ******** |

> **本番環境ではパスワードを必ず変更してください。**

### 6. 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` でアクセスできます。

---

## 確認 URL 一覧

### 管理者画面（ADMIN でログイン）

| URL | 機能 |
|---|---|
| `/admin/dashboard` | ダッシュボード（本日の集計） |
| `/admin/dispatch-images` | 配車表画像取込・OCR実行 |
| `/admin/ocr-review/[id]` | OCR確認・修正・確定 |
| `/admin/shifts` | CARIOシフト取込 |
| `/admin/assignments` | 配送先割当（半自動・手動） |
| `/admin/routes` | ルート作成・Geocoding・Maps URL生成 |
| `/admin/progress` | 配送進捗確認 |

### ドライバー画面（DRIVER でログイン）

| URL | 機能 |
|---|---|
| `/driver/today` | 本日の担当配送先一覧・ステータス更新 |

---

## 業務フロー（MVP）

```
1. 管理者ログイン
2. 配車表画像アップロード（/admin/dispatch-images）
3. OCR実行（取込履歴の「OCR実行」ボタン）
4. OCR結果確認・修正（/admin/ocr-review/[id]）
5. OCR確定（「OCR結果を確定」ボタン）
6. CARIOシフト取込（/admin/shifts → 日付選択 → 取込）
7. 配送先割当（/admin/assignments → 半自動割当 → 確定）
8. ルート作成（/admin/routes → Geocode → ルート生成）
9. ドライバーログイン → /driver/today で担当配送先確認
10. 「Googleマップで開く」でナビ起動
11. 配送完了・不在・持戻りをボタンで更新
12. 管理者が /admin/progress でドライバー別進捗確認
```

---

## 権限設計

| ロール | アクセス可能 | アクセス不可 |
|---|---|---|
| ADMIN | `/admin/*` 全画面 | `/driver/*` |
| DRIVER | `/driver/today` のみ | `/admin/*` |
| 未認証 | `/login` のみ | 全画面 |

- ドライバーは自分の担当配送先のみ閲覧・更新可能
- 他ドライバーの `delivery_item_id` を API で直接指定しても 403 を返す

---

## 利用可能なコマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run start        # 本番サーバー起動
npm run lint         # ESLint 実行
npm run db:migrate   # DB マイグレーション
npm run db:seed      # 初期データ投入
npm run db:studio    # Prisma Studio（DB ブラウザ）
npm run db:reset     # DB リセット（全データ削除）
```

---

## 未確定事項（本番化前に要確認）

| # | 項目 | 現状 | 対応方針 |
|---|---|---|---|
| 1 | CARIO接続方式 | モック実装 | API/CSV/DB が確定したら `src/lib/cario/` を差し替え |
| 2 | 画像ストレージ | ローカル `/uploads/` | 本番では Vercel Blob または S3 へ変更 |
| 3 | 美女木拠点座標 | 暫定値 | `src/lib/maps/warehouse.ts` の lat/lng を正確な値に更新 |
| 4 | OCR | OCR.space 使用（API キー不要でデモキー動作） | `OCR_SPACE_API_KEY` 設定で本番キーに変更可 |
| 5 | Maps API キー | 設定欄のみ | `GOOGLE_MAPS_API_KEY` を本番キーに設定 |

---

## 本番化前チェックリスト

### インフラ・環境

- [ ] 画像ストレージを Vercel Blob または S3 に変更（`src/lib/storage/index.ts` 1行変更）
- [ ] 本番 PostgreSQL への `DATABASE_URL` 設定
- [ ] `NEXTAUTH_SECRET` を本番用にランダム値で設定
- [ ] `NEXTAUTH_URL` を本番ドメインに設定
- [ ] `OCR_SPACE_API_KEY` を設定（任意：未設定でもデモキーで動作）
- [ ] `GOOGLE_MAPS_API_KEY` 本番キーを設定
- [ ] Docker Compose から本番 DB 接続に切り替え
- [ ] `prisma migrate deploy`（本番用マイグレーション）

### CARIO 連携

- [ ] CARIO 接続方式を確認（API / CSV / DB直接）
- [ ] `src/lib/cario/getDrivers.ts` / `getShifts.ts` をモックから実実装に差し替え
- [ ] 接続先の URL・認証情報を環境変数に設定

### データ・アカウント

- [ ] 管理者アカウントのパスワードを変更
- [ ] ドライバーアカウントを実際のドライバーで作成（または CARIO 同期）
- [ ] `prisma/seed.ts` のテスト用データを本番環境では投入しない

### 品質確認

- [ ] 美女木拠点の正確な緯度経度を `src/lib/maps/warehouse.ts` に設定
- [ ] OCR 精度を実際の配車表で確認・パーサー調整
- [ ] Google Maps URL 経由地数の上限確認（10件超は自動分割済み）
- [ ] スマホ（iOS/Android）でドライバー画面を表示確認
- [ ] 個人情報（氏名・電話番号・住所）のログ出力がないか確認
- [ ] 不要な `console.log` が本番コードに残っていないか確認

---

## 本番環境セットアップ（Vercel + Neon）

> **本番方針確定:** Vercel デプロイ / Neon PostgreSQL / Vercel Blob / CARIO REST API

### 1. Neon PostgreSQL のセットアップ

1. [neon.tech](https://neon.tech) でプロジェクト作成
2. **Connection Details → Connection string** をコピー
3. 後で Vercel 環境変数に設定（手順3参照）

```bash
# 本番 DB へのマイグレーション（prisma migrate dev ではなく deploy を使う）
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" \
  npx prisma migrate deploy
```

### 2. Vercel プロジェクト作成・デプロイ

```bash
# Vercel CLI インストール
npm i -g vercel

# プロジェクトをリンク（初回のみ）
vercel link

# 本番デプロイ
vercel --prod
```

### 3. Vercel 環境変数の設定

Vercel ダッシュボード → **Settings → Environment Variables** で以下をすべて設定：

| 変数 | 値 | 必須 |
|---|---|---|
| `DATABASE_URL` | Neon Connection string | ✅ |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` の出力 | ✅ |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | ✅ |
| `OCR_SPACE_API_KEY` | OCR.space で登録（任意） | ⚠️ デモキー動作可 |
| `GOOGLE_MAPS_API_KEY` | Google Maps Platform で発行 | ✅ |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 作成後に自動生成 | ✅ |
| `CARIO_API_BASE_URL` | CARIO の API エンドポイント | CARIO 接続時 |
| `CARIO_API_KEY` | CARIO の API キー | CARIO 接続時 |
| `CARIO_API_SECRET` | CARIO の API シークレット | CARIO 接続時 |

### 4. Vercel Blob のセットアップ

```bash
# Vercel ダッシュボード → Storage → Create → Blob Store
# または CLI で:
vercel storage add

# 環境変数を pull（BLOB_READ_WRITE_TOKEN が自動追加される）
vercel env pull .env.local
```

> `src/lib/storage/index.ts` はすでに Vercel Blob Provider に切り替え済みです。
> `@vercel/blob` も npm install 済みです。

### 5. 本番用管理者アカウント作成

テスト用 seed（`npm run db:seed`）は**本番 DB に絶対に実行しないこと**。

```bash
# 本番用 seed（管理者アカウントのみ・テストドライバーは含まない）
ADMIN_EMAIL=admin@your-domain.com \
ADMIN_PASSWORD=your-secure-password \
DATABASE_URL="postgresql://..." \
npm run db:seed:prod
```

### 6. CARIO REST API 接続の設定

`CARIO_API_BASE_URL` と `CARIO_API_KEY` を Vercel 環境変数に設定するだけで、
自動的に REST API 接続に切り替わります（未設定時はモックにフォールバック）。

**CARIO API 仕様確定後に行う作業：**

`src/lib/cario/mapper.ts` の TODO を確認・調整：
```typescript
// フィールドマッピングを実際のレスポンス構造に合わせて変更
export function mapApiDriver(record: ApiDriverRecord): CarioDriver {
  return {
    carioDriverId: String(record.id ?? ...),  // ← 実際のフィールド名に変更
    ...
  };
}
```

### 7. 美女木拠点の正確な座標設定

`src/lib/maps/warehouse.ts` の暫定値を更新（この1ファイルだけで全体に反映）：

```typescript
export const WAREHOUSE = {
  address: "（正確な住所）",
  lat: 35.xxxx,   // ← Google Maps で確認した緯度
  lng: 139.xxxx,  // ← Google Maps で確認した経度
} as const;
```

### 8. 本番デプロイ後の確認 URL

| URL | 確認内容 |
|---|---|
| `/admin/dashboard` | 集計が表示されるか |
| `/admin/dispatch-images` | 画像アップロード → Vercel Blob に保存されるか |
| `/admin/shifts` | CARIOシフト取込が動くか（API or モック） |
| `/admin/assignments` | 割当が動くか |
| `/admin/routes` | Geocoding・ルート生成が動くか |
| `/admin/progress` | 進捗が表示されるか |
| `/driver/today` | ドライバーの配送先が表示されるか |

### 9. 本番投入 NG 項目

| NG 項目 | 対応 |
|---|---|
| `tanaka / sato / suzuki` アカウント | `seed.prod.ts` のみ使用 |
| テスト用アカウント（開発用） | `seed.dev.ts` のみ・本番 seed に含めない |
| ローカル `.env.local` | Vercel の環境変数を使う・ファイルをアップしない |
| ローカル `/uploads/` 画像 | gitignore 済み・本番には存在しない |

---

## 実データ検証チェックリスト

### OCR 精度確認

- [ ] 実際の L1M 配車表画像（JPEG/PNG）で OCR 実行
- [ ] 配車No（W1-11-1形式）が正しく読み取れるか
- [ ] 数量欄（常温/クーラー/ケース/総数）が4項目に分解されるか
- [ ] 誤読行に「要確認」フラグが立つか
- [ ] OCR確認画面でインライン編集・保存できるか

### 住所・地図確認

- [ ] 実際の配送先住所で Geocoding が成功するか
- [ ] 住所エラー行が `ADDRESS_ERROR` になるか
- [ ] Google Maps URL が正しいルートを示すか
- [ ] 11件以上の配送先で URL が分割されるか

### セキュリティ確認

- [ ] ドライバーAでログインしてドライバーBの配送先が見えないか
- [ ] 他人の `delivery_item_id` を API に直接送って 403 が返るか
- [ ] ADMIN で `/driver/today` にアクセスすると `/admin/dashboard` へリダイレクトされるか
- [ ] スマホ（iOS/Android）でドライバー画面の表示・操作に問題がないか

---

## 既知の制限・保留事項

| 項目 | 内容 |
|---|---|
| OCR 精度 | 実際の L1M 配車表で確認・パーサーの正規表現調整が必要な場合あり |
| 住所補正 | GODOOR 不使用・Google Geocoding + 自社DB（`delivery_location_overrides`）で対応 |
| 手動ピン修正 | 次フェーズ実装予定（テーブル定義は完了） |
| ルート最適化 | 最近隣法（初期 MVP）。本番では Google Routes API 等への高度化を検討 |
| 自動配車 | 現状は半自動（均等割当）。完全自動化は初期 MVP 対象外 |
| OCR自動確定 | 管理者確認必須。自動確定は実装していない |
| ドライバー未割当 | CARIO からシフト取込後、手動でドライバーアカウントと紐付けが必要 |
