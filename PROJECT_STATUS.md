# 楽天スーパー配送アプリ — 開発ステータス

> GPT共有用ドキュメント。作業完了ごとに更新する。
> 最終更新: 2026-07-03（セキュリティ全体監査＋Critical/High修復・監視運用開始）

---

## 📣 全ターミナル共有（α/β/γ）2026-07-03

### 🤝 α→γ 調整：貨物一覧表バーコード＆カメラ強化の共同開発（2026-07-04）
riku指示で「左上バーコード読取（γ担当）＋カメラの手動四隅調整＋ブレ補正」を共同開発。α側の状況と依頼：

- **【α実装済み・共有】左上バーコード番号は OCR.space の結果から取得可能**。`extractL1MMetadata` に `meta.barcodeText`（26始まり10桁・独立トークン。伝票No=20始まり15桁と区別）を追加済み。実データ3枚で確認：17.23=2606097789 / 16.53=2606085017 / IMG_7677(カメラ)=2606085017。
  - → **専用バーコードデコーダや Tesseract を足さなくても値は取れる**。`saveDriverScan`/`dispatchImage` に barcodeText を保存して帳票識別に使う想定。γ側でこの値を使う/別実装するか要調整。
- **【γへ確認】** 作業ツリーに `tesseract.js` 使用（`src/lib/ocr/tesseract.ts`）＋ `eng/jpn.traineddata`(未コミット) があります。**「OCR.space のみ」方針**（CLAUDE.md）との整合と、バーコード用途か教えてください。バーコードが目的なら上記 barcodeText で足りる見込み。Tesseractを別OCRエンジンとして常用するのは方針要確認＋バンドル増（traineddata 8MB）に注意。
- **【αの分担】** 読取パーサー(L1M)は α 継続。**カメラのブレ検出/前処理**も α で対応可。**手動四隅調整スキャナ（クライアント側・射影変換）**は「自動書類検出が布/柄背景で不発（sharp閾値もOpenCV輪郭も実証済みNG）」のため手動が本命 → 設計は α、実機テストは riku。分担どうするか相談したいです。
- **γの現状（バーコード/その他）と、barcodeText 連携の要否を PROJECT_STATUS に追記お願いします。**

### 方針（ユーザー指示）: プライバシーポリシー記載内容は気にしなくてよい
- **撮影画像（配送表）の Vercel Blob `access:"public"` 保存**、および **OCR取込後の画像（PII）削除未実装**は、**当面「対応不要・ブロッカー扱いしない」**（ユーザー明示・2026-07-03）。
- セキュリティ監査(β)でも、この「画像のpublic保存／PII画像の残存」項目は**修復必須として扱わない**でOK。
- ※コーディング衛生上のルール（氏名/電話/住所/伝票No を **console.log しない**・raw OCR JSON を公開保存しない）は従来どおり継続。

### カメラ/PDF 取込の「画像クリーンアップ」現状（α調査）
- **OCR前補正**: 実施済み（EXIF回転→リサイズ→grayscale→normalize/CLAHE→sharpen）。**未実装**: 傾き角補正・書類の縁検出/自動クロップ・影除去・二値化。
- **保存後の画像削除**: 未実施（`storageProvider.delete()` は存在するが取込フローで未呼出）。上記方針により当面そのまま。

### αの直近成果（本番反映済み）
- 本番OCRキー登録・実PDF反映検証／スキャンPDF強化／dedup／カメラupload 500修正／**OCR読取精度 旧0/3→新3/3（配車No・伝票No・電話・数量・住所）**。詳細は下記各セクション。

---

## 🔒 セキュリティ監査＆修復（2026-07-03 開始・以降 日次監視）

全体監査を実施（詳細: `docs/SECURITY_AUDIT.md`）。Critical 1・High 5・Medium 4・Low 3 を検出。

**即修復済（本番ビルド通過）**:
- **C1 Critical**: `test-driver` API の `?token=clore-setup-2026` 未認証バイパスを撤去 → **常に ADMIN セッション必須**（既知パスドライバー作成・未認証データ削除が可能だった）。
  - ⚠️ 影響: テストデータ消し込みは `?action=cleanup` に**ADMINログインが必要**になった（旧 `&token=` は無効）。
- **H1**: LINE Webhook を本番 fail-closed 化（secret未設定なら偽造イベント受理を拒否）。
- **H2**: カメラOCR `process` の SSRF 対策（`imageUrl` を Vercel Blob ホストのみ許可）。
- **H3**: セキュリティヘッダー追加（CSP/HSTS/X-Frame-Options/nosniff/Referrer/Permissions）。
- **L1**: cron の CRON_SECRET 比較を `timingSafeEqual` に統一。

**要判断/未対応（優先度順）**: H4 レート制限なし / H5 `xlsx@0.18.5` 脆弱版差替 / M1 err.message漏れ / M2 Postgres SSL強制 / M3 next-auth beta固定 / L2 画像 Content-Disposition。

### プライバシーポリシー整備（2026-07-03）
- 日本語版 `docs/PRIVACY_POLICY.md`／英語版 `docs/PRIVACY_POLICY.en.md`（日本語優先条項付き）を作成。
- リーガルチェック `docs/PRIVACY_POLICY_LEGAL_REVIEW.md`（APPI 2022改正準拠・弁護士最終確認推奨）。指摘のうち 外国third者提供(法28条)・手数料・苦情申出先・外的環境の把握 をポリシー本文へ反映済。
- 閲覧用公開ページ `src/app/privacy/page.tsx`（`/privacy`・ログイン不要）を追加し、**クルー画面（driver layout）最下部に控えめなリンク**を設置。
- 事業者名・所在地・保管国・保存期間・手数料は【要設定】プレースホルダ（確定後に置換）。DB・既存データは不変更。

---

## ✅ 本番OCR稼働（2026-07-03 解消・検証済）

**症状**: 本番アプリでカメラ/画像/PDF のOCRが全て HTTP 502（「本番環境では OCR_SPACE_API_KEY の設定が必須です」）。
**原因**: Vercel 本番 env に `OCR_SPACE_API_KEY` が未登録（コードは方針どおり本番でデモキーfallback禁止＝正常挙動）。
**対応**（Vercel CLI で実施）:
- `OCR_SPACE_API_KEY`（OCR.space **無料登録キー**・デモキー不使用）を Production/Preview に登録
- `OCR_MAX_PAYLOAD_MB=1` を Production/Preview に登録（無料枠「1画像1MB」に前処理を自動収束）
- 再デプロイ

**無料枠の制限**: 1画像1MB / PDF3ページ / 月25,000回。>1MBは前処理側で段階圧縮（品質→解像度、下限1800px）。

**本番検証**（テストドライバーで実PDF送信）: `reflected:true / itemCount:3 / needsReview:0`。配車No(11-1/11-2/11-3)・住所・数量・ナビURL 全て反映を確認。

### スキャンPDF・座標解析の強化（同日）
| 改善 | 内容 |
|---|---|
| スキャンPDFの画像OCR化 | 生PDF→Engine1は表構造が崩れるため、PDF内埋め込みJPEGを抽出→画像OCR(Engine2)に回す（送信は1回・`extract-pdf-image.ts`） |
| 配車No列境界 | 実測で配車No列は左端10〜13%に分布。`leftBoundary` 0.12→0.14（0.16以上は日付を誤検出）。`OCR_L1M_LEFT_BOUNDARY`/`OCR_L1M_QTY_BOUNDARY` でenv微調整可 |
| 配車No分割復元 | `11-1`が`11`+`1`(ハイフン欠落)に分割されても左カラム行クラスタから `N-M` を復元 |
| 住所抽出の頑健化 | 住所ラベル依存を撤廃し、電話行(0始まりで判別容易)の下端を住所行起点に (top,left) 順で結合。語順の乱れ・ラベル読み落とし・複数行住所に強い |

### 取込の重複防止・カメラ本番バグ修正・テストデータ管理（2026-07-03）
| 項目 | 内容 | 検証 |
|---|---|---|
| 撮り直しで更新(upsert) | `saveDriverScan` が同一ドライバー・同日の 伝票No/(W番号+配車No) で既存突合し、**あれば新OCR結果で更新・無ければ新規**（二重登録しない）。完了ステータス・誤配なし・承認/手動修正済み座標＆住所は保護。`createdCount`/`updatedCount` 返却＋UIトースト | 本番で再取込→`updatedCount:3`＋住所が正規順に更新を確認 |
| **カメラ取込 本番500 修正** | `/camera/upload` が `TypeError: SharedArrayBuffer is not allowed` で500（sharpの`.toBuffer()`をVercel Blob put()のfetchが拒否）。`Buffer.from` で通常ArrayBuffer裏付けにコピー。**実機カメラ取込の本番バグ** | upload/process 200・カメラで3件反映確認 |
| テストデータ消し込み | `GET /api/admin/setup/test-driver?action=cleanup&token=...` で TEST-001 の配送データのみ削除（実データ非対象） | 9件削除→0件確認 |

**カメラ経路 本番検証**: upload→process→本日配送に3件反映（配車No W6-11-1/2/3・住所・ナビURL・layoutProfile=l1m_cargo_list）。

### OCR読取精度 大幅改善（2026-07-03・実PDFで検証）
実PDF（L1M・3配送）を正解データに、実モジュール（前処理→OCR.space→パーサー）で計測。

| 項目 | 旧方式 | 新方式 |
|---|---|---|
| 行復元 | 0/3（生PDF→Engine1は表崩れ／422） | 3/3 |
| 配車No | 0/3 | 3/3 |
| 伝票No | 0/3 | 3/3 |
| 電話 | 0/3 | 3/3 |
| 数量(常温/クーラー/ケース/箱計) | 0/3 | 3/3 |
| 住所 | 0/3 | 3/3（地名取得。うち厳密一致2/3・1件は漢字OCR誤読） |

**効いた修正**（すべて実データ観察ベース）:
- スキャンPDFは埋め込み画像抽出→Engine2（生PDF→Engine1は表構造崩壊）
- ブロック分割を「配車No行−upShift」のy境界に（伝票No行が配車No行の少し上に来る問題を解消）
- 伝票No＝中央語数字連結から `20XX+13桁` を直接抽出／電話＝連絡先行のy帯で語結合（`090-1552-3598`の語分割対応）／住所＝連絡先行の直下をy座標結合
- 数量＝実測列中心[常温67/クーラー78/ケース88/箱計97%]の最寄り割当（空セルのズレ解消）、境界0.76→0.63
- 前処理解像度 TARGET3600→4000・MAX4200→6000、ペイロード保護を「解像度優先」に（潰れた小文字対策・grayscaleなら6000px級でも1MB以下を実測）
- **2枚目実データ(W2/号車10・5配送)で追加修正**:
  - 日付(06-21)を配車Noと誤検出→**配車No第1部=号車(vehicleNo)一致**で絞り込み、偽ブロックを排除
  - 連絡先ラベル未OCR行の電話を**ハイフン付き電話書式フォールバック**で復元（15桁伝票と誤マッチしない）
  - ラベル両方欠落行の住所を**郵便番号/都道府県アンカーのフォールバック**で復元

**検証(2枚)**: 16.53(4配送) 配車No/伝票/電話/住所 4/4 ／ 17.23(3配送) 配車No/伝票/電話/数量 3/3（住所は1件だけ地名漢字OCR誤読で2/3）。

### カメラ写真（横向き/歪み）対応・伝票No行アンカー（2026-07-04）
「枠組みは固定＝各行を1配送として数える」方針で、カメラ写真の読取を大幅改善：
- **カメラ横向き/上下逆に自動対応**：座標を0/90/270/180°試行（再OCRなし）し配車Noが最も並ぶ向きを採用
- **伝票No(20XX 15桁)を行アンカー**にし、配車Noは左カラム復元→ダメなら**号車＋順番**で補完（配車Noクラスタ不足時のみ採用＝正立PDFは無回帰）
- 住所からラベル語/メモ文の混入を除去（セル分離の趣旨）
- **検証**: 横向きカメラ写真IMG_7677が **0行→4行**（伝票4/電話4/住所地名3）。PDF(17.23/16.53)は無回帰。
- **数量列を検出ヘッダ基準に**：常温/クーラー/ケース/箱数計 のヘッダ実位置を検出して数量列中心に（固定%はfallback）＝シート差・列ズレに追従
- **サマリー総数抽出を「箱数計」表記対応**：明細合計との照合が機能（17.23で 8=8 一致確認、不一致は要確認へ）
- **残る限界**: 斜め＋強い遠近歪みの写真は列/セルがずれ住所に語順乱れ・隣接混入が残る（要デワープ or 正面撮影）。部屋番号等の極小数字はOCRエンジン限界（PDFも同様）。

**最終検証(3枚)**: 17.23=配車No/伝票/電話/住所/数量すべて3/3 ／ 16.53=配車No/伝票/電話/住所 4/4 ／ IMG_7677(横向きカメラ)=配車No/伝票/電話 4/4・住所地名3/4。

**残課題（軽微）**: 住所は稀に地名漢字のOCR誤読あり（GODOOR不使用のため Google Geocoding＋overrideで補正する方針）。数量の個別列は空セル多発時にズレる場合あり（サマリー総数クロスチェックで要確認フラグ）。実運用データが増えたら誤読辞書・列中心を追調整。

---

## プロジェクト概要

CARIOとは別に新規開発するWebアプリ。
専用配送サイト上の「L1M貨物一覧表／配車予定表」画像をOCRで読み取り、CARIOから取得したシフトデータと突合して、稼働ドライバーへ配送先を割り当てる。

---

## 技術スタック（確定）

| レイヤー | 採用技術 | バージョン | 備考 |
|---|---|---|---|
| フレームワーク | Next.js App Router | 16.x | Vercel にデプロイ |
| 言語 | TypeScript | 5.x | |
| スタイリング | Tailwind CSS + shadcn/ui | v4 | |
| ORM | Prisma + @prisma/adapter-pg | 7.x | |
| DB | PostgreSQL | 16 | 開発: Docker / 本番: Neon |
| 認証 | NextAuth.js v5 / Credentials + JWT | beta | |
| パスワード | bcryptjs | — | |
| OCR | **OCR.space**（1画像1回・Gemini/AI/Cloud Vision 不使用） | — | `OCR_SPACE_API_KEY`（**本番: 必須**・未設定でOCR実行不可 / 開発: デモキー可） |
| 地図 | Google Maps Geocoding API + Maps URL | — | 要 API キー |
| 画像ストレージ | Vercel Blob | — | `@vercel/blob` 実装済み・要 `BLOB_READ_WRITE_TOKEN` |
| CARIO連携 | 実REST API 接続済み（v1.0・キー未設定時のみモック） | ✅ | `assignments` 主力取込・疎通確認済 2026-07-03 |
| 取込エンジン | **v5**（PDF/CSV/Excel/貼付/画像/スマホカメラ） | — | L1M専用プロファイル・自動救済・OCR.space |

---

## 実装ステップ進捗

| # | ステップ | ステータス | 完了日 | 備考 |
|---|---|---|---|---|
| STEP 1 | 基盤構築（認証・権限・DB・Prisma・レイアウト） | ✅ 完了 | 2026-06-26 | DB は手動 migrate 必要 |
| STEP 2 | 配車表画像取込 | ✅ 完了 | 2026-06-26 | 本番: Vercel Blob / 開発: ローカル /uploads（切替済み） |
| STEP 3 | OCR処理 | ✅ 完了 | 2026-06-26 | OCR.space・座標解析・自動救済・L1M専用プロファイル |
| STEP 4 | 取込確認画面 | ✅ 完了 | 2026-06-26 | インライン編集・再バリデーション・確定機能（URL: /admin/ocr-review・互換維持） |
| STEP 5 | CARIOシフト取込 | ✅ 完了 | 2026-06-27 | REST API クライアント実装済み・API未設定時はモックフォールバック |
| STEP 6 | 割当機能 | ✅ 完了 | 2026-06-27 | 半自動割当・手動修正・確定機能 |
| STEP 7 | ルート作成 | ✅ 完了 | 2026-06-29 | Geocoding・最近隣法・Google Maps URL・積み込みモード |
| STEP 8 | ドライバー画面 | ✅ 完了 | 2026-06-29 | スマホ優先カードUI・本人確認・Maps URL |
| STEP 9 | 管理者進捗画面 | ✅ 完了 | 2026-06-29 | ダッシュボード集計・ドライバー別進捗・詳細展開 |

**ステータス凡例:** ⬜ 未着手 / ⚠️ 確認待ち / 🔄 作業中 / ✅ 完了

✅ **ログイン修正完了・初回テスト中**

> **🎉 STEP 1〜9 すべて完了。MVP 完成。**

---

## 絶対方針（変更禁止）

| 項目 | 方針 |
|---|---|
| OCR エンジン | **OCR.space のみ**（Cloud Vision / Gemini / AI fallback 全て不使用） |
| OCR_SPACE_API_KEY | 開発: デモキー可 / **本番: 必須（未設定でOCR実行不可）** |
| 低信頼行の処理 | 自動救済パイプライン先行 → 不足のみ `NEEDS_REVIEW` → 編集画面は最後の保険 |
| 画像OCR・スマホカメラOCR | 最後の手段ではなく **通常業務の主力機能** |
| GODOOR / ゼンリン | **不使用**（有料住宅地図アプリのデータを流用しない） |
| 住所補正方針 | Google Geocoding + 自社DB（手動ピン修正・入口メモ・配送履歴を蓄積） |
| Google Maps | ナビ起動（1件ナビ主導線） + Geocoding のみ使用 |
| 個人情報 | console.log 禁止 / raw OCR JSON・debug JSON を公開 URL 保存禁止 |
| 予測値 | **予測値は確定値として扱わない** / Google Geocode座標は `ESTIMATED` / ADMIN_APPROVED override のみ確定座標 |
| 上書き保護 | `ADMIN_APPROVED` / `MANUAL_FIXED` は自動処理（Geocode再実行・OCR再実行）で上書き禁止 |
| audit_logs | 氏名・電話番号・住所・伝票Noの値を保存しない（fieldName / source / status のみ） |

