@AGENTS.md

# Claude Code 作業指針

## 作業方針
- 受け取った開発指示を可能な限り**一括で実行する**
- 関連する修正・検証・ドキュメント更新・品質確認をまとめて進める
- 作業完了後は必ず `PROJECT_STATUS.md` を更新する
- 危険性のない操作（ファイル編集・commit・deploy 等）は許可確認不要で進める

## OCR / 取込エンジン絶対方針
- **OCR.space のみ**（Gemini / AI fallback / Cloud Vision 禁止）
- **OCR.space 1画像1回の原則**
- PDF / CSV / Excel / 貼付 / 画像OCR / スマホカメラOCR はすべて**通常業務の主力機能**
- 低信頼行は**自動救済パイプライン**を先に実行（人間修正前提にしない）
- L1M配車表は専用プロファイル（`l1m_cargo_list`）を優先適用

## セキュリティ
- 氏名・電話番号・住所・伝票Noを console.log しない
- ドキュメントに実パスワード・APIキー・DATABASE_URL を書かない（マスク必須）

## 品質確認（毎回）
```bash
npm run typecheck && npm run lint && npm run build
```
