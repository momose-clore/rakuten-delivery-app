# 配送表画像 Blob 物理 private 化 実施手順書

> ⚠️ **本ドキュメントは手順書のみ。まだ実装・インフラ変更は行っていない。**
> 実施判断は未確定。着手前に本書の「影響範囲」「前提確認」を必ずレビューすること。
> 最終更新: 2026-07-02（待機中に作成・未着手）

---

## 0. 背景と現状

| 項目 | 現状 |
|---|---|
| ストレージ Provider | `src/lib/storage/vercel-blob.ts`（`@vercel/blob`） |
| アップロード時 access | **`access: "public"`**（`put()`） |
| `read()` の実装 | `fetch(url)` でトークンなし取得（public 前提） |
| Blob prefix | `dispatch-images/` |
| クライアントの画像参照 | **フェーズ5で認証プロキシ経由化済み**（`GET /api/dispatch-images/[id]/file`） |
| アプリ層の private 化 | ✅ 完了（ブラウザに生 Blob URL を出さない） |
| 物理層の private 化 | ⬜ 未実施（Blob URL 自体は直アクセス可能なまま） |

**要点：** 現状はアプリが生 URL を露出しないため実運用上のリスクは低いが、Blob URL を知る者は認証なしで画像を取得できる（物理的には public）。本手順は Blob ストア自体を private 化し、この残存リスクを解消する。

**唯一の画像消費経路：** フェーズ5以降、サーバー側の `storageProvider.read()`（プロキシルート内）が唯一の読み取り経路。クライアントから生 URL を fetch する箇所は残っていない。→ **`read()` をトークン認証に対応させれば物理 private 化が可能。**

---

## 1. 影響範囲（着手前レビュー必須）

ユーザー指摘の6点に対する評価。

| # | 影響項目 | 内容 | 対応方針 |
|---|---|---|---|
| 1 | **Blob ストア再作成の可能性** | 既存ストアが public 固定設定の場合、private ストア新規作成が必要になり得る。`@vercel/blob` は `put` 単位で access 指定可能なため**ストア再作成は原則不要**だが、Vercel ダッシュボードのストア設定を要確認。 | まずストア設定確認 → 再作成不要なら put の access 変更のみ |
| 2 | **既存 public URL の扱い** | DB `dispatch_images.image_url` に保存済みの URL は public blob を指す。private 化しても**既存 URL は public のまま**（後から access は変わらない）。 | 既存はそのまま or 移行（§2 で選択） |
| 3 | **既存画像の移行** | 既存を完全 private 化するには「ダウンロード→private で再 put→DB URL 更新→旧 blob 削除」が必要。件数分の I/O が発生。 | 移行スクリプトを用意（§3・ドライラン必須） |
| 4 | **token read 権限確認** | private blob の `read()` には `BLOB_READ_WRITE_TOKEN`（read 権限）が必須。現 `read()` はトークン未使用。 | `read()` をトークン対応に改修（§2 手順B） |
| 5 | **本番データへの影響** | 本番 Neon の `image_url` を書き換える移行は不可逆リスク。OCR は `read()` 経由のため read 改修漏れで**OCR/プレビュー全停止**の恐れ。 | ステージング相当で先行検証・段階移行 |
| 6 | **画像プレビュー導線の再検証** | プロキシ（`/api/dispatch-images/[id]/file`）・取込確認画面・履歴一覧・カメラ取込（`camera/process` の `storageProvider.read(imageUrl)`）を全経路で再検証。 | §4 の検証チェックリスト全項目 |

### 影響を受けるコード（変更が必要な箇所）

| ファイル | 変更内容 |
|---|---|
| `src/lib/storage/vercel-blob.ts` | `put` の `access: "public"` → `"private"`（新規のみ）／`read()` をトークン付き取得に改修 |
| （移行時のみ）一時スクリプト | 既存 public → private 再アップロード＋DB URL 更新（`.gitignore` 管理） |

### 影響を受けないことを確認済みの箇所

- クライアント画像表示（`OcrReviewClient` / `ImageHistoryList`）→ 既にプロキシ URL 経由。生 URL 非依存。
- `camera/process/route.ts` → サーバー側 `storageProvider.read(imageUrl)` 経由のため read 改修に追従。

---

## 2. 実施手順

> **前提：** 本番トラフィックの少ない時間帯／バックアップ取得後に実施。実施者は Vercel プロジェクト管理権限を持つこと。

### 手順A：前提確認（変更なし・確認のみ）

1. Vercel ダッシュボード → Storage → 対象 Blob ストアの access 設定を確認。
2. `BLOB_READ_WRITE_TOKEN` が read/write 両権限を持つことを確認（値は表示・ログしない）。
3. `dispatch_images` 件数と概算容量を確認（移行 I/O 見積り）。
4. Neon 本番 DB のバックアップ（スナップショット）を取得。