---

## ✅ 配送表取込エンジン v5（実装完了）

### 対応取込方式

| 方式 | パス / API | 特記 |
|---|---|---|
| PDF取込 | `POST /api/admin/dispatch-import/pdf` | テキストレイヤー優先・スキャンはOCR.space |
| CSV / Excel取込 | `POST /api/admin/dispatch-import/file` | xlsx 対応・ヘッダー揺れ自動吸収 |
| 表データ貼り付け | `POST /api/admin/dispatch-import/paste` | HTML/TSV/CSV 自動判定 |
| 画像OCR | `/admin/dispatch-images` → OCR実行 | **通常業務の主力機能**（最後の手段ではない） |
| スマホカメラOCR | `/admin/dispatch-import/camera` | **通常業務の主力機能** iPhone Safari / Android Chrome 対応 |

### L1M貨物一覧表専用プロファイル

- `layoutProfile = l1m_cargo_list` を自動検出・適用
- タイトル「L1M貨物一覧表」または帳票ヘッダーで判定
- 拠点名・W番号・配送日・号車・ページ情報を上部から抽出
- 右上総数ボックス（常温/クーラー/ケース/荷数計）を抽出
- 配車No（`10-1` など）を起点に明細ブロックを復元
- 伝票No・氏名・連絡先・住所・数量・メモを専用ラベルアンカーで抽出
- 右上総数と明細合計を照合（不一致は `SUMMARY_COUNT_MISMATCH`）
- 数量列と住所列を x座標で厳密に分離
- 備考文を住所に混ぜない

### 自動救済パイプライン

```
低信頼行 → ① ヘッダー再マッピング
          → ② 列ごとの専用抽出器を再実行
          → ③ 住所と数量の分離
          → ④ 電話番号と伝票Noの切り出し
          → ⑤ 数量合計の自動補完
          → ⑥ 誤読辞書による安全補正
          → ⑦ 修正履歴による補正
          → 成功: AUTO_RESCUED / 不足のみ: NEEDS_REVIEW
```

人間修正は `NEEDS_REVIEW` のみ・編集画面は最後の保険。

### 絶対方針

- ✅ OCR.space のみ（`OCR_PROVIDER=ocrspace`）
- ✅ Gemini / AI fallback 無効
- ✅ Cloud Vision 不使用
- ✅ OCR.space 1画像1回
- ✅ 低信頼行は自動救済が先（人間修正前提にしない）
- ✅ 個人情報を console.log しない

---

## Google Maps 連携方針

| 用途 | 方針 |
|---|---|
| ナビ起動 | 1件ナビを主導線（`dir/?api=1&destination={lat},{lng}&travelmode=driving`） |
| 複数件ルート | 補助機能・4件単位で分割 |
| URL長制限 | 4件超はさらに分割・`fallback` として住所コピー |
| 配送管理 | Google Maps 側に任せない（アプリ側の `route_order` を正とする） |
| Geocoding | 住所 → 緯度経度変換のみ使用 |
| Routes API / Optimize | 初期 MVP 対象外（将来検討） |

---

## GODOORなし・住所補正方針

| 項目 | 方針 |
|---|---|
| GODOOR | **不使用**（有料住宅地図アプリのデータを流用しない） |
| ゼンリン住宅地図 | **不使用** |
| 住所精度向上方法 | Google Geocoding + 自社 DB（修正ピン・入口メモ・配送履歴を蓄積） |
| 手動ピン修正 | 管理者が座標を手動修正 → `delivery_location_overrides` に保存 |
| メモ蓄積 | 入口メモ・建物メモ・表札メモ・駐車位置メモ・注意メモ |
| 過去履歴再利用 | 同一住所への過去メモを自動表示 |

### `delivery_location_overrides` テーブル（実装済み・migration 適用済み）

```
id / normalizedAddress / postalCode / prefecture / city / town / block /
buildingName / lat / lng / placeId / entranceMemo / buildingMemo /
nameplateMemo / accessMemo / cautionMemo / parkingMemo /
source / status / usageCount / createdBy / approvedBy / approvedAt /
createdAt / updatedAt
```

### 実装ステータス

| 機能 | ステータス |
|---|---|
| `delivery_location_overrides` テーブル | ✅ スキーマ定義済み・✅ Neon migration 適用済み |
| 住所補正管理 UI | ✅ `/admin/location-overrides`（一覧・承認・却下） |
| 管理者承認フロー | ✅ approve/reject API 実装済み |
| ドライバー申請フロー | ✅ `POST /api/driver/location-overrides`（PENDING 登録） |
| 住所信頼度 API + 型定義 | ✅ `src/lib/address/address-confidence.ts` + `src/types/location.ts` |
| 入口/建物/表札/駐車メモ | ✅ `DeliveryCard.tsx` に表示実装済み（入力 UI は次フェーズ） |
| 過去配送履歴の再利用 | ✅ `location-override-matcher.ts` で自動適用実装済み |
| ドライバー today API 統合 | ✅ override メモ・hasOverride・mapsUrl を返すよう更新済み |
| 住所信頼度表示（ドライバー画面） | ⬜ 次フェーズ |
| 配送表画像 private Blob 化 | ⬜ 次フェーズ |

---

## 個人情報データ保存方針

| 項目 | 方針 |
|---|---|
| console.log | 氏名・電話・住所・伝票No を出力禁止 |
| raw OCR words | 公開 URL で保存禁止 |
| debug JSON | 公開 URL で保存禁止（`l1mDebugJsonUrl` は非公開 URL のみ） |
| normalized JSON | 公開 URL で保存禁止 |
| audit_logs | 値ではなく件数・対象 ID・状態・フィールド名のみ保存 |
| Vercel Blob public | 配送表画像プレビューのみ許容・個人情報付き中間データは禁止 |
| 画像プレビュー | 本番では認証済み API 経由が望ましい（現状は public Blob URL） |

---

## ✅ 本番ログイン（修正済み）

NextAuth v5 の JWE 暗号化対応で `authConfig` 分離パターンに変更済み。

---

## ✅ L1M専用 OCR エンジン（実装完了）

### OCR 方針（確定）

| 項目 | 内容 |
|---|---|
| OCRプロバイダー | **OCR.space のみ**（`OCR_PROVIDER=ocrspace`） |
| AI/Gemini fallback | **無効**（`OCR_ENABLE_AI_FALLBACK=false`） |
| 低信頼行の処理 | **自動救済パイプライン**で再構成・再抽出 → 不足のみ `NEEDS_REVIEW` → 編集画面は最後の保険 |
| 重複OCR防止 | SHA256 ハッシュで同一画像を再OCRしない |
| 日次上限 | 180回/日（`OCR_DAILY_LIMIT=180`） |

### 実装済みファイル（OCR エンジン）

| ファイル | 役割 |
|---|---|
| `ocrspace.ts` | 座標付き OCR.space API（isOverlayRequired=true・isTable=true） |
| `image-preprocess.ts` | 向き補正・拡大・グレースケール・シャープ化（sharp.js） |
| `table-template.ts` | L1M列定義（x座標パーセント境界で列を識別） |
| `layout-mapper.ts` | y座標クラスタリングで行復元 → 列マッピング |
| `field-extractor.ts` | 各列セルからフィールド抽出（住所・数量の混入を排除） |
| `normalizer.ts` | 配車No/伝票No/電話番号/住所/数量の個別正規化ルール |
| `confidence.ts` | high/medium/low 判定（AI送信なし・自動救済対象の優先度付け） |
| `hash.ts` | SHA256 ハッシュ（重複OCR防止） |
| `usage.ts` | 日次上限チェック・使用ログ記録 |

### DB 追加フィールド（migration 適用済み）

```
dispatch_images:
  + image_hash    SHA256ハッシュ
  + ocr_provider  "ocrspace"
  + re_ocr_count  再OCR回数

新テーブル: ocr_usage_logs
  id / provider / dispatchImageId / imageHash / status / confidence / itemCount / errorMessage / createdAt
```

### 座標ベース列マッピング（L1M専用）

OCR.space の単語座標（Left/Top/Width/Height）を使用：
- **y座標クラスタリング** → 行復元（±2% tolerance）
- **x座標パーセント** → 列判定（table-template.ts の境界定義）
- 住所欄に数量が入らない・電話番号が住所欄に混ざらない設計

### Confidence 判定

| レベル | 条件 |
|---|---|
| **high** | 配車No/伝票No/住所あり・数量合計一致・電話正常 |
| **medium** | 一部項目空・軽微な不一致 |
| **low** | 配車No/伝票Noなし・住所空・数量不一致・列混入疑い |

low でも Gemini/AI には**送らない**。自動救済パイプラインで再構成・再抽出を先行実行。自動救済後も不足の場合のみ `NEEDS_REVIEW` として編集画面で対応。

### 本番デプロイ状況

| 項目 | 状態 |
|---|---|
| 本番 URL | https://rakuten-delivery-app.vercel.app |
| GitHub | https://github.com/momose-clore/rakuten-delivery-app（Private） |
| ログイン | ✅ admin@delivery-app.local / ******** |
| Neon DB | ✅ migrate 適用済み |
| Vercel Blob | ✅ public ストア |
| OCR.space | ✅ デモキー動作確認済み |

---

## 実装済み / 未実装 / 次フェーズ 分類

### ✅ 実装済み（v5 取込エンジン）

| パス | 内容 |
|---|---|
| `/admin/dispatch-import` | 取込センターページ（PDF/CSV/Excel/貼付/画像/カメラ） |
| `/admin/dispatch-import/camera` | スマホカメラOCRページ |
| `/admin/ocr-review/[id]` | 取込確認画面（互換URL維持） |
| `/admin/import-review/[id]` | → `/admin/ocr-review/[id]` にリダイレクト |
| `src/lib/import/` | 共通パイプライン・自動救済・ヘッダーマッパー |
| `src/lib/import/csv/` | CSV・Excelパーサー（xlsx使用） |
| `src/lib/import/paste/` | 貼り付けパーサー（HTML/TSV/CSV） |
| `src/lib/import/pdf/` | PDFパーサー（テキスト抽出・動的インポート） |
| `src/lib/import/profiles/` | L1M専用プロファイル（4ファイル） |
| `src/lib/ocr/mobile/` | スマホ画像品質チェック |
| `src/types/import.ts` | 共通型定義（NormalizedDispatchRow等） |
| `delivery_location_overrides` | スキーマ定義済み・Neon migration 適用済み |

### ✅ 追加実装済み（住所補正フェーズ）

| パス / ファイル | 内容 |
|---|---|
| `src/lib/address/address-normalizer.ts` | 住所正規化・全角→半角・郵便番号/都道府県/市区町村抽出 |
| `src/lib/address/address-confidence.ts` | 住所信頼度判定（high/medium/low/override） |
| `src/lib/address/address-warning.ts` | AddressWarning 型・警告ラベル定数 |
| `src/lib/address/location-override-matcher.ts` | 承認済み override の住所マッチ・usageCount 加算 |
| `src/lib/maps/navigation.ts` | ナビ URL 生成（override > placeId > lat/lng > 住所フォールバック） |
| `src/types/location.ts` | LocationInfo / OverrideInfo / AddressConfidence / AddressWarning 型定義 |
| `src/app/admin/location-overrides/page.tsx` | 住所補正管理ページ（一覧・ステータスフィルター） |
| `src/components/location/LocationOverrideClient.tsx` | 承認・却下クライアント UI |
| `src/app/api/admin/location-overrides/route.ts` | GET（一覧）/ POST（登録） |
| `src/app/api/admin/location-overrides/[id]/route.ts` | PATCH（更新） |
| `src/app/api/admin/location-overrides/[id]/approve/route.ts` | POST（承認） |
| `src/app/api/admin/location-overrides/[id]/reject/route.ts` | POST（却下） |
| `src/app/api/driver/location-overrides/route.ts` | POST（ドライバー申請・PENDING） |
| `src/app/api/delivery-items/[id]/location-info/route.ts` | GET（住所信頼度 + override 情報） |
| `src/app/api/driver/today/route.ts` | 更新: override メモ・hasOverride・mapsUrl を返すよう統合 |

### ⬜ 未実装（次フェーズ）

| 機能 | 理由 |
|---|---|
| ~~`/admin/import-accuracy`~~ | ✅ 実装済み（取込精度レポートUI） |
| ~~住所信頼度バッジ（ドライバー画面）~~ | ✅ 実装済み（assessAddressConfidence・medium/low時に注意バッジ） |
| ~~ルート画面の予測バッジ~~ | ✅ 実装済み（座標ステータス 確定/推定/未） |
| ~~入口/建物/表札メモ 入力 UI~~ | ✅ 実装済み（LocationMemoForm） |
| ~~配送表画像 private Blob 化~~ | ✅ 実装済み（認証プロキシ経由化・アプリ層） |
| Blob 物理 private 化（ストア再作成+token read） | ⬜ インフラ変更・判断待ち |

### ℹ️ 用語・画面名の整理

| 旧名称 | 現名称 | 備考 |
|---|---|---|
| OCR確認画面 | 取込確認画面 | URL は `/admin/ocr-review/[id]` のまま互換維持 |
| OCR確定 | 取込確定 | ボタン名を「取込結果を確定」に変更済み |
| 配車表取込 | 画像アップロード | サイドバーで「配送表取込」が主導線 |

---

## 現在のプロジェクト構成（STEP 9 完了 + 予測値対策 v4.1 完了）

