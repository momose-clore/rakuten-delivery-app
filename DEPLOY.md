# 本番デプロイ手順書

> コードは本番デプロイ可能な状態（typecheck / lint / build 全 OK 確認済み）。
> このファイルの手順に沿って上から順番に実行してください。

---

## 作業分担

### 👤 人間がやること（アカウント・APIキー取得）

| # | 作業 | 場所 |
|---|---|---|
| A | Neon アカウント作成 | https://neon.tech |
| B | Neon プロジェクト作成 → `DATABASE_URL` 取得 | Neon ダッシュボード |
| C | Vercel アカウント作成 | https://vercel.com |
| D | Vercel プロジェクト作成 → GitHub リポジトリを import | Vercel ダッシュボード |
| E | Vercel Blob Store 作成 → `BLOB_READ_WRITE_TOKEN` 取得 | Vercel ダッシュボード → Storage |
| F | Google Cloud Console → Geocoding API 有効化 → API キー発行 | https://console.cloud.google.com |
| G | OCR.space アカウント作成 → `OCR_SPACE_API_KEY` 取得（本番必須） | https://ocr.space/ocrapi/freekey |
| H | CARIO API キー取得（CARIO 担当者へ依頼） | CARIO 側 |
| I | 本番管理者メール・パスワードの決定 | 社内で決定 |

### 🤖 Claude Code がやること（CLIコマンド実行）

| # | 作業 | コマンド |
|---|---|---|
| 1 | NEXTAUTH_SECRET 生成 | `openssl rand -base64 32` |
| 2 | 環境変数テンプレート生成 | このファイルに記載 |
| 3 | Vercel CLI ログイン | `vercel login` |
| 4 | Vercel プロジェクト連携 | `vercel link` |
| 5 | Vercel 環境変数一括登録 | `vercel env add` × 11個 |
| 6 | 本番 DB マイグレーション | `prisma migrate deploy` |
| 7 | 本番管理者 seed | `npm run db:seed:prod` |
| 8 | 本番デプロイ | `vercel --prod` |

---

## 実行順序

```
① 人間作業 A〜I を完了させてから、以下を Claude Code に依頼
② NEXTAUTH_SECRET 生成
③ Vercel CLI セットアップ
④ Vercel 環境変数登録
⑤ prisma migrate deploy
⑥ db:seed:prod
⑦ vercel --prod
⑧ 動作確認
```

---

## 必要な入力値一覧

以下の値を準備してから Claude Code に渡してください（実値はここに書かない）。

| 変数名 | 取得元 | 状態 |
|---|---|---|
| `DATABASE_URL` | Neon ダッシュボード → Connection string | ⏳ |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` で生成 | 🤖 自動生成 |
| `NEXTAUTH_URL` | Vercel デプロイ後の URL | ⏳ |
| `OCR_SPACE_API_KEY` | OCR.space で登録（本番必須・未設定でOCR不可） | ⏳ |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console | ⏳ |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Store 作成後 | ⏳ |
| `CARIO_API_BASE_URL` | CARIO 担当者から（未確定はスキップ可） | ⏳ |
| `CARIO_API_KEY` | CARIO 担当者から（未確定はスキップ可） | ⏳ |
| `CARIO_API_SECRET` | CARIO 担当者から（未確定はスキップ可） | ⏳ |
| `ADMIN_EMAIL` | 社内決定 | ⏳ |
| `ADMIN_PASSWORD` | 社内決定（16文字以上推奨） | ⏳ |

---

## コマンド一覧

### NEXTAUTH_SECRET 生成

```bash
openssl rand -base64 32
# 出力された文字列を NEXTAUTH_SECRET として使用する
```

### Vercel CLI セットアップ

```bash
# Vercel CLI インストール（未導入の場合）
npm i -g vercel

# ログイン（ブラウザが開く）
vercel login

# プロジェクト連携（ローカルとVercelプロジェクトを紐付け）
cd "楽天スーパー配送アプリ"
vercel link
# → 対象プロジェクトを選択
```

### Vercel 環境変数登録

環境変数を1つずつ登録するコマンド（値は対話形式で入力）:

```bash
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add OCR_SPACE_API_KEY production
vercel env add GOOGLE_MAPS_API_KEY production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add ADMIN_EMAIL production
vercel env add ADMIN_PASSWORD production
# CARIO が確定したら以下も追加
# vercel env add CARIO_API_BASE_URL production
# vercel env add CARIO_API_KEY production
# vercel env add CARIO_API_SECRET production
```

### 本番 DB マイグレーション

```bash
# DATABASE_URL は環境変数として渡す（ソースコードに書かない）
DATABASE_URL="（Neonから取得したURL）" npx prisma migrate deploy
# → "All migrations have been applied." が表示されれば成功
```

### 本番管理者 seed

```bash
# ADMIN_EMAIL / ADMIN_PASSWORD / DATABASE_URL を環境変数として渡す
ADMIN_EMAIL="admin@your-domain.com" \
ADMIN_PASSWORD="your-secure-password" \
DATABASE_URL="（NeonのURL）" \
npm run db:seed:prod
# → "✅ 本番管理者アカウント作成: ..." が表示されれば成功
```

### 本番デプロイ

```bash
vercel --prod
# → デプロイ完了後に本番 URL が表示される
```

---

## デプロイ後の動作確認 URL

| URL | 確認内容 | 期待結果 |
|---|---|---|
| `/login` | ログイン画面 | 画面が表示される |
| 管理者ログイン後 | リダイレクト | `/admin/dashboard` に遷移 |
| `/admin/dashboard` | ダッシュボード | 集計カードが表示される |
| `/admin/dispatch-images` | 画像取込 | アップロード → Vercel Blob に保存される |
| `/admin/ocr-review/[id]` | OCR確認画面 | 元画像 + 明細テーブルが表示される |
| `/admin/shifts` | シフト取込 | 取込実行（CARIO未設定→モック） |
| `/admin/assignments` | 割当 | 割当画面が表示される |
| `/admin/routes` | ルート作成 | Geocode → ルート生成 → Maps URL |
| `/admin/progress` | 進捗 | ドライバー別進捗が表示される |
| `/driver/today` | ドライバー画面 | 担当配送先が表示される |

---

## 権限確認チェックリスト

```
[ ] 未認証で /admin/dashboard → /login にリダイレクトされる
[ ] DRIVER で /admin/* にアクセス → /driver/today にリダイレクトされる
[ ] ADMIN で /driver/today にアクセス → /admin/dashboard にリダイレクトされる
[ ] ドライバーAでログイン → ドライバーBの配送先が表示されない
```

---

## 注意事項

- `DATABASE_URL` / `BLOB_READ_WRITE_TOKEN` / `GOOGLE_*_API_KEY` / `ADMIN_PASSWORD` は
  ソースコードや README に実値を書かない
- 環境変数は Vercel ダッシュボードまたは `vercel env add` コマンドでのみ設定する
- `npm run db:seed`（開発用）を本番 DB に実行しない
  → 必ず `npm run db:seed:prod` を使う
- CARIO API 未設定の場合は自動的にモックフォールバックするので、
  CARIO キーなしでも動作確認は可能