### 手順B：コード改修（`read()` のトークン対応）

`src/lib/storage/vercel-blob.ts`：

- `put(...)` の `access` を `"private"` に変更（**新規アップロードのみ private 化**）。
- `read(url)` を、bare `fetch` ではなく `@vercel/blob` のトークン付き取得（例：`head()`/`download` 相当 + `Authorization`）に改修。
  - private blob は署名なしの素の `fetch(url)` では 401 になるため、トークン経由が必須。
- **後方互換：** 既存 public URL も read できるよう、まずはトークン付きで試行し、public URL はそのまま fetch にフォールバックする実装にすると移行期間を安全にまたげる。

> ⚠️ この時点では **既存画像は public のまま**。新規アップロードのみ private。既存を private 化するかは手順Cで判断。

### 手順C：既存画像の移行（任意・完全 private 化する場合のみ）

一時スクリプト（`.gitignore` 管理・コミット禁止）で以下をドライラン→本実行：

1. `dispatch_images` を全件取得。
2. 各 `image_url`（public）を `storageProvider.read()` でダウンロード。
3. 同一 filename で `access: "private"` として再 `put`。
4. 返却された private URL で `dispatch_images.image_url` を UPDATE。
5. 旧 public blob を `del()` で削除。
6. **1件ずつトランザクション的に**（DB 更新成功後に旧 blob 削除）。途中失敗時は当該行スキップ＆ログ（件数のみ・URL/個人情報は出さない）。

> まず **ドライラン（読み取り＋件数集計のみ、書き込みなし）** を必須実行し、対象件数・失敗見込みを確認してから本実行。

### 手順D：デプロイ

1. 手順B のコード改修をデプロイ。
2. `/admin/dispatch-images` で**新規**アップロード→OCR→プレビューが通ることを確認。
3. （手順C 実施時）移行後に既存画像プレビューも確認。

---

## 3. ロールバック手順

### コード改修のみ（手順B）をロールバックする場合

1. `src/lib/storage/vercel-blob.ts` を `access: "public"` / bare `fetch` の `read()` に revert。
2. 再デプロイ。
3. 手順B 後・手順C 前であれば **新規アップロードのみが private**。これらは private のままなので、revert 後の bare `fetch` read では読めなくなる → 該当期間の新規画像だけ再アップロード or read フォールバック維持で対応。
   - **推奨：** read() の「private トークン試行 → public フォールバック」実装は revert せず残す（両対応なら安全）。

### 既存移行（手順C）をロールバックする場合

- 手順C は**旧 blob を削除する破壊的操作**。削除後の完全ロールバックは不可。
- そのため手順C の本実行前に：
  - Neon スナップショット取得（DB `image_url` 復旧用）。
  - **旧 blob の即時削除をしない**運用（削除を後日バッチ化し、猶予期間を設ける）を推奨。
- 猶予期間内なら：DB を旧 URL にスナップショットから復元 → 旧 blob がまだ存在するため復旧可能。

---

## 4. 検証チェックリスト（実施後・全項目必須）

```
[ ] 新規アップロード → dispatch_images 登録される
[ ] 新規画像で OCR 実行が成功する（read() が private blob を取得できる）
[ ] /admin/ocr-review/[id] で画像プレビューが表示される（プロキシ経由）
[ ] /admin/dispatch-images 履歴一覧のサムネイルが表示される
[ ] スマホカメラ取込（camera/process）で read() が成功する
[ ] 生 Blob URL に未認証で直アクセス → 401/403 になる（private 化の確認）
[ ] プロキシ /api/dispatch-images/[id]/file は ADMIN セッションでのみ 200
[ ] （移行時）既存画像も上記すべて通る
[ ] ログに URL・トークン・個人情報が出ていない
```

---

## 5. リスクと判断材料

| リスク | 深刻度 | 緩和策 |
|---|---|---|
| read() 改修漏れで OCR/プレビュー全停止 | 高 | public フォールバック実装・段階デプロイ・検証チェックリスト |
| 既存移行での blob 誤削除 | 高 | 旧 blob 即時削除しない・DB スナップショット・ドライラン |
| private read の追加レイテンシ | 低 | プロキシは元々サーバー read。体感差は小 |
| Vercel ストア設定が public 固定 | 中 | 手順A で事前確認・必要ならストア新規作成 |

### 結論（着手可否の目安）

- **アプリ層 private 化は完了済み**のため、物理 private 化は「深さ優先度・低〜中」。
- 着手するなら **手順B（新規のみ private＋read両対応）を先行**し、既存移行（手順C）は別途判断するのが最小リスク。
- 本番データ移行を伴う手順C は、バックアップ・ドライラン・削除猶予をセットにしてのみ実施する。

---

*本書は手順のみを定義する。実装・インフラ変更の実施は、別途 GO 判断の後に行うこと。*