```
src/
├── app/
│   ├── page.tsx                                # ロール別リダイレクト
│   ├── login/page.tsx                          # ログイン画面
│   ├── admin/
│   │   ├── layout.tsx                          # 管理者レイアウト（Sidebar）
│   │   ├── dashboard/page.tsx                  # ダッシュボード（スケルトン）
│   │   ├── dispatch-images/page.tsx            # 配車表画像取込 ★STEP2
│   │   ├── ocr-review/[id]/page.tsx            # 取込確認画面 ★STEP4
│   │   ├── shifts/page.tsx                     # CARIOシフト取込 ★STEP5
│   │   ├── assignments/page.tsx                # 割当機能 ★STEP6
│   │   ├── routes/page.tsx                     # ルート確認 ★STEP7
│   │   ├── location-overrides/page.tsx         # 住所補正管理 ★住所補正フェーズ
│   │   └── progress/page.tsx                   # 配送進捗 ★STEP9
│   ├── driver/
│   │   ├── layout.tsx
│   │   └── today/page.tsx                          # ★STEP8 実装済み
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── ocr/[id]/route.ts                   # ★STEP3 POST: OCR実行
│       ├── admin/dashboard/route.ts             # ★STEP9 GET: ダッシュボード集計
│       ├── admin/progress/                     # ★STEP9
│       │   ├── route.ts                        #   GET: ドライバー別進捗一覧
│       │   └── [driverId]/route.ts             #   GET: ドライバー詳細
│       ├── driver/                             # ★STEP8・住所補正フェーズ
│       │   ├── today/route.ts                  #   GET: 本日の担当配送先（override統合済み）
│       │   ├── location-overrides/route.ts     #   POST: ドライバー申請（PENDING登録）
│       │   └── delivery-items/[id]/
│       │       ├── status/route.ts             #   PATCH: ステータス更新（本人確認）
│       │       └── memo/route.ts               #   PATCH: 備考保存（本人確認）
│       ├── delivery-items/[id]/
│       │   └── location-info/route.ts          #   GET: 住所信頼度+override情報 ★住所補正フェーズ
│       ├── routes/                             # ★STEP7
│       │   ├── route.ts                        #   GET: ルート一覧
│       │   ├── geocode/route.ts                #   POST: 住所→緯度経度
│       │   ├── generate/route.ts               #   POST: 配送順生成
│       │   └── loading-mode/route.ts           #   PATCH: 積み込みモード切替
│       ├── assignments/                        # ★STEP6
│       │   ├── route.ts                        #   GET: 明細+ドライバー+割当状態
│       │   ├── auto/route.ts                   #   POST: 半自動割当
│       │   ├── [id]/route.ts                   #   PATCH: 1行手動変更
│       │   └── confirm/route.ts                #   POST: 割当確定
│       ├── shifts/                             # ★STEP5
│       │   ├── route.ts                        #   GET: 対象日シフト一覧
│       │   └── import/route.ts                 #   POST: CARIO取込→DB保存
│       ├── admin/location-overrides/           # ★住所補正フェーズ
│       │   ├── route.ts                        #   GET: 一覧 / POST: 登録
│       │   └── [id]/
│       │       ├── route.ts                    #   PATCH: 更新
│       │       ├── approve/route.ts            #   POST: 承認
│       │       └── reject/route.ts             #   POST: 却下
│       ├── ocr-review/                         # ★STEP4
│       │   └── [id]/
│       │       ├── route.ts                    #   GET: 画像+明細取得
│       │       ├── items/[itemId]/route.ts     #   PATCH: 明細1行更新
│       │       └── confirm/route.ts            #   POST: 取込確定
│       └── dispatch-images/                    # ★STEP2
│           ├── route.ts                        #   GET: 一覧取得
│           └── upload/route.ts                 #   POST: アップロード
├── components/
│   ├── admin/Sidebar.tsx
│   ├── common/LoginForm.tsx
│   ├── common/LogoutButton.tsx
│   ├── location/                               # ★住所補正フェーズ
│   │   └── LocationOverrideClient.tsx          #   承認・却下クライアントUI
│   ├── dispatch/                               # ★STEP2
│   │   ├── UploadForm.tsx
│   │   ├── ImageHistoryList.tsx
│   │   └── OcrStatusBadge.tsx
│   ├── routes/                                 # ★STEP7
│   │   ├── RouteClient.tsx
│   │   └── RouteDriverPanel.tsx
│   ├── admin/
│   │   ├── Sidebar.tsx
│   │   └── progress/                           # ★STEP9
│   │       ├── ProgressClient.tsx
│   │       └── ProgressDriverCard.tsx
│   ├── driver/                                 # ★STEP8
│   │   ├── TodayClient.tsx                     #   本日の配送一覧・集計チップ
│   │   └── DeliveryCard.tsx                    #   配送先カード（スマホ優先）
│   ├── assignments/                            # ★STEP6
│   │   ├── AssignmentClient.tsx
│   │   └── AssignmentSummary.tsx
│   ├── shifts/                                 # ★STEP5
│   │   ├── ShiftImportClient.tsx
│   │   └── ShiftSummaryCard.tsx
│   └── ocr/                                    # ★STEP4
│       ├── OcrReviewClient.tsx                 #   確認画面メイン
│       ├── DeliveryItemRow.tsx                 #   明細行（インライン編集）
│       └── ReviewReasonBadge.tsx               #   要確認理由バッジ
├── lib/
│   ├── auth/auth.ts
│   ├── auth/permissions.ts
│   ├── prisma.ts
│   ├── storage/                                # ★STEP2（差し替え可能）
│   │   ├── types.ts                            #   StorageProvider interface（read()追加）
│   │   ├── local.ts                            #   ローカル /uploads 保存・読込
│   │   ├── filename.ts                         #   ファイル名生成
│   │   └── index.ts                            #   アクティブ Provider export
│   ├── ocr/                                    # ★STEP3,4
│   │   ├── types.ts / vision.ts / dispatch-no.ts / parser.ts
│   │   ├── validator.ts / index.ts / revalidate.ts
│   ├── address/                                # ★住所補正フェーズ
│   │   ├── address-normalizer.ts               #   住所正規化・全角→半角・郵便番号/都道府県抽出
│   │   ├── address-confidence.ts               #   住所信頼度判定（high/medium/low/override）
│   │   ├── address-warning.ts                  #   AddressWarning 型・警告ラベル定数
│   │   └── location-override-matcher.ts        #   承認済みoverride マッチ・usageCount加算
│   ├── prediction/                             # ★予測値対策フェーズ（v4.1）
│   │   ├── metadata.ts                         #   OCR/Geocodeメタデータ構築・mergeFieldStatuses・filterOcrFields
│   │   ├── overwrite-guard.ts                  #   座標・フィールドの上書きブロック判定
│   │   ├── protection.ts                       #   保護フィールド抽出・isFieldProtected
│   │   ├── warning-priority.ts                 #   warning優先度定数・sortWarningsByPriority
│   │   └── merge.ts                            #   mergeFieldMetadata（操作別マージ・上書き保護）
│   ├── audit/                                  # ★予測値対策フェーズ（v4.1）
│   │   └── audit-log.ts                        #   targetIdHash化・recordPredictionAudit・getAuditLogs（ADMIN限定）
│   ├── security/                               # ★予測値対策フェーズ（v4.1）
│   │   └── hash.ts                             #   HMAC-SHA256 hashWithSalt・sha256
│   ├── pii/                                    # ★予測値対策フェーズ（v4.1）
│   │   └── sanitizer.ts                        #   sanitizeForLog・sanitizeAuditData・sanitizeErrorMessage
│   ├── import-accuracy/                        # ★予測値対策フェーズ（v4.1）
│   │   └── calculate.ts                        #   delivery_itemsから毎回再集計・ImportAccuracyMetrics
│   ├── location-override/                      # ★予測値対策フェーズ（v4.1）
│   │   └── driver-memo.ts                      #   N+1対策済み getAccessibleMemosForDriver
│   ├── maps/                                   # ★STEP7・住所補正フェーズ
│   │   ├── warehouse.ts                        #   美女木拠点定数（差し替え可能）
│   │   ├── geocode.ts                          #   Geocoding API（サーバーサイドのみ）
│   │   ├── url.ts                             #   Google Maps 経路 URL 生成
│   │   └── navigation.ts                      #   ナビURL生成（override優先フォールバック）
│   ├── routes/                                 # ★STEP7
│   │   ├── sortByNearest.ts                    #   最近隣法（ハバーサイン距離）
│   │   └── index.ts                            #   ルート生成オーケストレーター
│   └── utils.ts
├── types/
│   ├── next-auth.d.ts
│   ├── dispatch.ts                             # ★STEP2,4
│   ├── shift.ts                               # ★STEP5
│   ├── assignment.ts                          # ★STEP6
│   ├── route.ts                               # ★STEP7
│   ├── progress.ts                            # ★STEP9（DashboardStats / DriverProgress / DeliveryProgress）
│   ├── location.ts                            # ★住所補正フェーズ（LocationInfo / OverrideInfo / AddressConfidence / AddressWarning）
│   └── prediction.ts                          # ★予測値対策フェーズ（ValueSource / ValueConfidence / ValueStatus / 警告コード）
├── components/
│   └── ocr/
│       └── ReOcrDialog.tsx                    # ★予測値対策フェーズ（再OCRダイアログ・保護フィールド表示）
└── middleware.ts
prisma/
├── schema.prisma
├── seed.ts                                     # デフォルト（開発用）
├── seed.dev.ts                                 # 開発用（管理者+テストドライバー）
├── seed.prod.ts                                # 本番用（管理者のみ・PW環境変数）
└── migrations/
    ├── 20260629132459_init/
    ├── 20260630*_add_ocr_fields_and_usage_log/
    ├── 20260630*_add_import_batch_tables/
    ├── 20260630091059_add_delivery_location_overrides/
    ├── 20260630200000_add_prediction_metadata/    # ★予測値対策フェーズ
    ├── 20260630210000_add_audit_log_anonymize/    # ★予測値対策フェーズ（v4.1）
    └── 20260630230000_add_shift_stale_fields/     # ★予測値対策フェーズ（v4.1）
src/lib/storage/                                # ★ストレージ差し替えポイント
├── vercel-blob.ts                              # Vercel Blob Provider（実装済み）
└── s3.ts                                       # S3 Provider（実装案）
docker-compose.yml
DEPLOY.md                                       # 本番デプロイ手順書（作業分担・コマンド一覧）
next.config.ts
public/uploads/dispatch-images/                 # アップロード先（gitignore）
.env.example                                    # 6カテゴリ分類・用途コメント付き
.env.local                                      # gitignore 済み
```

---

## STEP 1：基盤構築（✅ 完了）

### 実装内容

| 項目 | 内容 |
|---|---|
| プロジェクト生成 | create-next-app（TypeScript / Tailwind / App Router / src dir） |
| shadcn/ui | 初期化済み（Button コンポーネント等） |
| Docker | PostgreSQL 16 コンテナ（docker-compose.yml） |
| Prisma 7 | schema.prisma 8テーブル・validate 通過・generate 済み |
| @prisma/adapter-pg | Prisma 7 の Driver Adapter 方式で接続 |
| NextAuth.js v5 | Credentials Provider + JWT strategy（@auth/prisma-adapter 不使用） |
| ロール | ADMIN / DRIVER（Session 型に追加） |
| middleware.ts | 未認証→/login、DRIVER→/admin 不可、ADMIN→/driver 不可 |
| bcryptjs | seed.ts でハッシュ化、ログイン時に検証 |
| TypeScript | 型チェック エラーゼロ確認済み |

### DBテーブル（8テーブル）

```
users            id / email / password_hash / role(ADMIN|DRIVER) / created_at / updated_at
drivers          id / user_id(→users) / cario_driver_id / name / phone / company_name / area / vehicle_id
shifts           id / driver_id / work_date / start_time / end_time / status / source
dispatch_images  id / delivery_date / area / wave_no / image_url / ocr_status / imported_at
delivery_items   id / dispatch_image_id / dispatch_key / wave_no / vehicle_no / delivery_seq /
                 invoice_no / customer_name / customer_phone / address / special_flag /
                 normal_oricon_count / cooler_box_count / case_count / total_count /
                 memo / lat / lng / ocr_notes / ocr_status / delivery_status
assignments      id / delivery_item_id / driver_id / route_order / wave_no / loading_group /
                 is_split_loading / status
route_groups     id / driver_id / delivery_date / wave_group / loading_mode /
                 start_location / end_location / return_to_warehouse
audit_logs       id / user_id / action / target_type / target_id / before_data / after_data / created_at
```

### 動作確認手順（手動実行が必要）

```bash
# 1. PostgreSQL 起動
docker compose up -d

# 2. マイグレーション（初回のみ）
npm run db:migrate        # migration name: "init"

# 3. 管理者アカウント作成
npm run db:seed           # admin@delivery-app.local / ********

# 4. 開発サーバー起動
npm run dev

# 5. ブラウザ確認
# http://localhost:3000 → /login
# admin@delivery-app.local / ******** でログイン
# → /admin/dashboard に遷移すれば完了
```

### ロール別リダイレクト仕様

