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

## 担当境界（衝突回避のため）

| 領域 | 担当 | 主なパス |
|---|---|---|
| CARIO/API連携・シフト/割当取込・リアルタイム同期 | **γ** | `src/lib/cario/*`, `src/app/api/cario/*`, `src/app/api/shifts/*`, `src/app/api/cron/*` |
| 管理画面UI・配車ロジック | α/β | `src/lib/assignment/*`, 管理画面 各page, `Sidebar.tsx` |
| OCR/取込エンジン | 担当ターミナル | `src/lib/ocr/*`, `ocr-review` |
| 増便申請(extra-vehicle) | 担当ターミナル | `src/**/extra-vehicle*`, `src/lib/line/*`, `src/app/api/external/*` |
| セキュリティ/診断 | 担当ターミナル | 横断（例: cron認証の `timingSafeEqual` 強化） |

## γ が他ターミナルへ提供する連携インターフェース（consume可）

- `GET /api/cario/health[?driftDate=YYYY-MM-DD]` … 疎通・同期鮮度・stale件数・CARIO↔DBドリフト
- `GET /api/cario/vehicle-matches?date=` … **CARIO号車↔OCR号車のマッチング提案（read-only）**。配車ロジック(α/β)が参照して自動割当に活用可（※γは実割当に書き込まない）
- `GET /api/cario/sites` … 現場一覧（site_id絞り込みの選択肢）
- `syncCarioAssignments()` / `getShiftListPayload()`（`src/lib/cario/`）… 取込・一覧の共有コア
- 詳細は `docs/cario-integration.md`（Runbook）参照

## 運用上の注意（共有事項）

- **共有作業ツリー**のため `git commit -am` / `git add -A` は他ターミナルの中途変更・削除を巻き込む。**パス明示コミット**を徹底（過去に実際に巻き込み事故あり）。
- `DATABASE_URL` はVercel Sensitiveで `vercel env pull` では空。ローカルからの本番DB直書き不可。
- CARIOサーバー同期は cron-job.org(1分・主)＋GitHub Actions(5分・GitHub都合で間引き・予備)＋Vercel Cron(日次・予備)。
