# CARIO 連携 運用ガイド（Runbook）

楽天 CARIO（`cario-app-two`）とのシフト/割当連携の構成・運用・障害対応をまとめる。
担当: γ（CARIO/API連携）。**受信専用**（CARIOへはGETのみ・書き込みなし）。

---

## 1. 構成概要

```
CARIO (cario-app-two)                    このアプリ (rakuten-delivery-app)
  GET /api/external/rakuten/*  ──取得──▶  syncCarioAssignments()  ──upsert──▶ DB(drivers/shifts)
                                            ▲          ▲              ▲
                              手動取込 / リアルタイム / Cron の3経路が共用
```

- **主力データ**: `/assignments`（割当）。driver・号車(course)・現場(site)・work_date を含む。
- assignments に driver が埋め込まれるため、`/drivers` を別途叩かず drivers/shifts を導出する。
- CARIO は勤務時間・シフト希望(updated_since等の増分)・push/webhook を**提供しない**。よって「高頻度GET＝ポーリング型」で最新化する。

## 2. エンドポイント（CARIO側・確定 v1.0）

Base: `https://cario-app-two.vercel.app/api/external/rakuten`／認証: `Authorization: Bearer <RAKUTEN_APP_API_KEY>`

| パス | 用途 | 形状 |
|---|---|---|
| `GET /sites` | 現場一覧 | `{sites:[{id,name,flow_type,wave_count,client}]}` |
| `GET /drivers`(`?all=1`) | DA一覧 | `{drivers:[{id,name,phone,...}]}` |
| `GET /shift-requests?from&to` | シフト希望 | `{from,to,requests:[]}`（現状空） |
| `GET /assignments?from&to[&site_id]` | 割当（主力） | `{from,to,assignments:[{id,work_date,driver,site,course,note}]}` |

## 3. アプリ側の実装

| 種別 | 場所 |
|---|---|
| APIクライアント（認証/タイムアウト/リトライ） | `src/lib/cario/client.ts`, `getAssignments.ts` |
| レスポンス変換（ネスト→内部型・drivers/shifts導出） | `src/lib/cario/mapper.ts`（+ `mapper.test.ts`） |
| 同期コア（防御的upsert・JST日付） | `src/lib/cario/sync.ts` |
| 一覧生成 | `src/lib/cario/shift-list.ts` |
| 現場/シフト希望 | `src/lib/cario/getSites.ts` |

### API ルート
- `POST /api/shifts/import` … 手動取込（`{date, to?, siteId?}`・監査ログ記録）
- `GET  /api/shifts/realtime?date=` … リアルタイム取得（管理画面ポーリング用・監査なし）
- `GET  /api/cron/cario-sync` … Cron/GH Actions用（`CRON_SECRET` 認証・JST本日〜+2日）
- `GET  /api/cario/sites` … 現場一覧
- `GET  /api/cario/health` … 疎通/同期鮮度/ドリフト
- `POST /api/shifts/approve-stale` … stale継続使用の管理者承認

## 4. リアルタイムの2経路

1. **クライアント30秒ポーリング**（本命・プラン非依存）: `/admin/shifts` の「リアルタイム連携」トグル。
2. **サーバー同期**: `/api/cron/cario-sync` を叩く。
   - Vercel Cron: `vercel.json` の `0 21 * * *`（Hobbyは日次上限）。
   - **GitHub Actions**: `.github/workflows/cario-sync.yml`（5分間隔・public repoで無料）。

## 5. シークレット / 環境変数

| 変数 | 用途 | 場所 |
|---|---|---|
| `RAKUTEN_APP_API_KEY` | CARIO認証 | Vercel(dev/preview/prod)・ローカル`.env.local` |
| `CRON_SECRET` | cronエンドポイント認証 | Vercel(prod/preview)・GitHub Actions secret（**同一値**） |
| `CARIO_API_BASE_URL` | Base上書き（任意・既定あり） | 通常不要 |
| `CARIO_ASSIGNMENTS_PATH` | assignmentsパス上書き | 任意 |

> ⚠️ `DATABASE_URL` はVercelのSensitive変数で `vercel env pull` では空になる（ローカルからの本番DB直書き不可）。DB取込は**デプロイ済みアプリ経由**で行う。

## 6. よくある操作

- **同期間隔を上げたい**: Pro化して `vercel.json` の schedule を `* * * * *` に変更（1行）。または GitHub Actions の `*/5` を調整。
- **CRON_SECRET ローテーション**: Vercel(prod/preview)と GitHub secret の**両方**を同値で更新 → Vercel再デプロイ（新値反映のため必須）。
- **テスト**: `npm test`（`tsx --test`・mapper純粋関数）。

## 7. トラブル対応

| 症状 | 確認 |
|---|---|
| 取込0件 | REAL_APIモードか（`RAKUTEN_APP_API_KEY`）。MOCK表示なら未設定。`/api/cario/health` で疎通確認 |
| 401（realtime/cron） | 管理者ログイン／`CRON_SECRET` 一致・再デプロイ済みか |
| stale表示 | CARIO一時失敗。自動リトライ（2回・指数バックオフ）後も失敗なら stale。回復は次回同期成功で自動。手動継続は approve-stale |
| 号車がドライバー単位で日により違う | `driver.vehicleId` は「最初に見た号車」。日別の正は assignment 単位 |
| GH Actions が止まった | public repoは60日間リポジトリ無活動で scheduled workflow が自動停止。手動 `workflow_dispatch` で再開 |