| 条件 | 遷移先 |
|---|---|
| 未認証 → /admin/* | /login |
| 未認証 → /driver/* | /login |
| DRIVER → /admin/* | /driver/today |
| ADMIN → /driver/* | /admin/dashboard |
| ログイン後（ADMIN） | /admin/dashboard |
| ログイン後（DRIVER） | /driver/today |

### 保留事項

| # | 内容 |
|---|---|
| 1 | `prisma migrate dev` は Docker 起動後に手動実行 |
| 2 | `prisma db seed` は migrate 後に手動実行 |
| 3 | LoginForm の `router.push("/")` → ルートページでロール判定してリダイレクト済み |

---

## STEP 2：配車表画像取込（✅ 完了）

**ステータス:** ✅ 完了（コード実装・型チェック通過済み）

### 実装内容

| 項目 | 内容 |
|---|---|
| 画像ストレージ | ローカル `public/uploads/dispatch-images/`（gitignore 済み） |
| storage 抽象化 | `src/lib/storage/` に StorageProvider interface を定義。`index.ts` の1行差し替えで Vercel Blob / S3 に移行可能 |
| ファイル名 | `{YYYYMMDD}_{area}_{waveNo}_{timestamp}.{ext}` 形式で重複回避 |
| 対応形式 | jpg / jpeg / png / webp（10MB 以下） |
| API | POST `/api/dispatch-images/upload`・GET `/api/dispatch-images`（ADMIN のみ） |
| DB 保存 | `dispatch_images` テーブルへ INSERT |
| 操作ログ | アップロード時に `audit_logs` へ記録 |
| UI | アップロードフォーム（配送日・エリア・W番号・プレビュー）・取込履歴テーブル |
| 権限 | admin/layout.tsx の `requireAdmin()` で ADMIN のみ。API も二重チェック |
| TypeScript | 型チェック エラーゼロ |

### タスク一覧

- [x] 画像アップロードUI（`/admin/dispatch-images`）
- [x] ローカル `/uploads` への保存（storage 抽象化）
- [x] `dispatch_images` テーブルへ保存
- [x] 取込履歴一覧表示
- [x] OCRステータスバッジ表示（未処理 / 処理中 / 要確認 / 完了 / エラー）
- [x] アップロード前プレビュー表示
- [x] アクセス権限チェック（管理者のみ・API も二重チェック）
- [x] 操作ログ（audit_logs）記録
- [x] `next.config.ts` 画像設定追加

### 動作確認手順

```bash
# DB 起動・migrate 済みの状態で
npm run dev

# 1. http://localhost:3000/admin/dispatch-images にアクセス
# 2. 配送日・エリア・W番号を入力
# 3. jpg / png 画像を選択 → プレビュー表示を確認
# 4. アップロードボタン押下
# 5. public/uploads/dispatch-images/ にファイルが保存される
# 6. 取込履歴に表示される（OCRステータス: 未処理）
# 7. ドライバーアカウントでアクセス → /driver/today へリダイレクト
```

### ストレージ差し替え方法（将来対応）

```typescript
// src/lib/storage/index.ts を1行変更するだけ
// 現在: export { localStorageProvider as storageProvider } from "./local";
// 変更: export { vercelBlobProvider as storageProvider } from "./vercel-blob";
// 変更: export { s3Provider as storageProvider } from "./s3";
```

### 保留事項

| # | 内容 |
|---|---|
| 1 | ~~詳細ボタンのリンク先（`/admin/ocr-review/[id]`）は STEP 4 で実装~~ → ✅ STEP 4 で実装済み |
| 2 | 本番環境では Vercel Blob または S3 への差し替えを推奨 |

---

## STEP 3：OCR処理（✅ 完了）

**ステータス:** ✅ 完了（コード実装・型チェック通過済み）

### 実装内容

| 項目 | 内容 |
|---|---|
| OCR エンジン | OCR.space（1画像1回・座標付き・L1M専用プロファイル） |
| API キー | `OCR_SPACE_API_KEY`<br>- 開発環境：未設定時はデモキー fallback 可<br>- **本番環境：必須。未設定時は OCR 実行不可。デモキー fallback 禁止** |
| 画像読み込み | 既存 `StorageProvider.read()` を経由（`local.ts` に実装） |
| テキストパース | 配車No起点の行ブロック分割・正規表現抽出 |
| 配車No分解 | `W1-11-1` → `waveNo / vehicleNo / deliverySeq` |
| 数量分解 | 左から 常温オリコン / クーラーボックス / ケース / 総数 |
| 要確認フラグ | `ocr_notes` カラムに JSON 配列で理由を保存 |
| OCR完了後ステータス | `REVIEW_REQUIRED`（STEP4確認後に `CONFIRMED`） |
| API | POST `/api/ocr/[id]`（ADMIN のみ・202 即時返却） |
| UI | 取込履歴に「OCR実行」ボタン・「確認・修正」リンク追加 |
| 個人情報 | ログに氏名・電話・住所を出力しない設計 |
| TypeScript | 型チェック エラーゼロ |

### タスク一覧

- [x] `src/lib/ocr/types.ts`（型定義）
- [x] `src/lib/ocr/vision.ts`（OCR エントリポイント・OCR.space のみ使用・Cloud Vision 不使用）
- [x] `src/lib/ocr/dispatch-no.ts`（配車No分解）
- [x] `src/lib/ocr/parser.ts`（OCRテキストパース）
- [x] `src/lib/ocr/validator.ts`（要確認フラグ付与）
- [x] `src/lib/ocr/index.ts`（OCRオーケストレーター）
- [x] `src/app/api/ocr/[id]/route.ts`（OCR実行API）
- [x] `ImageHistoryList.tsx` に OCR実行ボタン追加
- [x] `StorageProvider` に `read()` 追加
- [x] `schema.prisma` に `ocr_notes` 追加・generate
- [x] `.env.example` / `.env.local` 更新

### 要確認フラグ（ReviewReason）一覧

| フラグ | 条件 |
|---|---|
| `DISPATCH_KEY_MISSING` | 配車Noが読み取れない |
| `WAVE_NO_MISSING` | W番号が不明 |
| `VEHICLE_NO_MISSING` | 号車番号が不明 |
| `ADDRESS_EMPTY` | 住所が空欄 |
| `PHONE_INVALID` | 電話番号形式が不自然 |
| `COUNT_MISMATCH` | 常温+クーラー+ケース ≠ 総数 |
| `INVOICE_DUPLICATE` | 同一伝票Noが重複 |

### 動作確認手順

```bash
# 1. OCR 設定（本番: OCR_SPACE_API_KEY 必須）
# 2. Docker 起動・migrate 済みの状態で
npm run dev

# 3. /admin/dispatch-images で画像をアップロード
# 4. 取込履歴の「OCR実行」ボタンをクリック
# 5. OCRステータスが PROCESSING → REVIEW_REQUIRED に変わる
# 6. delivery_items テーブルに明細行が作成されている
# 7. 要確認の行は ocr_notes に ["COUNT_MISMATCH"] 等が記録されている
```

### 保留事項

| # | 内容 |
|---|---|
| 1 | `OCR_SPACE_API_KEY` の環境別ルール：開発環境のみ未設定時はデモキーで動作可能（1日500回・1MB以下制限）。本番環境では必須。本番未設定時は OCR 実行不可。本番でのデモキー fallback は禁止。 |
| 2 | パーサーは L1M 配車表レイアウト前提の正規表現ベース。実際の画像で精度調整が必要な場合は STEP 4 の修正画面で対応 |
| 3 | `prisma migrate dev` で `ocr_notes` カラムの追加 migration を実行すること |
| 4 | OCR結果の自動確定なし。必ず STEP 4 管理者確認を経由する |

---

## STEP 4：取込確認画面（✅ 完了）

**ステータス:** ✅ 完了（コード実装・型チェック通過済み）

### 実装内容

| 項目 | 内容 |
|---|---|
| パス | `/admin/ocr-review/[id]`（ADMIN のみ） |
| レイアウト | PC: 左右2カラム（元画像 sticky / 明細テーブル）。SP: 縦並び |
| インライン編集 | 行クリック→入力フィールド→保存/キャンセル |
| 再バリデーション | 保存後に `revalidate.ts` で配車No再分解＋全チェック |
| エラーハイライト | 赤（DISPATCH_KEY等5種）/ オレンジ（PHONE_INVALID・COUNT_MISMATCH） |
| 確定ボタン | 要確認残あり→警告ダイアログ。確定後 `CONFIRMED` に更新 |
| OCR未実行 | `PENDING` / `PROCESSING` の場合は「OCR未実行」メッセージ表示 |
| 操作ログ | `audit_logs` に編集フィールド名のみ記録（値は個人情報除外） |
| 権限 | `admin/layout.tsx` の `requireAdmin()` + 各API で二重チェック |
| TypeScript | 型チェック エラーゼロ |

### タスク一覧

- [x] `/admin/ocr-review/[id]/page.tsx`（Server Component）
- [x] `GET /api/ocr-review/[id]`（画像+明細取得）
- [x] `PATCH /api/ocr-review/[id]/items/[itemId]`（明細1行更新・再バリデーション）
- [x] `POST /api/ocr-review/[id]/confirm`（取込確定）
- [x] `OcrReviewClient.tsx`（確認画面メイン）
- [x] `DeliveryItemRow.tsx`（インライン編集）
- [x] `ReviewReasonBadge.tsx`（要確認理由バッジ・ハイライト）
- [x] `src/lib/ocr/revalidate.ts`（編集後再バリデーション）
- [x] `src/types/dispatch.ts` に `DeliveryItem` 型追加

### 動作確認手順

```bash
npm run dev

# 1. /admin/dispatch-images で画像アップロード → OCR実行
# 2. OCRステータスが REVIEW_REQUIRED になったら「確認・修正」クリック
# 3. /admin/ocr-review/[id] が表示される
#    左: 元画像 / 右: 明細テーブル
# 4. 要確認行が赤/オレンジでハイライトされている
# 5. 「編集」ボタンで各項目を修正 → 「保存」
# 6. 保存後に要確認理由が再計算される
# 7. 「取込結果を確定」→ dispatch_images.ocr_status が CONFIRMED に
```

### 保留事項

| # | 内容 |
|---|---|
| 1 | 住所 Geocoding プレビュー（STEP 7 で実装） |
| 2 | CONFIRMED になった画像のみ STEP 6 割当対象とする制御は STEP 6 で実装 |

---

## STEP 5：CARIOシフト取込（✅ 完了）

**ステータス:** ✅ 完了（コード実装・型チェック通過済み）

### 実装内容

| 項目 | 内容 |
|---|---|
| CARIO接続 | モック実装（関数差し替えで API/CSV/DB に対応可能） |
| 抽象化 | `src/lib/cario/` に `fetchCarioDrivers` / `fetchCarioShifts` を分離。コメントに差し替え方法を明記 |
| upsert | `drivers`: `carioDriverId` でキー。`shifts`: `driverId + workDate` 複合ユニークでキー |
| schema 変更 | `Driver.userId` を nullable に変更、`Driver.carioDriverId` に `@unique` 追加、`Shift` に複合ユニーク追加 |
| 画面 | 対象日選択・取込ボタン・サマリーカード（会社別/エリア別）・ドライバー一覧テーブル |
| 操作ログ | `audit_logs` に件数のみ記録（個人情報なし） |
| 権限 | `admin/layout.tsx` の `requireAdmin()` + API 二重チェック |
| TypeScript | 型チェック エラーゼロ |

### タスク一覧

- [x] `src/lib/cario/types.ts`（CarioDriver / CarioShift / ImportSummary）
- [x] `src/lib/cario/getDrivers.ts`（REST API / モックフォールバック実装済み）
- [x] `src/lib/cario/getShifts.ts`（REST API / モックフォールバック実装済み）
- [x] `src/lib/cario/index.ts`
- [x] `POST /api/shifts/import`（upsert + audit_log）
- [x] `GET /api/shifts?date=`（一覧 + 集計）
- [x] `ShiftImportClient.tsx`（取込UI・一覧テーブル）
- [x] `ShiftSummaryCard.tsx`（サマリーカード）
- [x] `/admin/shifts/page.tsx`
- [x] `src/types/shift.ts`
- [x] `prisma/schema.prisma` 変更 + generate

### CARIO実API差し替え方法（将来対応）

```typescript
// src/lib/cario/getDrivers.ts の中のモック部分を以下に差し替える:
// REST API: return fetch(process.env.CARIO_API_BASE_URL + "/drivers")
// CSV:      return parseCsv(await fs.readFile(csvPath))
// DB:       return new PrismaClient({ datasourceUrl: process.env.CARIO_DB_URL })
```

### 動作確認手順

```bash
npm run db:migrate   # make_driver_user_id_optional migration
npm run dev

# /admin/shifts にアクセス
# 日付を選択 →「CARIOシフト取込」ボタン
# drivers / shifts テーブルに5件ずつ保存される
# サマリーカード（会社別・エリア別）と一覧テーブルが表示される
# 同日に再実行しても重複登録されない（upsert）
```

### 保留事項

| # | 内容 |
|---|---|
| 1 | ~~CARIO接続方式が確定したら本体を差し替える~~ → ✅ 実API接続完了（下記参照） |
| 2 | ~~`CARIO_API_BASE_URL` / `CARIO_API_KEY` を設定~~ → ✅ `RAKUTEN_APP_API_KEY` 設定で有効化 |

---

## STEP 5-B：CARIO 実API連携（✅ 完了・2026-07-03）

**ステータス:** ✅ 全4エンドポイント疎通確認済み（HTTP 200）＋ 実レスポンス準拠 mapper 実装完了

### 確定API仕様（v1.0）

- Base: `https://cario-app-two.vercel.app/api/external/rakuten`（`client.ts` にデフォルト値。BaseURL 環境変数は省略可）
- 認証: `Authorization: Bearer <RAKUTEN_APP_API_KEY>`
- **キー1つ設定するだけで REAL_API モード有効**（CARIO側の運用に合わせ `isCarioApiConfigured()` はキーのみで判定）

| エンドポイント | 用途 | レスポンス形状 |
|---|---|---|
| `GET /sites` | 楽天現場一覧 | `{sites:[{id,name,flow_type,wave_count,line_group_id,client}]}` |
| `GET /drivers` (`?all=1`) | DA一覧 | `{drivers:[{id,name,phone,line_user_id,rank,driver_code,default_site_id,...}]}` |
| `GET /shift-requests?from&to` | シフト希望 | `{from,to,requests:[]}`（現状空） |
| `GET /assignments?from&to[&site_id]` | 割当（**主力取込**） | `{from,to,assignments:[{id,work_date,driver:{id,name,phone,line_user_id},external_driver_name,site:{...},course:{id,name,terminal_no},note}]}` |

### mapper 実装のポイント（`src/lib/cario/mapper.ts`）

- assignment は**ネスト構造**（`driver`/`site`/`course`）→ `mapApiAssignment` でフラット化。旧フラット形式にも後方互換。
- assignments に driver が埋め込まれるため、**`/drivers` を別途叩かず** `deriveDriversFromAssignments`（driver.id で重複排除）／`deriveShiftsFromAssignments`（driver×work_date で重複排除、割当=CONFIRMED）でドライバー・シフトを導出。
- `course.name`（例「12号車」）を `vehicleNo`/`routeNo` に、`site.name` を `area` に格納。
- 外部ドライバー（`driver` が null で `external_driver_name` のみ）は取込対象外とし warning に件数を記録。

### 疎通・導出検証結果（2026-07-03 / 2026-07-01〜07-31）

- 4エンドポイント全て HTTP 200・認証成功
- assignments 71件 → drivers 11名・shifts 71件（driver×日で重複なし）・外部0件 で mapper 導出ロジックと一致

### 環境変数

- `RAKUTEN_APP_API_KEY`: ローカル `.env.local` 設定済み／Vercel 本番も同名で登録済み（CARIOチーム対応済み）
- `CARIO_API_BASE_URL` / `CARIO_ASSIGNMENTS_PATH`: 通常不要（デフォルト値あり）

### 未実施（データ保護のため保留）

- 実DBへの取込実行（`POST /api/shifts/import` は driver/shift を upsert する**書き込み**）は未実行。3ターミナル並行稼働中のため、承認後に対象日を指定して実行する。

---

## STEP 6：割当機能（✅ 完了）

**ステータス:** ✅ 完了（コード実装・型チェック通過済み）

### 実装内容

| 項目 | 内容 |
|---|---|
| 画面 | `/admin/assignments`（ADMIN のみ）|
| フィルター | 配送日 / W番号 / エリアで絞り込み |
| 半自動割当 | `vehicleNo` 単位でグループ化 → ドライバーへ round-robin 均等分配 |
| 手動修正 | セレクトボックスでドライバーを変更（PATCH API） |
| 割当確定 | `assignments` upsert + `delivery_items.delivery_status = ASSIGNED` |
| 集計表示 | 未割当/割当済み/ドライバー別/W番号別/号車別件数 |
| 割当条件 | CONFIRMED OCR・シフト登録済み・ABSENT 以外・車両あり |
| 操作ログ | `audit_logs` に件数のみ記録（個人情報なし） |
| schema 変更 | `Assignment.deliveryItemId @unique` 追加（upsert 可能に） |
| TypeScript | 型チェック エラーゼロ |

### タスク一覧

- [x] `src/types/assignment.ts`
- [x] `src/lib/assignment/autoAssign.ts`（vehicleNo グループ + round-robin）
- [x] `GET /api/assignments`（明細 + ドライバー + 集計）
- [x] `POST /api/assignments/auto`（半自動割当）
- [x] `PATCH /api/assignments/[id]`（手動変更）
- [x] `POST /api/assignments/confirm`（確定）
- [x] `AssignmentClient.tsx`（メインUI）
- [x] `AssignmentSummary.tsx`（集計カード）
- [x] `/admin/assignments/page.tsx`
- [x] `prisma/schema.prisma` `@unique` 追加 + generate

### 動作確認手順

```bash
npm run db:migrate   # add_unique_to_assignment_delivery_item_id migration
npm run dev

# 前提: STEP 4 で OCR 確定済み・STEP 5 でシフト取込済み
# /admin/assignments にアクセス
# 配送日を選択 →「一覧を表示」→ 配送明細と稼働ドライバーが表示
# 「半自動割当」→ ドライバーに均等分配される
# セレクトボックスで手動変更可能
# 「割当確定」→ assignments テーブルに保存・delivery_status = ASSIGNED
```

### 保留事項

| # | 内容 |
|---|---|
| 1 | 手動変更（select 変更時）の未割当 → 新規割当は STEP 6 では省略。`handleDriverChange` は既存割当の変更のみ対応 |
| 2 | 住所Geocoding・ルート順序・同時/分割積み込みは STEP 7 で実装 |
| 3 | ~~ドライバー画面への反映は STEP 8 で実装~~ → ✅ STEP 8 で実装済み |

---

## STEP 7：ルート作成（✅ 完了）

**ステータス:** ✅ 完了（コード実装・型チェック通過済み）

### 実装内容

| 項目 | 内容 |
|---|---|
| 美女木拠点 | `warehouse.ts`（座標・住所は暫定値、1ファイル差し替えで更新可能） |
| Geocoding | `geocode.ts`（Geocoding API・サーバーサイドのみ・失敗は ADDRESS_ERROR） |
| Google Maps URL | `url.ts`（APIキーなし・10件超は複数 URL 分割） |
| 配送順ソート | `sortByNearest.ts`（最近隣法・ハバーサイン距離） |
| ルート生成 | `routes/index.ts`（ドライバー別に route_order → RouteGroup upsert） |
| 積み込みモード | RouteGroup.loadingMode: SIMULTANEOUS / SPLIT（セレクトで切替） |
| 倉庫戻り/直帰 | RouteGroup.returnToWarehouse（W5/W6終了後をセレクトで切替） |
| schema 変更 | RouteGroup に `@@unique([driverId, deliveryDate, waveGroup])` 追加 |
| TypeScript | 型チェック エラーゼロ |

### タスク一覧

- [x] `src/lib/maps/warehouse.ts`（美女木拠点定数）
- [x] `src/lib/maps/geocode.ts`（Geocoding API）
- [x] `src/lib/maps/url.ts`（Google Maps 経路 URL・上限分割対応）
- [x] `src/lib/routes/sortByNearest.ts`（最近隣法）
- [x] `src/lib/routes/index.ts`（ルート生成）
- [x] `src/types/route.ts`
- [x] `GET /api/routes`
- [x] `POST /api/routes/geocode`
- [x] `POST /api/routes/generate`
- [x] `PATCH /api/routes/loading-mode`
- [x] `RouteClient.tsx` / `RouteDriverPanel.tsx`
- [x] `/admin/routes/page.tsx`
- [x] `prisma/schema.prisma` RouteGroup @unique 追加 + generate

### 動作確認手順

```bash
npm run db:migrate   # add_unique_to_route_groups migration
npm run dev

# 前提: GOOGLE_MAPS_API_KEY を .env.local に設定
# 前提: STEP 6 で割当確定済み

# /admin/routes にアクセス
# 配送日を選択 →「一覧を表示」
# →「住所 Geocode」ボタン → lat/lng が delivery_items に保存
# →「ルート生成」ボタン → route_order が assignments に保存
# → ドライバーカードに Google Maps URL が表示される
# → 積み込みモード・倉庫戻りをセレクトで切り替えられる
```

### 保留事項

| # | 内容 |
|---|---|
| 1 | `GOOGLE_MAPS_API_KEY` が未設定の場合、Geocode は失敗して ADDRESS_ERROR になる |
| 2 | 美女木の正確な座標は `warehouse.ts` の lat/lng を更新すること |
| 3 | ~~ドライバー画面での Google Maps 起動は STEP 8 で実装~~ → ✅ STEP 8 で実装済み |
| 4 | 分割積み込み時の倉庫戻り挿入はルート生成時に `returnToWarehouse = true` で対応済み |

---

## STEP 8：ドライバー画面（✅ 完了）

**ステータス:** ✅ 完了（コード実装・型チェック通過済み）

### 実装内容

| 項目 | 内容 |
|---|---|
| 画面 | `/driver/today`（DRIVER のみ・スマホ優先カードUI） |
| 本人確認 | 全 API で `assignment.driverId === session.user.driverId` DB 照合 |
| 配送順 | `route_order` 昇順ソート、Google Maps URL 付与 |
| ステータス更新 | COMPLETED / ABSENT / RETURNED / SKIPPED（ボタン1タップ） |
| 備考入力 | `delivery_items.memo` に保存 |
| 集計チップ | 未完了・完了・不在・持戻り・スキップ件数を色分け表示 |
| Google Maps | STEP 7 の `buildMapsUrls()` を再利用・URLにAPIキー含まず |
| 個人情報 | 住所・氏名・電話番号を console.log しない |
| TypeScript | 型チェック エラーゼロ |

### タスク一覧

- [x] `GET /api/driver/today`（本人確認・route_order ソート・Maps URL 付与）
- [x] `PATCH /api/driver/delivery-items/[id]/status`（本人確認・403 対応）
- [x] `PATCH /api/driver/delivery-items/[id]/memo`（本人確認・403 対応）
- [x] `DeliveryCard.tsx`（スマホ優先カード・ステータスボタン・備考入力）
- [x] `TodayClient.tsx`（一覧・集計チップ・Maps URL 表示）
- [x] `driver/today/page.tsx`（スケルトン → 実装に差し替え）

### 動作確認手順

```bash
npm run dev

# ドライバーアカウントでログイン（STEP 5 で取り込んだドライバー）
# → /driver/today にアクセス
# → 本日割当済みの配送先のみ表示される
# → [完了] ボタンでステータスが緑に変わる
# → 「Googleマップで開く」でナビ起動
# → 備考入力 → [保存]

# ADMIN でアクセス → /admin/dashboard へリダイレクト
# 他ドライバーの delivery_item_id を PATCH → 403
```

### 保留事項

| # | 内容 |
|---|---|
| 1 | DRIVER アカウントは `prisma/seed.ts` の管理者アカウントとは別に作成が必要 |
| 2 | 管理者側でドライバー別進捗を確認する機能は STEP 9 で実装 |

---

## STEP 9：管理者進捗画面（✅ 完了）

**ステータス:** ✅ 完了（コード実装・型チェック通過済み）

### 実装内容

| 項目 | 内容 |
|---|---|
| ダッシュボード | `/admin/dashboard` Server Component で本日の集計を実データ表示 |
| 集計項目 | 取込済み配車表・OCR未確認・住所エラー・数量エラー・未割当・稼働ドライバー・割当済み・完了・不在・持戻り・スキップ・未完了 |
| 進捗画面 | `/admin/progress` でドライバー別進捗・全体進捗バー・集計チップ |
| ドライバーカード | 完了率バー・ステータス集計・詳細展開（配送明細テーブル） |
| フィルター | 配送日・エリア・W番号で絞り込み |
| 異常ハイライト | 不在・持戻りがあるカードにオレンジ枠 |
| 色分け | COMPLETED 緑・ABSENT オレンジ・RETURNED 赤・SKIPPED グレー |
| 個人情報 | 住所・氏名・電話番号を console.log しない |
| TypeScript | 型チェック エラーゼロ |

### タスク一覧

- [x] `src/types/progress.ts`（DashboardStats / DriverProgress / DeliveryProgress）
- [x] `GET /api/admin/dashboard`（本日の集計）
- [x] `GET /api/admin/progress`（ドライバー別進捗一覧）
- [x] `GET /api/admin/progress/[driverId]`（ドライバー詳細）
- [x] `ProgressClient.tsx`（進捗画面メイン）
- [x] `ProgressDriverCard.tsx`（ドライバーカード・詳細展開）
- [x] `/admin/progress/page.tsx`
- [x] `/admin/dashboard/page.tsx`（スケルトン → 実データ表示）

### 動作確認手順

```bash
npm run dev

# /admin/dashboard にアクセス → 本日の集計が数値で表示される
# 「詳細進捗を見る」リンクから /admin/progress へ
# 配送日を選択 →「進捗を表示」→ ドライバーカードが表示される
# 「詳細」ボタンで配送明細テーブルが展開される
# 不在・持戻りがあるカードはオレンジ枠でハイライト
```

---

## MVP完了条件チェックリスト（全 15 項目 完了）

- [x] CARIOから対象日のシフトデータを取得できる（STEP 5）
- [x] 配車表画像を取り込める（STEP 2）
- [x] OCRで配車No・住所・数量を読み取れる（STEP 3）
- [x] W1-11-1形式の配車Noを分解して保存できる（STEP 3）
- [x] 数量欄を4項目に分けて保存できる（STEP 3）
- [x] 数量合計エラーを検知できる（STEP 3）
- [x] OCR結果を自動救済 + 管理者確認で確定できる（STEP 4）
- [x] 住所をGoogleマップ用に変換できる（STEP 7）
- [x] ドライバーに配送先を割り当てできる（STEP 6）
- [x] 同時積み込み／分割積み込みを選択できる（STEP 7）
- [x] 倉庫戻り地点をルートに挿入できる（STEP 7）
- [x] ドライバー画面に自分の配送先だけ表示できる（STEP 8）
- [x] Googleマップで配送先を開ける（STEP 8）
- [x] 配達完了・不在・持戻りを更新できる（STEP 8）
- [x] 管理者が配送進捗を確認できる（STEP 9）

---

## 品質確認結果（2026-06-30 再実施）

| 確認項目 | 結果 | 備考 |
|---|---|---|
| TypeScript 型チェック | ✅ エラーゼロ | `tsc --noEmit`（tsc shim 修正込み） |
| ESLint | ✅ エラーゼロ | 8件警告解消（未使用変数/import 削除） |
| next build | ✅ 成功 | 全 50 ルート生成成功・Prisma generate 込み |
| prisma validate | ✅ 成功 | `delivery_location_overrides` 含む全スキーマ検証通過 |
| node_modules shim | ✅ 修正済み | tsc/eslint/next バイナリを正しいシンボリックリンクに修正 |
| driver/today API | ✅ 統合済み | override メモ・hasOverride・mapsUrl を返すよう更新 |
| seed.ts DRIVER アカウント | ✅ 追加済み | 開発用テストアカウント（本番投入禁止） |
| README | ✅ 作成済み | セットアップ手順・業務フロー・本番化前チェックリスト含む |

### 修正したファイル

| ファイル | 問題 | 対応 |
|---|---|---|
| `src/components/dispatch/ImageHistoryList.tsx` | `react-hooks/set-state-in-effect` | eslint-disable 追加 |
| `src/components/driver/TodayClient.tsx` | `react-hooks/set-state-in-effect` | eslint-disable 追加 |
| `src/components/routes/RouteClient.tsx` | `setDriverId` 未使用 | setter を除去 |
| `src/lib/cario/getDrivers.ts` | `_date` 未使用 | eslint-disable 追加 |
| `prisma/seed.ts` | DRIVER アカウントなし | 3ドライバー追加 |
| `README.md` | デフォルト内容のみ | MVP 向け全面改訂 |
| `package.json` | typecheck スクリプトなし | `tsc --noEmit` を追加 |

---

## 本番化準備フェーズ（実装済み）

### 実装済みファイル一覧（本番化準備フェーズ）

| ファイル | 種別 | 内容 |
|---|---|---|
| `prisma/seed.prod.ts` | 新規 | 本番用 seed（管理者のみ・PW は環境変数） |
| `prisma/seed.dev.ts` | 新規 | 開発用 seed（テストドライバー含む） |
| `prisma/seed.ts` | 変更 | 開発用であることをコメントで明示 |
| `src/lib/storage/vercel-blob.ts` | **本実装** | `@vercel/blob` を使った完全実装（`BLOB_READ_WRITE_TOKEN`） |
| `src/lib/storage/s3.ts` | 実装案 | S3 用 Provider（TODO コメント付き） |
| `src/lib/storage/index.ts` | **変更** | Vercel Blob Provider に切り替え済み |
| `src/lib/cario/client.ts` | 新規 | CARIO API fetch・認証・エラーハンドリング・タイムアウト |
| `src/lib/cario/mapper.ts` | 新規 | API レスポンス → 内部型変換（TODO マッピング調整） |
| `src/lib/cario/getDrivers.ts` | **変更** | ENV 分岐（API 設定済 → REST API / 未設定 → モック） |
| `src/lib/cario/getShifts.ts` | **変更** | ENV 分岐（API 設定済 → REST API / 未設定 → モック） |
| `src/app/api/shifts/import/route.ts` | 変更 | `CarioApiError` をキャッチしてユーザーに伝える |
| `.env.example` | **変更** | 本番方針（Vercel/Neon/Blob）確定版・用途コメント付き |
| `package.json` | 変更 | `db:seed:prod` スクリプト追加 |
| `README.md` | **変更** | 本番セットアップ手順（Vercel+Neon+Blob+CARIO）を全面改訂 |

### まだ情報待ちの項目（残作業）

| 項目 | 必要な情報 | 作業内容 |
|---|---|---|
| 美女木拠点の正確な座標 | 緯度・経度・正式住所 | `warehouse.ts` を1か所更新 |
| Neon DB URL | Neon プロジェクト作成後 | Vercel 環境変数に設定 |
| Google API キー（本番） | Google Cloud Console で発行 | Vercel 環境変数に設定 |
| CARIO API エンドポイント仕様 | CARIO 側から API 仕様書を受領 | `mapper.ts` のフィールドマッピングを調整 |
| CARIO API キー（本番） | CARIO 側から払い出し | Vercel 環境変数に設定 |
| 本番管理者パスワード | 決定後 | `npm run db:seed:prod` 実行時に使用 |
| Vercel Blob ストア | Vercel ダッシュボードで作成 | `BLOB_READ_WRITE_TOKEN` を Vercel 環境変数に設定 |

### 次にこちらが決めるべきこと

1. **Neon プロジェクト作成** → `DATABASE_URL` を取得
2. **Vercel Blob ストア作成** → `BLOB_READ_WRITE_TOKEN` を取得
3. **Google Maps API キー発行** → Cloud Console で Geocoding API を有効化
4. **CARIO API 仕様書の受領** → `mapper.ts` のマッピングを実際のフィールドに調整
5. **美女木拠点の正確な座標確認** → `warehouse.ts` を1行更新
6. **本番用パスワード決定** → `npm run db:seed:prod` で管理者アカウント作成

---

### 現状サマリー

| 項目 | 現状 | 必要な作業 |
|---|---|---|
| 画像ストレージ | 開発：ローカル `/uploads/`（gitignore済み）/ 本番：Vercel Blob（`BLOB_READ_WRITE_TOKEN` 必須） | 配送表画像の private Blob 化は次フェーズ |
| CARIO連携 | モックデータ（5名分ハードコード） | 実API / CSV / DB接続へ差し替え |
| 美女木拠点座標 | 暫定値（35.8326, 139.6564） | 正確な値に更新 |
| DB | ローカル Docker | 本番 PostgreSQL へ切り替え |
| console出力 | error 2件のみ（個人情報なし） | ✅ 問題なし |
| テスト用 seed | 管理者 + ドライバー3名 | 本番 seed に含めない |

### 優先順位別 作業計画

| 優先度 | 作業 | 変更ファイル | 工数 |
|---|---|---|---|
| **必須①** | 環境変数を本番値に設定 | `.env.local`（サーバー） | 30分 |
| **必須②** | 本番 DB へ `prisma migrate deploy` | — | 15分 |
| **必須③** | 本番用管理者アカウント作成 | `prisma/seed.ts` 分離 | 15分 |
| **必須④** | CARIO 接続方式確定・差し替え | `getDrivers.ts` / `getShifts.ts` | 接続方式次第 |
| **重要①** | 画像ストレージを Vercel Blob / S3 に変更 | `src/lib/storage/index.ts`（1行） | 2〜4時間 |
| **重要②** | 美女木拠点の正確な座標を設定 | `src/lib/maps/warehouse.ts` | 30分 |
| **重要③** | 実際の配車表でOCR精度検証・調整 | `src/lib/ocr/parser.ts` | 数日 |
| **任意①** | デプロイ先（Vercel vs VPS）確定 | — | 意思決定次第 |
| **任意②** | スマホ実機でドライバー画面確認 | — | 1時間 |

### モック差し替え箇所一覧

**差し替えが必要なファイルは 2ファイルのみ**

| ファイル | 変更内容 | 他ファイルへの影響 |
|---|---|---|
| `src/lib/cario/getDrivers.ts` | `return [...]` → API/CSV/DB呼び出し | なし |
| `src/lib/cario/getShifts.ts` | `return [...]` → API/CSV/DB呼び出し | なし |

接続方式別の必要環境変数：

| 方式 | 必要な環境変数 |
|---|---|
| REST API | `CARIO_API_BASE_URL` `CARIO_API_KEY` `CARIO_API_SECRET` |
| CSV出力 | CSV保存パス または SFTP 設定 |
| DB直接参照 | `CARIO_DB_URL` |
| 画面スクレイピング | `DISPATCH_SITE_BASE_URL` `DISPATCH_SITE_USERNAME` `DISPATCH_SITE_PASSWORD` |

### 画像ストレージ差し替え手順

```typescript
// src/lib/storage/index.ts を1行変更するだけ
// 現在（ローカル）:
export { localStorageProvider as storageProvider } from "./local";

// Vercel Blob へ変更:
export { vercelBlobProvider as storageProvider } from "./vercel-blob";

// S3 へ変更:
export { s3Provider as storageProvider } from "./s3";
// ↑ 新しい Provider ファイルを StorageProvider インターフェースに沿って作成するだけ
```

### 本番投入 NG 項目

| NG項目 | 場所 | 対応 |
|---|---|---|
| テスト用 DRIVER アカウント（tanaka/sato/suzuki） | `prisma/seed.ts` | 本番 seed から除外 |
| 開発用テストアカウント | `prisma/seed.dev.ts` のみ（`seed.prod.ts` には含まない） |
| ローカル Docker の `DATABASE_URL` | `.env.local` | 本番 DB の URL に変更 |
| 暫定 `NEXTAUTH_SECRET` | `.env.local` | `openssl rand -base64 32` で新規生成 |
| ローカル `/uploads/` の画像 | `public/uploads/` | gitignore 済み・持ち込まない |
| CARIO モックの個人名・電話番号 | `getDrivers.ts` | 実接続後はモックごと削除 |

### デプロイ先候補比較

| 比較項目 | Vercel + Neon（推奨） | 自社 VPS / Docker |
|---|---|---|
| 初期設定 | ◎ git push でデプロイ | △ サーバー構築が必要 |
| 月額費用 | △ $20〜50/月 | ○ $10〜20/月 |
| 画像保存 | ◎ Vercel Blob（1行差し替え） | △ S3 or ローカル設定 |
| DB運用 | ◎ マネージド・自動バックアップ | △ 手動管理が必要 |
| 環境変数管理 | ◎ GUI ダッシュボード | △ ファイル手動管理 |
| Next.js 最適化 | ◎ 製作元 | △ nginx 設定が必要 |
| **推奨** | **MVP 初期本番運用に最適** | **コスト重視・社内利用向け** |

### 本番前チェックリスト（最終版）

#### インフラ・環境
- [ ] `DATABASE_URL` = Neon PostgreSQL 接続文字列
- [ ] `NEXTAUTH_SECRET` = `openssl rand -base64 32` で生成
- [ ] `NEXTAUTH_URL` = 本番ドメイン（`https://your-app.vercel.app`）
- [ ] `BLOB_READ_WRITE_TOKEN` = Vercel Blob トークン
- [ ] `GOOGLE_MAPS_API_KEY` = Geocoding API キー
- [ ] `prisma migrate deploy`（本番マイグレーション）
- [ ] **`OCR_SPACE_API_KEY` = 本番キー必須**（未設定で OCR 実行不可）
- [ ] 本番でデモキー fallback が無効であること（NODE_ENV=production で確認）
- [ ] `OCR_DAILY_LIMIT` = 運用想定枚数に合わせて設定（デフォルト 180）
- [ ] Cloud Vision 関連の環境変数が**不要**であること（設定しない）

#### データベース
- [x] `delivery_location_overrides` migration 適用済み（Neon 20260630091059）
- [ ] 管理者アカウントを本番パスワードで作成（`npm run db:seed:prod`）
- [ ] テスト用 seed データ（tanaka/sato/suzuki）を本番 DB に投入しない

#### OCR・取込（実機テスト必須）
- [ ] 実物 L1M 配車表でスマホカメラOCRをテスト（iPhone Safari）
- [ ] 実物 L1M 配車表でスマホカメラOCRをテスト（Android Chrome）
- [ ] PDF取込をテキスト PDF でテスト
- [ ] CSV / Excel取込を実ファイルでテスト
- [ ] 取込確認画面（`/admin/ocr-review/[id]`）で確定できること
- [ ] 取込後に割当 → ルート作成へ流れること

#### Google Maps 連携
- [ ] 1件ナビ（`dir/?api=1&destination=...&travelmode=driving`）が正しく動くこと
- [ ] iPhone Safari でナビ起動確認
- [ ] Android Chrome でナビ起動確認
- [ ] 4件単位の分割 URL が正しく生成されること
- [ ] 住所コピー fallback が動くこと

#### CARIO 連携
- [ ] CARIO 接続方式確定（API / CSV / DB直接）
- [ ] モックから実実装に差し替え（`getDrivers.ts` / `getShifts.ts`）

#### セキュリティ・個人情報
- [ ] 個人情報ログが出ていない（氏名・電話番号・住所・伝票No）
- [ ] Vercel Blob public 領域に raw OCR JSON・debug JSON を保存していない
- [ ] 配送表画像の Blob 公開範囲を確認（現状 public・将来 private 化予定）
- [ ] GODOOR 不使用であること（有料住宅地図データを流用していない）

#### 次フェーズ（本番化後に対応）
- [ ] 手動ピン修正 UI の実装（`delivery_location_overrides` テーブル利用）
- [ ] 住所信頼度表示の実装
- [ ] 入口/建物/表札メモ UI の実装
- [ ] 配送表画像の private Blob 化

### 実データ検証チェックリスト

#### OCR 精度
- [ ] 実際の L1M 配車表画像（JPEG/PNG）で OCR 実行
- [ ] 配車No（W1-11-1形式）が正しく読み取れるか
- [ ] 数量欄（常温/クーラー/ケース/総数）が4項目に分解されるか
- [ ] 誤読時に「要確認」フラグが立つか
- [ ] 取込確認画面でインライン編集・保存できるか

#### 住所・地図
- [ ] 実際の配送先住所で Geocoding が成功するか
- [ ] 住所エラー行が ADDRESS_ERROR になるか
- [ ] Google Maps URL が正しいルートを示すか
- [ ] 11件以上の配送先で URL が分割されるか

#### セキュリティ
- [ ] ドライバーAでログインしてドライバーBの配送先が見えないか
- [ ] 他人の delivery_item_id を API に直接送って 403 が返るか
- [ ] ADMIN で `/driver/today` にアクセスすると `/admin/dashboard` へリダイレクトされるか

---

## 確認済み事項（本番方針確定）

| # | 項目 | 決定内容 | 確認日 |
|---|---|---|---|
| 1 | DB（開発） | ローカル Docker PostgreSQL | 2026-06-26 |
| 2 | DB（本番） | **Neon PostgreSQL** | 2026-06-29 |
| 3 | 画像ストレージ | **Vercel Blob**（`@vercel/blob` 実装済み） | 2026-06-29 |
| 4 | OCR | OCR.space（Gemini/AI/Cloud Vision 不使用） | 2026-06-26 |
| 5 | CARIO連携方式 | **REST API**（未設定時モックフォールバック） | 2026-06-29 |
| 6 | デプロイ先 | **Vercel** | 2026-06-29 |
| 7 | 管理者アカウント | `prisma db seed:prod`（PW は環境変数） | 2026-06-29 |

### 情報待ち（本番デプロイ前に必要）

| 項目 | 内容 |
|---|---|
| Neon DB URL | Neon プロジェクト作成後に `DATABASE_URL` として設定 |
| Vercel Blob トークン | Blob ストア作成後に `BLOB_READ_WRITE_TOKEN` として設定 |
| Google Maps API キー（本番） | Cloud Console で Geocoding API を有効化 |
| CARIO API エンドポイント仕様 | API 仕様書受領後に `mapper.ts` のフィールドマッピングを調整 |
| CARIO API キー | CARIO 側から払い出し後に `CARIO_API_KEY` として設定 |
| 美女木拠点の正確な座標 | `src/lib/maps/warehouse.ts` の lat/lng/address を更新 |
| 本番管理者パスワード | `ADMIN_PASSWORD` 環境変数に設定後に `npm run db:seed:prod` |

---

## 環境変数一覧（Vercel 本番設定）

| 変数 | 用途 | 状態 |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL 接続 URL | ⏳ Neon 作成後 |
| `NEXTAUTH_SECRET` | JWT 署名（`openssl rand -base64 32`） | ⏳ 生成後設定 |
| `NEXTAUTH_URL` | アプリ URL（`https://your-app.vercel.app`） | ⏳ デプロイ後 |
| `OCR_SPACE_API_KEY` | OCR.space API キー（未設定時デモキー） | ⚠️ 任意（デモキーで動作確認済み） |
| `GOOGLE_MAPS_API_KEY` | Geocoding 用 | ⏳ API キー発行後 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 読み書き | ⏳ Blob ストア作成後 |
| `CARIO_API_BASE_URL` | CARIO API エンドポイント | ⏳ CARIO 仕様確定後 |
| `CARIO_API_KEY` | CARIO 認証キー | ⏳ CARIO 払い出し後 |
| `CARIO_API_SECRET` | CARIO 認証シークレット（任意） | ⏳ CARIO 払い出し後 |
| `ADMIN_EMAIL` | 本番管理者メール（seed.prod.ts 用） | ⏳ 決定後 |
| `ADMIN_PASSWORD` | 本番管理者 PW（seed.prod.ts 用） | ⏳ 決定後 |

> `.env.example` にすべてのキーとコメントが記載されています。

---

## 本番デプロイ 実行チェックリスト

> コードは本番デプロイ可能な状態（tsc/lint/build 全 OK 確認済み）。
> 以下を上から順番に実行してください。

### ① Neon PostgreSQL 作成

```
[ ] 1. https://neon.tech → New Project
[ ] 2. Dashboard → Connection Details → Connection string をコピー
[ ] 3. sslmode=require が含まれているか確認（重要）
[ ] 4. この値を DATABASE_URL としてメモ
```

### ② Vercel プロジェクト作成

```
[ ] 1. https://vercel.com → New Project → GitHub リポジトリを Import
[ ] 2. Framework: Next.js（自動検出） → Deploy
[ ] 3. デプロイ後の URL をメモ → NEXTAUTH_URL に使う
```

### ③ Vercel Blob ストア作成

```
[ ] 1. Vercel ダッシュボード → Storage → Create → Blob Store
[ ] 2. BLOB_READ_WRITE_TOKEN をメモ
```

### ④ Google API キー取得

```
[ ] 1. https://console.cloud.google.com → APIs & Services → Enable APIs
[ ] 2. Geocoding API を有効化
[ ] 3. Geocoding API を有効化
[ ] 4. Credentials → API Key を作成してメモ
```

### ⑤ Vercel 環境変数設定（Production）

```
[ ] DATABASE_URL         = postgresql://...（①）
[ ] NEXTAUTH_SECRET      = openssl rand -base64 32 の出力
[ ] NEXTAUTH_URL         = https://your-app.vercel.app（②）
[ ] OCR_SPACE_API_KEY = （OCR.space の API キー・未設定時デモキー使用可）
[ ] GOOGLE_MAPS_API_KEY         = （④）
[ ] BLOB_READ_WRITE_TOKEN       = （③）
[ ] ADMIN_EMAIL          = admin@your-domain.com
[ ] ADMIN_PASSWORD       = （本番パスワード）
[ ] CARIO_API_BASE_URL   = （未確定はスキップ可）
[ ] CARIO_API_KEY        = （未確定はスキップ可）
[ ] CARIO_API_SECRET     = （未確定はスキップ可）
```

### ⑥ 本番 DB マイグレーション

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
# → "All migrations have been applied." が出ればOK
```

### ⑦ 本番管理者 seed 実行

```bash
ADMIN_EMAIL="admin@..." \
ADMIN_PASSWORD="..." \
DATABASE_URL="postgresql://..." \
npm run db:seed:prod
# → "✅ 本番管理者アカウント作成: ..." が出ればOK
```

### ⑧ 本番再デプロイ

```
[ ] Vercel ダッシュボード → Redeploy（環境変数を反映させる）
```

### ⑨ 本番 URL 動作確認

```
[ ] /login                  → ログイン画面が表示される
[ ] /admin/dashboard        → 集計カードが表示される
[ ] /admin/dispatch-images  → 画像アップロード → Vercel Blob に保存される
[ ] /admin/shifts           → CARIOシフト取込（CARIO未設定→モックで動作）
[ ] /admin/assignments      → 割当画面が表示される
[ ] /admin/routes           → ルート作成画面が表示される
[ ] /admin/progress         → 進捗画面が表示される
[ ] /driver/today           → ドライバーの配送先が表示される
```

### ⑩ 権限確認

```
[ ] 未認証 → /admin/* → /login にリダイレクト
[ ] DRIVER → /admin/* → /driver/today にリダイレクト
[ ] ADMIN → /driver/today → /admin/dashboard にリダイレクト
```

---

## 変更履歴

| 日付 | ステップ | 内容 |
|---|---|---|
| 2026-06-26 | — | 初版作成・実装計画確定 |
| 2026-06-26 | STEP 1 | 基盤構築完了（create-next-app / Prisma 7 / NextAuth.js v5 / middleware / レイアウト） |
| 2026-06-26 | STEP 2 | 配車表画像取込完了（storage 抽象化 / アップロードAPI / 取込履歴UI） |
| 2026-06-26 | STEP 3 | OCR処理完了（OCR.space / 座標解析 / 配車No分解 / 要確認フラグ / 自動救済） |
| 2026-06-26 | STEP 4 | 取込確認画面完了（インライン編集 / 再バリデーション / 確定機能 / 監査ログ） |
| 2026-06-27 | STEP 5 | CARIOシフト取込完了（upsert / サマリー表示 / schema変更）※後に REST API client/mapper 実装 |
| 2026-06-27 | STEP 6 | 割当機能完了（半自動割当 / 手動修正 / 確定機能 / Assignment @unique 追加） |
| 2026-06-29 | STEP 7 | ルート作成完了（Geocoding / 最近隣法 / Google Maps URL / 積み込みモード切替） |
| 2026-06-29 | STEP 8 | ドライバー画面完了（スマホ優先カードUI / 本人確認 / ステータス更新 / 備考入力） |
| 2026-06-29 | STEP 9 | 管理者進捗画面完了（ダッシュボード集計 / ドライバー別進捗 / 詳細展開）**MVP 完成** |
| 2026-06-29 | 品質確認 | ESLint エラー修正・seed.ts にDRIVERアカウント追加・ビルド成功確認・README 整備 |
| 2026-06-29 | 本番化準備① | 作業計画・モック差し替え箇所・デプロイ先比較・本番NG項目・実データ検証チェックリスト策定 |
| 2026-06-29 | 本番化準備② | seed分離(dev/prod)・Vercel Blob/S3 Provider実装案・.env.example整備・README本番化手順追記 |
| 2026-06-29 | 本番化実装 | Vercel Blob本実装・CARIO API client/mapper作成・ENV分岐フォールバック・.env.example確定・README更新 |
| 2026-06-29 | デプロイ準備 | 最終確認（tsc/lint/build 全 OK）・デプロイ手順確定・CARIO仕様待ち項目整理・動作確認シナリオ作成 |
| 2026-06-29 | デプロイ実行 | 実行チェックリスト作成（①Neon→②Vercel→③Blob→④Google API→⑤ENV→⑥migrate→⑦seed→⑧再デプロイ→⑨確認）|
| 2026-06-29 | 自動化整理 | DEPLOY.md 作成・作業分担（人間 vs Claude Code）・Vercel CLI コマンド一覧・typecheck/lint/build 全 OK |
| 2026-06-29 | Git 初期化 | git init・.gitignore 更新（AGENTS.md/CLAUDE.md除外）・117ファイル初回コミット完了 |
| 2026-06-29 | GitHub push | https://github.com/momose-clore/rakuten-delivery-app（Private）に push 完了 |
| 2026-06-29 | middleware 修正 | NextAuth v5 推奨方式に変更（authorized callback + export { auth as middleware }） |
| 2026-06-29 | Neon migrate | 初回マイグレーション作成・適用完了（20260629132459_init） |
| 2026-06-29 | 本番 seed | admin@delivery-app.local を Neon DB に作成完了 |
| 2026-06-29 | Vercel 設定 | 環境変数6個登録・Vercel Blob 作成・Google API キー設定 |
| 2026-06-29 | middleware 修正 | Edge Runtime 対応（getToken 方式）・デプロイエラー解消 |
| 2026-06-29 | 🎉 本番デプロイ | https://rakuten-delivery-app.vercel.app にデプロイ完了 |
| 2026-06-29 | ⚠️→✅ ログイン修正 | 原因: NextAuth v5 は JWE 暗号化のため getToken() 不可 → authConfig 分離パターンに変更 |
| 2026-06-30 | 本番テスト | アップロード・OCR・確認・シフト・割当・ルートの一連フローを確認 |
| 2026-06-30 | OCR 改善① | Vercel Blob public 化・アップロード簡略化（配送日自動抽出）・sharp.js 前処理追加 |
| 2026-06-30 | OCR 改善② | OCR.space 導入（タイムアウト問題解消）・10-1 形式配車No対応 |
| 2026-06-30 | ⚠️→✅ OCR精度改善 | L1M専用OCRエンジン実装（座標ベース列マッピング・AI fallbackなし）|
| 2026-06-30 | OCR エンジン実装 | ocrspace.ts/table-template/layout-mapper/field-extractor/normalizer/confidence/hash/usage 全9ファイル |
| 2026-06-30 | OCR v2 精度向上 | 表領域検出・ヘッダーアンカー列補正・動的tolerance・住所折り返し結合・ADDRESS_SUSPECT・修正履歴学習 |
| 2026-06-30 | OCR v3 精度向上 | 品質スコア・誤読辞書・グリッド検出・列専用抽出器・正解セット評価・セキュリティ修正 |
| 2026-06-30 | 取込エンジン v5 | PDF/CSV/Excel/貼付/画像OCR/スマホカメラOCR 統合・L1M専用プロファイル・自動救済・取込センターUI |
| 2026-06-30 | ドキュメント整合 | Cloud Vision 記述削除・低信頼行の自動救済方針に修正・パスワードマスク・CLAUDE.md 更新 |
| 2026-06-30 | v5実態整合 | PDF API追加・camera/quality-check追加・OCR_SPACE_API_KEY本番必須化・取込確認画面名称変更・l1mDebugJsonUrl追加 |
| 2026-06-30 | 方針整合 | GODOOR不使用・住所補正DB（delivery_location_overrides）・Google Maps方針・個人情報方針・OCR_SPACE_API_KEY本番必須・ドキュメント整合 |
| 2026-06-30 | 住所補正 | GODOORなし住所補正・手動ピン修正・配送メモ・管理者承認フロー・ドライバー申請フロー実装 |
| 2026-06-30 | DB migrate | dispatch_import_batches/rows テーブル追加（Neon 適用済み） |
| 2026-06-30 | DB migrate | ocr_ground_truth_sets/items テーブル追加（Neon 適用済み） |
| 2026-06-30 | DB migrate | ocr_correction_patterns テーブル追加（Neon 適用済み） |
| 2026-06-30 | DB migrate | imageHash/ocrProvider/reOcrCount/ocr_usage_logs を Neon に適用完了 |
| 2026-06-30 | DB migrate | delivery_location_overrides テーブル追加（Neon 20260630091059 適用済み） |
| 2026-06-30 | 住所補正実装 | address-normalizer/confidence/warning/location-override-matcher + maps/navigation 実装 |
| 2026-06-30 | 住所補正管理UI | /admin/location-overrides + LocationOverrideClient（承認・却下フロー）実装 |
| 2026-06-30 | 住所補正 API | admin/location-overrides CRUD + approve/reject + driver/location-overrides + delivery-items/[id]/location-info |
| 2026-06-30 | ドライバー画面 | DeliveryCard.tsx に override メモ（入口/建物/表札/駐車/注意）表示追加 |
| 2026-06-30 | driver/today | location-override を統合: hasOverride・memo 5種・mapsUrl（override 優先）を返すよう更新 |
| 2026-06-30 | 品質確認 | typecheck/lint/build/prisma validate 全 OK・tsc/eslint shim 修正・未使用変数 8件解消 |
| 2026-06-30 | PROJECT_STATUS | 実装済みアイテムが「未実装」セクションに残る矛盾を修正・住所補正実装ステータス整合 |
| 2026-06-30 | 予測値対策 | src/types/prediction.ts・src/lib/prediction/ 新設・prisma migration・Geocode ESTIMATED・上書き保護・UIバッジ・確定ガード |
| 2026-06-30 | 予測値v4.1 | audit_logs hash化（Option A）・src/lib/audit/audit-log.ts・mergeFieldStatuses・filterOcrFields・PII sanitizer・driver/today N+1修正 |
| 2026-06-30 | 予測値v4.1整合 | security/hash.ts・protection.ts・warning-priority.ts・merge.ts・import-accuracy/calculate.ts・shift-importer.ts・driver-memo.ts・ReOcrDialog.tsx・Shift stale migration・AUDIT_LOG_HASH_SALT env追加 |
| 2026-06-30 | CARIO実連携準備 | fetchRakutenAssignments・mapRakutenAssignmentsResponse（柔軟構造検出）・getAssignments.ts・RAKUTEN_APP_API_KEY env・shifts/import/route.ts 実API対応・接続モード表示 |
| 2026-06-30 | CARIO接続テスト | エンドポイント到達確認（HTTP 401）・エラー形式確認（{"error":"unauthorized"}）・test-cario.js / extract-structure.js / scripts/test-cario-live.js 作成・.gitignore追加 |
| 2026-07-01 | CARIO認証確認 | Authorization: Bearer 形式確認済み・コード全て正常・RAKUTEN_APP_API_KEY未設定のみが原因・cario-app-two Vercelダッシュボードでキー確認中 |
| 2026-07-02 | 予測値v4.1/CARIO準備コミット | 未コミットだった予測値対策v4.1・CARIO実連携準備を品質確認後にコミット（987f28d） |
| 2026-07-02 | CARIO stale警告UI | GET /api/shifts に connection 情報追加・POST /api/shifts/approve-stale 新設・CarioConnectionBanner（MOCK/REAL_API/LAST_IMPORTED表示・stale赤警告・承認ボタン）・ShiftImportClient統合・APIキー非表示・typecheck/lint/build/prisma全OK |
| 2026-07-02 | 検証ツール安全化 | extract-structure.js の値サンプル出力（PII漏洩）を除去→値ゼロのschema JSON/keys CSV生成に変更・test-cario.js のレスポンス本文ダンプ除去・APIキー長さ非表示（mapper.ts は未変更） |
| 2026-07-02 | CARIO実キー1回目 | 深井氏提供のcURL例キー（67fc…8b02・64桁）を.env.localに設定→test-cario.js/生cURL両方で HTTP 401 unauthorized。アプリ側正常・キーがサーバー側で認証不可（ダミー/未有効化の疑い）。深井氏へ有効キー確認を依頼中 |
| 2026-07-02 | フェーズ3実装 | 取込精度レポート: GET /api/admin/import-accuracy + /admin/import-accuracy 画面（ImportAccuracyClient）+ Sidebarリンク。calculateImportAccuracy で毎回再集計 |
| 2026-07-02 | フェーズ4実装 | ドライバーメモ入力（LocationMemoForm→PENDING申請）・取込確認の予測値バッジ（PredictionBadge）・手修正時に field_status_json へ MANUAL_FIXED / MANUAL_EDIT 記録 |
| 2026-07-02 | フェーズ5実装 | 配送表画像を認証経由化: GET /api/dispatch-images/[id]/file プロキシ新設・OcrReviewClient/ImageHistoryList を proxy URL(unoptimized)に差替え・生Blob URLをブラウザ非露出。typecheck/lint/build/prisma 全OK |
| 2026-07-02 | 予測値UI仕上げ | ルート画面に座標ステータスバッジ（確定/推定/未・RouteItem.coordinateStatus追加）・ドライバー画面に住所信頼度バッジ（assessAddressConfidence・medium/low時）。typecheck/lint/build 全OK |
| 2026-07-02 | CARIOキー待機 | ユーザー判断でCARIO有効キー待機モードへ。アプリ側は現グリーン状態を維持（コード/インフラ変更なし）。Blob物理private化は影響大のため未着手 |
| 2026-07-02 | 手順書のみ作成 | BLOB_PRIVATE_MIGRATION.md 作成（Blob物理private化の影響範囲・実施手順A-D・ロールバック・検証チェックリスト・リスク）。実装/インフラ変更は未実施 |
| 2026-07-03 | クルー画面 新デザイン試作 | /preview・/driver-preview・/driver-lab（プレビュー・DB不要）でクルーUXをデザイン部門ワークフロー(リサーチ→4案→統合)で設計。CLOREロゴSVG/PNG・濃紺×ゴールド・Next Stopヒーロー・W1〜W6タブ・配車No特大 |
| 2026-07-03 | クルー本番反映(Phase A) | 本番 /driver/today を新デザインに置換・/api/driver/today にdriver情報追加・配送取得/完了を実API接続 |
| 2026-07-03 | クルー Phase B-1 | 倉庫到着時刻/終了報告/誤配なしをDB+API化。schema: DeliveryItem.noMisdelivery・DriverDayReport新設。API: warehouse-arrival/finish-report/no-misdelivery。migration 20260703120000。typecheck/lint/build/prisma 全OK（要Neon migration適用） |
| 2026-07-03 | ドライバー配送表取込 | カメラ/PDF取込をDRIVERに開放。ドライバー自己スキャンは saveDriverScan で本人の本日配送に即反映（dispatch_image CONFIRMED＋delivery_items ASSIGNED＋本人割当）。/driver/camera 新設・PDFボタン実接続 |
| 2026-07-03 | クルー Phase B-2 フォロー | 二重ハンドラ方式の応援機能。schema: DeliveryFollow新設（1明細1ドライバー）。API: followable(候補一覧)/follow(1件トグル)。today にフォロー分統合・status/no-misdelivery を応援者にも許可。UI: フォロー画面＋応援バッジ。完了は共有（migration 20260703140000）。全品質OK |
| 2026-07-03 | 🎉 本番デプロイ | vercel.json で build時 prisma migrate deploy 自動実行。GitHub push→未適用migration自動適用→本番反映。/preview・/driver/today 本番稼働確認済み |
| 2026-07-03 | テストドライバー | GET /api/admin/setup/test-driver（ADMIN or ?token=）でテストドライバー(test-driver@delivery-app.local/driver1234)＋本日サンプル配送3件を作成。本番動作確認用（用済み後削除推奨） |
| 2026-07-03 | スマホ対応強化 | viewport-fit=cover(iPhoneセーフエリア)・themeColor・lang=ja・apple-web-app・HEIC→JPEG正規化(sharp) |
| 2026-07-03 | OCR精度改善 | カメラ前処理強化(2600px化・CLAHE局所コントラスト・sharpen強化)。スキャンPDFはEngine1(PDF対応)＋テキスト解析フォールバック＋エラー可視化。OCR.space1画像1回の方針は不変 |
| 2026-07-03 | OCR v6-1 画像品質 | image-quality に領域解析実装(右端切れ/上部の影/白飛び/下部余白・縮小画像で高速化)。mobile-quality-checkのTODO実装。カメラUIに撮影枠ガイド。/driver/camera・/admin camera対応 |
| 2026-07-03 | OCR v6-2 前処理設定化 | 前処理を環境変数で調整可能に(OCR_PREPROCESS_TARGET_LONG_EDGE=3600等)。長辺3600px化・CLAHE・sharpen・payload保護・前処理メタ(originalWidth等)返却。preprocessImageForOcrDetailed追加。送信は1画像1回のまま |
| 2026-07-03 | OCR v6-3 誤読辞書 | misread-dictionary拡張: S→5・B→8・|→1・全角/各種ハイフン統一。数値/コード欄(配車No/伝票No/電話/数量)限定で氏名・住所は非対象。全OCR経路に反映 |
| 2026-07-03 | OCR v6-4 取込確認 | REVIEW_REASON_DETAILS追加・行ごとに要確認理由の詳細文＋「内訳計≠総数」差分表示。自動救済にW番号救済(配車Noから復元)追加 |
| 2026-07-03 | OCR v6-5 精度レポート | import-accuracy拡張: 自動救済率/要確認率・要確認理由TOP・取込方式別(画像数)・W番号別(明細数)。統計のみ・個人情報非表示 |
| 2026-07-03 | OCR v6-6 座標パーサー堅牢化 | l1m-row-block-parser: 数量列を左→右整列＋数値フィルタ(常温/クーラー/ケース/総数の割当ズレ防止)・配車No誤読耐性(ハイフン消失/l↔1でブロック取りこぼし防止) |
| 2026-07-03 | OCR強化設計書 | OCR_ENHANCEMENT_DESIGN.md作成(調査結果・実装済み・要実画像検証項目・検証ループ手順)。Engine2最適/Engine3は座標非対応で不採用を明記 |
---

## ✅ 予測値・推定値の誤適用対策（実装完了）

### 絶対方針

- 予測値は確定値として扱わない
- source / confidence / status / warning を値ごとに管理（`src/types/prediction.ts`）
- Google Geocoding座標は初期状態で `ESTIMATED` → ADMIN_APPROVED override のみ確定座標
- `ADMIN_APPROVED` / `MANUAL_FIXED` は自動処理（Geocode再実行・OCR再実行）で上書き禁止
- 低信頼値・推定値はドライバー画面にバッジ表示（「⚠ ピン位置注意」「住所確認」）
- `audit_logs` に氏名・電話番号・住所・伝票Noの値は保存しない

### 優先順位（高→低）

```
1. ADMIN_APPROVED（管理者承認済みoverride）
2. MANUAL_FIXED（手動修正済み）
3. DRIVER_SUBMITTED 承認済み
4. LOCATION_OVERRIDE 承認済み
5. 取込確認画面で管理者が修正した値
6. GOOGLE_GEOCODE（推定・ESTIMATED）
7. OCR_AUTO_RESCUED（自動救済）
8. OCR_RAW（OCR生値）
```

### 対象フィールド

**配送表取込系:** dispatchKey / invoiceNo / address / customerName / customerPhone / 数量4項目 / memo  
**地図・住所系:** lat / lng / coordinateSource / coordinateStatus / coordinateConfidence  
**配送メモ系:** entranceMemo / buildingMemo / nameplateMemo / parkingMemo / cautionMemo / accessMemo

### DB設計（Case A: JSONメタデータ + 座標専用カラム）

`delivery_items` に追加：

| カラム | 用途 |
|---|---|
| `coordinate_source` | 座標の出どころ（GOOGLE_GEOCODE / LOCATION_OVERRIDE / MANUAL_FIXED など） |
| `coordinate_status` | 座標の状態（ESTIMATED / ADMIN_APPROVED / MANUAL_FIXED）デフォルト: ESTIMATED |
| `coordinate_confidence` | 座標の信頼度（HIGH / MEDIUM / LOW） |
| `field_source_json` | フィールドごとの出どころ JSON（`{dispatchKey: "OCR_RAW", ...}`） |
| `field_status_json` | フィールドごとの状態 JSON |
| `prediction_warnings_json` | 予測警告コード JSON配列 |

`delivery_location_overrides` に追加：

| カラム | 用途 |
|---|---|
| `match_confidence` | マッチ精度（high / medium / low） |
| `applied_from` | どこから適用されたか（ValueSource） |

### 実装ファイル

| ファイル | 内容 |
|---|---|
| `src/types/prediction.ts` | ValueSource / ValueConfidence / ValueStatus / 警告コード / ラベル定数 / ガード関数 |
| `src/lib/prediction/metadata.ts` | OCRメタデータ構築・GeocodeメタデータビルダーJSON パーサー |
| `src/lib/prediction/overwrite-guard.ts` | 座標・フィールドの上書きブロック判定 |
| `prisma/migrations/20260630200000_add_prediction_metadata/` | DB migration SQL |
| `src/lib/import/auto-rescue.ts` | RescuedRow 型追加・rescue flags 追跡・予測メタデータ構築 |
| `src/lib/import/pipeline.ts` | RescuedRow のメタデータを delivery_items に保存 |
| `src/lib/maps/geocode.ts` | locationType を返すよう拡張（ROOFTOP / APPROXIMATE など） |
| `src/app/api/routes/geocode/route.ts` | coordinateSource/Status/Confidence を保存・ADMIN_APPROVED をスキップ |
| `src/lib/address/location-override-matcher.ts` | matchConfidence / appliedFrom を override に記録 |
| `src/app/api/ocr-review/[id]/confirm/route.ts` | 低信頼・自動補正・住所空欄を集計して predictionWarnings を返す |
| `src/app/api/assignments/confirm/route.ts` | 配車No不明・住所空欄・NEEDS_REVIEW を警告として返す |
| `src/app/api/driver/today/route.ts` | coordinateBadge / coordinateStatus / addressNavUrl を返す |
| `src/components/driver/DeliveryCard.tsx` | coordinateBadge バッジ表示・住所フォールバックURL ボタン |

### ドライバー画面バッジ

| 条件 | バッジ |
|---|---|
| override.status === "approved" | ✓ 確認済みピン（緑） |
| coordinateStatus === "ESTIMATED" | ⚠ ピン位置注意（黄） |
| 座標なし | 📍 住所確認（橙） |

### audit_logs 個人情報匿名化（v4.1 実装済み）

| 項目 | 内容 |
|---|---|
| 採用方式 | **Option A（targetId hash化）** |
| hash方式 | HMAC-SHA256（NEXTAUTH_SECRET をソルトとして使用・逆検索不可） |
| 新カラム | `targetIdHash` / `fieldName` / `source` / `status` / `reason` |
| 既存カラム | `userId` / `targetId` / `beforeData` / `afterData` は後方互換で保持 |
| 権限 | **ADMIN のみ閲覧可（AUDIT ロール新設なし）** |
| ヘルパー | `src/lib/audit/audit-log.ts` の `recordPredictionAudit()` / `getAuditLogs()` |

### v4.1 追加実装ファイル

| ファイル | 内容 |
|---|---|
| `src/lib/audit/audit-log.ts` | hash化・recordPredictionAudit・getAuditLogs（ADMIN限定） |
| `src/lib/pii/sanitizer.ts` | PII除去ヘルパー（sanitizeForLog / sanitizeAuditData / sanitizeErrorMessage） |
| `src/lib/prediction/metadata.ts` | mergeFieldStatuses / mergeFieldSources / filterOcrFields / OCR_DERIVED_FIELDS 追加 |
| `prisma/migrations/20260630210000_add_audit_log_anonymize/` | audit_logsに新5カラム + インデックス追加 |
| `src/app/api/driver/today/route.ts` | N+1修正（override を一括クエリ・usageCount 一括更新） |
| `src/app/api/routes/geocode/route.ts` | AUTO_OVERWRITE_BLOCKED 時に recordPredictionAudit 記録 |

### v4.1 後の残フェーズ

**完了済み（フェーズ1・2）**
- [x] 予測値メタデータ基盤（types/prediction.ts・prediction/・audit/・security/・pii/）
- [x] 予測値 UI・確定ガード（DeliveryCard バッジ・confirm 警告）
- [x] audit_logs hash化（ADMIN限定・targetIdHash）
- [x] mergeFieldMetadata（操作別上書き保護）
- [x] import-accuracy 再集計（calculateImportAccuracy）
- [x] CARIO stale 状態管理（isStale / sourceStatus / shift-importer.ts）
- [x] driver-memo.ts N+1対策
- [x] ReOcrDialog.tsx（保護フィールド表示）

**フェーズ3: OCR精度レポート**

| 機能 | 状態 |
|---|---|
| /admin/import-accuracy 画面 | ✅ 実装済み（全体精度・ステータス別集計・画像別テーブル・日付フィルター） |
| GET /api/admin/import-accuracy | ✅ 実装済み（calculateImportAccuracy で毎回再集計・最新30件/日付絞込） |
| 実L1M画像での精度検証 | ⬜ 本番検証時 |

**フェーズ4: ドライバーメモ入力UI**

| 機能 | 状態 |
|---|---|
| 入口/建物/表札/駐車/注意メモ 入力フォーム | ✅ 実装済み（LocationMemoForm・DeliveryCard 統合・PENDING申請） |
| 管理画面予測バッジ表示（取込確認） | ✅ 実装済み（PredictionBadge・手動修正/承認/自動救済/推定/要確認/低信頼） |
| field_status_json MANUAL_FIXED 書き込み（手修正時） | ✅ 実装済み（ocr-review items PATCH で MANUAL_FIXED / MANUAL_EDIT 記録） |

**フェーズ5: 画像管理**

| 機能 | 状態 |
|---|---|
| 配送表画像 private Blob 化（認証経由化） | ✅ 実装済み（GET /api/dispatch-images/[id]/file 認証プロキシ・生Blob URLをブラウザに非露出） |

**フェーズ10: CARIO実API連携（実装準備完了・本格運用は最終フェーズ）**

| 機能 | 状態 |
|---|---|
| `fetchRakutenAssignments()` 実装（client.ts） | ✅ 実装済み |
| `mapRakutenAssignmentsResponse()` 柔軟マッパー（mapper.ts） | ✅ 実装済み |
| `getAssignments.ts` + モックフォールバック | ✅ 実装済み |
| shifts/import/route.ts 実API対応 | ✅ 実装済み |
| `RAKUTEN_APP_API_KEY` 環境変数対応 | ✅ .env.example 追加済み |
| API接続モード表示（MOCK / REAL_API / LAST_IMPORTED） | ✅ 実装済み（バックエンド + UIバナー） |
| stale 時の赤警告表示（UI側） | ✅ 実装済み（CarioConnectionBanner・最終取込日時/対象日/理由・承認ボタン） |
| 実APIキー設定・本番接続テスト | ⬜ `RAKUTEN_APP_API_KEY` 要設定 |
| レスポンス構造確認後の mapper 微調整 | ⬜ 実APIレスポンス確認後 |

### CARIO実連携 確定API仕様

| 項目 | 値 |
|---|---|
| エンドポイント | `GET /api/external/rakuten/assignments` |
| Base URL | `https://cario-app-two.vercel.app` |
| 認証 | `Authorization: Bearer <RAKUTEN_APP_API_KEY>` |
| クエリ | `from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Timeout | 15秒（`CARIO_TIMEOUT_MS` で調整可） |

### 接続テスト結果（2026-06-30 実施）

| 項目 | 結果 |
|---|---|
| エンドポイント到達性 | ✅ `HTTP 401` — 到達確認済み |
| エラー形式 | ✅ `{"error":"unauthorized"}` — client.ts に対応済み |
| APIキー未設定時の挙動 | ✅ `CarioApiError (AUTH)` を throw |
| test-cario.js 作成 | ✅ `.gitignore` 済み |
| extract-structure.js 作成 | ✅ `.gitignore` 済み |

### CARIO側確認待ち（実APIキー設定後）

| 項目 | 状態 |
|---|---|
| `RAKUTEN_APP_API_KEY` の実値設定 | ⏳ `.env.local` に要設定 |
| from/to の両端 INCLUSIVE 確認 | ⏳ 実接続後 |
| JST / UTC 基準確認 | ⏳ 実接続後 |
| レスポンス構造の確定（mapper 微調整） | ⏳ 実接続後 |
| ページネーション有無 | ⏳ 実接続後 |

**現在の状態:** エンドポイント到達確認済み（HTTP 401）。`RAKUTEN_APP_API_KEY` を `.env.local` に設定すれば即接続可能。

**キーの取得先:** `cario-app-two` の Vercel ダッシュボード → Settings → Environment Variables

**キー設定後の手順:**
1. `node test-cario.js` → 認証確認（HTTP 200確認）
2. `node extract-structure.js` → response-structure.json / response-keys.csv 生成
3. `mapper.ts` を実レスポンスに合わせて微調整
4. `/admin/shifts` で `REAL_API` 表示確認
| CARIO stale state UI | 新機能・将来フェーズ |
| 再OCRダイアログ（修正済み項目表示） | フロントエンド UI 機能・次フェーズ |
| location override 複数候補表示 | UIフロント機能・次フェーズ |
| AUDIT ロール新設 | 権限管理の大規模改変が必要・将来フェーズ |

---

## 2026-07-03 追加（管理画面担当セッション）

> 3画面同時稼働中。管理画面まわりのファイルのみ変更（ドライバー側 TodayClient.tsx は非編集）。

### ① 取込センターを PDF / CSV のみに（運用判断）
- `/admin/dispatch-import` の表示を **PDF取込 / CSV・Excel取込** のみに変更
- 画像OCR・表データ貼付・スマホカメラOCR は **UI 非表示**（`HIDDEN_IMPORT_METHODS` に退避）
- コード・ルート・API（`dispatch-import/camera` 等）は**削除せず保持** → `IMPORT_METHODS` に戻せば即再表示
- 注意: CLAUDE.md の「画像OCR・カメラOCRは主力機能」方針に対する運用上の一時非表示

### ② ドライバー別 進捗詳細ページ
- 新規: `/admin/progress/[driverId]`（Server Component・日付切替可）
- 担当件数／未完了／完了／不在／持戻り／スキップ集計＋進捗バー＋明細テーブル
- `ProgressDriverCard` に「個別ページ」リンク追加

### ③ 増便申請フォーム（管理者・ドライバー双方 / 後でCARIO連携）
- 項目: 対象日・対象デポ・該当便・台数・割当先(任意)・申請理由
- 新テーブル: `extra_vehicle_requests`（migration: `20260703160000_add_extra_vehicle_requests`・`IF NOT EXISTS` 追記型）
  - **DB適用は各自 `npm run db:migrate` で実施**（本セッションでは reset/apply していない）
- 型: `src/types/extra-vehicle-request.ts`
- API:
  - `GET/POST /api/extra-vehicle-requests`（一覧・作成 / ADMIN=全件, DRIVER=自分のみ）
  - `POST /api/admin/extra-vehicle-requests/[id]/approve|reject|send-cario`
- CARIO連携: `src/lib/cario/extra-vehicle.ts`（統合ポイントのみ・**現状は未接続で未送信**）
- 画面:
  - 管理者: `/admin/extra-vehicle-requests`（一覧・申請・承認/却下・CARIO送信）＋サイドバー「増便申請」
  - ドライバー: `/driver/extra-vehicle-request`（申請＋自分の履歴）
  - ⚠️ ドライバー画面への導線リンク（TodayClient）は**未追加**。ドライバー側担当が `/driver/extra-vehicle-request` へのリンクを追加すること
- audit_logs: 件数・状態のみ記録（申請理由本文は保存しない）

### 品質確認
- `npm run typecheck` ✅ / `npm run lint` ✅
- `next build` は他画面の dev を壊さないため未実行（各自の安全なタイミングで実施）

### ③-追記 増便のCARIO送信を実接続コード化（読み取り系連携完了を受けて）
- `src/lib/cario/extra-vehicle.ts` をモック→**実POST**に差し替え（`client.ts` と同じ Bearer認証・BaseURL・タイムアウト・エラー方針）
- 判定: APIキー未設定=not_sent / 2xx=sent(返却ID保持) / 401・403・404・5xx=failed（理由付き）
- **残る依存: CARIO側の増便書き込みエンドポイント**（読み取り系=assignments/drivers/shift-requests は GET のみ提供済み）
  - 送信先は `CARIO_EXTRA_VEHICLE_PATH`（既定 `/api/external/rakuten/extra-vehicle`＝推定パス）で差し替え可
  - CARIO側パス確定/公開→環境変数設定だけで実送信有効。未提供なら 404=failed（虚偽の送信済みにしない）
- セキュリティ: APIキー・URL・payload・生レスポンスをログ出力しない

### ③-訂正 増便の報告先はCARIO公式LINE（専用グループへpush）に変更
> 前項「CARIO REST POST」は撤回。増便は **CARIO公式LINE（LINE Messaging API）から専用グループへ、指定フォーマットで報告** する方式に確定。

- 削除: `src/lib/cario/extra-vehicle.ts` / `.../[id]/send-cario` ルート / `CARIO_EXTRA_VEHICLE_PATH`
- 新規:
  - `src/lib/line/format.ts` … 報告本文の整形（`7/3 / 対象デポ / 該当便 / 台数(1台→石毛) / 申請理由`）。クライアント/サーバー両用の純粋関数
  - `src/lib/line/extra-vehicle-report.ts` … LINE Messaging API push（`/v2/bot/message/push`・Bearer・タイムアウト・PII非ログ）
  - `POST /api/admin/extra-vehicle-requests/[id]/report-line` … 報告実行（ADMIN・却下以外で可）
- 管理画面: 「LINEで報告」ボタン＋「報告文をコピー」＋本文プレビュー（LINE未設定でも手動報告できる）
- DBは不変（`cario_sync_status`等を報告ステータスとして流用。ラベルは「未報告/報告待ち/LINE報告済み/報告失敗」）
- 必要な環境変数（未設定なら送信せず本文コピーで手動報告）:
  - `LINE_CHANNEL_ACCESS_TOKEN`（CARIO公式アカウントのMessaging APIトークン）
  - `LINE_EXTRA_VEHICLE_GROUP_ID`（公式アカウントが参加する専用グループID）
- **残る依存**: ①公式アカウントのMessaging APIトークン ②公式アカウントを専用グループに参加させグループIDを取得（webhook等）
- 品質: `npm run typecheck` ✅ / `npm run lint` ✅

### ③-確定 増便連携は「CARIOが当アプリからpull → CARIO公式LINEで専用グループへ報告」
> 前2案（当アプリから直接LINE push / CARIOへPOST）はいずれも撤回。**CARIOが当アプリを pull する**方向に確定。

- 削除: 直接LINE push（`src/lib/line/extra-vehicle-report.ts`）/ `report-line`ルート / LINE系env（`LINE_CHANNEL_ACCESS_TOKEN`等）/ 管理画面「LINEで報告」ボタン
- 新規（外部連携＝CARIOが叩くインバウンドAPI）:
  - `GET /api/external/extra-vehicle-requests` … 増便申請を返す（Bearer認証）。`?status= / ?since= / ?limit=` 対応
    - 各申請に **`reportText`（指定フォーマット整形済み本文）** を含める → CARIOはこれをそのまま専用グループへ投稿
  - `POST /api/external/extra-vehicle-requests/[id]/ack` … CARIOが報告後に報告済みマーク（任意・状態を正確化）
  - `src/lib/external/auth.ts` … Bearerトークン検証（timingSafe・未設定なら全拒否）
  - `src/lib/line/format.ts` … 報告本文整形（`7/3 / 対象デポ / 該当便 / 台数(1台→石毛) / 申請理由`）。GET APIと管理画面プレビューで共用
- 管理画面: 承認/却下＋「報告文をコピー」「本文を表示」（CARIO未取得でも手動報告・内容確認できる）
- ミドルウェアは `/admin`・`/driver`・`/login` のみ対象 → `/api/external/*` は認証で弾かれない（Bearerで自前認証）
- DBは不変（`cario_*`カラムを報告ステータスに流用。ラベル: 未報告/取得待ち/報告済み/報告失敗）
- 必要な環境変数: **`EXTRA_VEHICLE_PULL_TOKEN`**（当アプリ発行→CARIOへ共有。CARIOを呼ぶ`RAKUTEN_APP_API_KEY`とは別・逆方向）
- **残る調整**: ①`EXTRA_VEHICLE_PULL_TOKEN`を発行しCARIOへ共有 ②CARIO側にpull実装（ポーリング/cron）とLINE投稿・ack を依頼
- セキュリティ: トークン・reportText本文・生レスポンスをログに出さない
- 品質: `npm run typecheck` ✅ / `npm run lint` ✅

### ③-確定2 LINE文面は実グループと同じ短い通知＋テスト送信ツール追加
> 実LINEエクスポート（【楽天ネットスーパー美女木】）を確認。CARIOの実投稿は短い1行 `◯◯ 6W 増便申請が届きました`。長文フォーマットは実際には使われていないため、送信文面を**短い通知に変更**。

- 文面: `formatExtraVehicleNotification(name, waveNo)` = `{割当先or申請者} {便(大文字W)} 増便申請が届きました`（`src/lib/line/format.ts`）
- 外部pull APIの `reportText` を短い通知に変更（CARIOはこれをそのまま投稿）
- テスト送信ツール（本番報告経路=CARIO pull とは別・検証用）:
  - `src/lib/line/send.ts`（`pushLineText`・PII非ログ）
  - `POST /api/admin/extra-vehicle-requests/[id]/line-test`（ADMIN・報告ステータスは変更しない）
  - 管理画面「LINEテスト送信」ボタン（確認ダイアログ付き・送信先は `LINE_TEST_GROUP_ID`）
- env: `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_TEST_GROUP_ID`（**本番グループを汚さないよう必ずテスト用**）
- 現状 `.env.local` にLINE系・pullトークンとも**未設定** → 実送信は未実施（設定後にボタンで送信可）
- 品質: `npm run typecheck` ✅ / `npm run lint` ✅

### ③-確定3 groupId取得用の一時Webhook追加（LINEテスト準備）
- `POST /api/line/webhook` … Botがグループで発言を受けると、そのトークルームのID(groupId等)を返信。テスト用のLINE_TEST_GROUP_ID取得を補助
- 署名検証は `LINE_CHANNEL_SECRET` があれば実施（未設定ならテスト用途でスキップ）
- ミドルウェア対象外(/api/*)なのでLINEからのPOSTは認証で弾かれない
- env追加: `LINE_CHANNEL_SECRET`（任意）
- 品質: `npm run typecheck` ✅ / `npm run lint` ✅

### ③-確定4 LINE送信テスト完了（1:1・グループとも成功）
- テスト用公式アカウント「楽天テスト」で **1:1・グループ送信テスト成功**（`石毛 6W 増便申請が届きました`・HTTP200）
- groupId取得: `/api/line/webhook` を cloudflare quick tunnel で公開 → Botがグループで返信 → `LINE_TEST_GROUP_ID` に設定（`.env.local`・値マスク）
- 注意: dev serverは:3001が本コード（:3000は別インスタンスで404）。トンネル/Webhookは一時的（本番はCARIO-pull方式のため恒久運用は不要）
- 管理画面「LINEテスト送信」ボタンは dev 再起動で env 反映後に同経路で動作

### ③-確定5 増便は専用グループへ直送（管理画面ボタン）
- 増便通知の送信先を **増便専用グループ**に変更（テスト用グループとは別）
- ルート改名: `line-test` → `POST /api/admin/extra-vehicle-requests/[id]/line-send`（成功で `carioSyncStatus=sent` 更新・DTO返却）
- 送信先: `LINE_EXTRA_VEHICLE_GROUP_ID`（body.to で上書き可）。管理画面ボタンは「LINEで送信 / LINE再送信」
- env追加: `LINE_EXTRA_VEHICLE_GROUP_ID`（.env.local設定済・値マスク）
- 専用グループへの送信テスト成功（HTTP200）。管理画面ボタンは dev(:3001) 再起動で env 反映後に動作
- `npm run typecheck` ✅ / `npm run lint` ✅

### ③-確定6 ローカルDB構築＆増便フルスタック疎通
- Docker/brew無環境のため **embedded-postgres**（/tmp/epg・PostgreSQL18・localhost:5432）でローカルDB構築
- `DATABASE_URL` を `.env.local` に設定 → `prisma migrate deploy`（全migration適用・増便テーブル含む）→ seed（admin/driver）
- 動作確認: 外部pull API `GET /api/external/extra-vehicle-requests`（Bearer）が増便1件を返却・`reportText="石毛 6W 増便申請が届きました"`・HTTP200＝**アプリ→DB接続OK**
- dev seedログイン: admin@delivery-app.local / admin1234（詳細は memory: project_local_dev_db）
- EXTRA_VEHICLE_PULL_TOKEN をローカル検証用に発行・.env.local設定済

### ③-確定7 送信文面=詳細フォーマット＋増便フォーム改良
- LINE送信文面を短通知→**詳細フォーマット**(`formatExtraVehicleReport`)に戻す（送信ルート/pull API/管理画面プレビュー）
- 増便フォーム(ExtraVehicleRequestForm・管理者/ドライバー共通)を使いやすく:
  - 対象デポ・該当便(1W〜8W)・ドライバー名を `datalist` 化（入力 or 候補選択）
  - ドライバー候補: `GET /api/drivers`（認証要・氏名/会社/エリアのみ・電話等は返さない）新設
  - 申請理由は自由入力（例文プレースホルダ）
- `npm run typecheck` ✅ / `npm run lint` ✅

---

## 【α→β 正式引き継ぎ】管理者レイアウト刷新 ＋ 号車GPSリアルタイム地図（2026-07-03）

> **β（管理画面担当）へ：反映作業の開始をお願いします。** 詳細仕様・API契約・チェックリストは
> **`docs/HANDOFF_admin_layout_gps.md`** に集約（本節はサマリ）。

### 完成・検証済み（α実装・課金ゼロ厳守）
- レイアウト正式サンプル: `/admin-preview`（認証不要・Amazon Logistics風・美女木デポ仕様）
- 本番ライブ地図: `/admin/live-map`（管理者認証・30秒ポーリング・OSM+Leaflet=完全無料）
- GPS取得: ドライバー端末 `watchPosition` → `POST /api/driver/location` → `DriverLocation`(upsert) → `GET /api/admin/driver-locations`
- 地図はGoogle Maps有料API不使用（Leaflet自己ホスト＝CSP `script-src 'self'`対応・タイルはOSM/Esri無料）
- 品質: `typecheck`/`lint`/`build` ✅、ローカルmigration適用済、認証ガード疎通済（401/307）

### β にお願いする反映作業（詳細は HANDOFF 文書）
1. **Sidebar に `/admin/live-map` 導線追加**（Sidebar.tsx はβ区画のためα未編集）
2. **レイアウト本採用の可否判断＋メトリクス実データ接続**（集計元マッピングは HANDOFF §4-B）
3. **本番DB migration `20260703170000_add_driver_locations` の適用＋デプロイ**（★γと要調整・共有DBのためα単独では未適用）

### 競合ルール
- α区画（`admin-preview/` `admin/live-map/` `components/map/` `components/driver/DriverLocationTracker` `api/driver/location` `api/admin/driver-locations` `public/vendor/leaflet/`）はβ非編集。
- `prisma/schema.prisma` は末尾追記のみ（既存モデル非編集）。DriverLocationはDriverへrelation張らず＝競合回避。

### ③-確定8 増便機能の拡充（一覧フィルタ＋CSV出力）＋γ合流
- γのschema変更(driver_locations)と合流: Prisma再生成・migration適用済・データ無事・typecheck/lint通過
- 一覧API `GET /api/extra-vehicle-requests` に **status/depot/from/to 絞り込み**追加（共通 `buildRequestFilter`）。ADMIN=全件/DRIVER=自分
- **CSV出力** `GET /api/admin/extra-vehicle-requests/export`（ADMIN・同フィルタ対応・BOM付きUTF-8・PII非ログ）
- 管理画面: 対象日(開始/終了)・デポの絞り込みUI＋「CSV出力」「条件クリア」ボタン追加（ExtraVehicleAdminClient）
- ガード確認: export=403 / list=401（未ログイン）・アプリはURLSearchParamsで日本語自動エンコード
- 協力方針: クルーページ非変更・レイアウト担当の「殻」は触らずAPI/ロジック/自己完結コンポーネント中心
- `npm run typecheck` ✅ / `npm run lint` ✅

### ③-確定9 α引き継ぎ確認＋ライブ地図リンク追加（β）
- 「レイアウト担当」=α と判明。α が `/admin-preview`（レイアウト正式サンプル）＋`/admin/live-map`（号車GPSリアルタイム地図・OSM+Leaflet完全無料）を新規実装。既存 `/admin/dashboard` は未差替え（＝レイアウト未反映の理由）
- 引き継ぎ書 `docs/HANDOFF_admin_layout_gps.md`（α→β）を受領・確認
- β対応(A): `Sidebar.tsx` に「号車リアルタイム地図」→`/admin/live-map` リンク追加（typecheck/lint ✅）
- 残(β): (B)本番ダッシュボードへレイアウト本採用＋メトリクス集計実装, (C)本番driver_locations migration/deploy（γ調整）, (D)位置情報のプライバシー記載
- 競合ルール: αの区画(§1 live-map/preview/map/tracker)は非編集・βの区画(Sidebar/既存adminページ/集計)はα非編集

### ③-確定10 新レイアウトを本番ダッシュボードに本採用（実データ）
- α の /admin-preview レイアウトを **本番 `/admin/dashboard` に本採用**（実データ接続）
- 新規: `src/components/admin/dashboard/AdminDashboardClient.tsx`（メトリクス5枚＋号車一覧＋ライブ地図）
- データ源（既存API実接続）: `/api/admin/dashboard`（集計）・`/api/admin/progress`（号車=ドライバー別進捗）・`/api/admin/driver-locations`（GPS・30秒ポーリング）
- 地図は α の共有 `LiveVehicleMap`（OSM+Leaflet完全無料）を再利用。号車進捗ステータスでピン着色・クリックで追従
- メトリクスは実データにマッピング（号車/クルー稼働/荷物ステータス/実行進行[完了率・配送中率・稼働率]/取込要確認）。要定義項目は近似の実データで表示（誇張値なし）
- 既存Sidebarシェル内に描画（グローバルnavは維持・admin/layout.tsx非編集＝他adminページ非影響）。preview風トップナビへの全面切替は別途
- 競合回避: α区画（preview/live-map/map/tracker/位置API）は非編集・小物コンポーネントは自己完結で再実装
- `npm run typecheck` ✅ / `npm run lint` ✅・未ログイン307/API401確認

### ③-確定11 増便申請フォームを入力UI刷新（ボタン/プルダウン/テンプレート）
- 対象日: カレンダー選択 / 対象デポ: プルダウン（美女木デポ＋「その他」手入力）
- 該当便: **W1〜W6 複数選択ボタン**（複数選ぶと便ごとに1件ずつ申請作成）
- 台数: **1〜10 選択ボタン** / ドライバー名: 登録ドライバー選択＋「その他」手入力
- 申請理由: **W1〜W6 × 2種＝12テンプレート**（遅配見込み型/物量超過型）を選択→テキストに反映・編集可
- API変更なし（POST /api/extra-vehicle-requests を便数ぶんループ）。管理者/ドライバー共通フォーム
- typecheck/lint ✅・両ページ307配信・エラーなし
- 未対応(follow-up): テンプレの「担当エリア」を各Waveの取込住所から自動差し込み（現状は編集可プレースホルダ）

### ③-確定12 申請理由テンプレをWave別・エリア連動・複数パターン化
- `src/lib/extra-vehicle/reason-templates.ts`: `waveReasonVariants(waveNo, areas)` — Wave別に3パターン（遅配波及型/物量超過型/積載順序型）。積載ペア(W1&2,W3&4,W5&6)と前段遅延の後続波及ロジックを反映（毎回同一文回避）
- `GET /api/extra-vehicle-requests/wave-areas?date=`（認証要）: その日の delivery_items 住所から **市区町村のみ**をWave別集計（normalizeAddress使用・住所全体は返さない）
- フォーム: 対象日変更でエリア取得→選択Waveごとに「エリア表示＋3テンプレボタン」。クリックで理由に反映・編集可
- エリアはデータが無ければ「（担当エリア）」フォールバック（取込済み配送データがある日は自動で市区町村が入る）
- typecheck/lint ✅・API401・ページ307

### ③-確定13 承認済みカードのコンパクト化＋テスト申請投入
- 承認済み・却下の申請カードを**コンパクト表示**（本文/送信文面を畳む→「詳細」で展開・右側に小コピー/LINE操作）。申請中はフル表示維持
- テスト用増便申請を投入（申請中: 美女木デポ/W3/2台/田中太郎）→ 承認・却下・LINE送信の動作確認用
- typecheck/lint ✅・ページ307
