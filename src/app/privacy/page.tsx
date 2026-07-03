import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | CLORE DELIVERY",
  description: "楽天スーパー配送アプリ プライバシーポリシー（個人情報保護方針）",
};

// 個人情報保護方針の閲覧ページ（ログイン不要の公開ページ）。
// 正典は docs/PRIVACY_POLICY.md。本ページはその閲覧用ミラー。
// 【要設定】の箇所は事業者情報が確定次第、置き換える。
export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      <div className="max-w-3xl mx-auto px-5 py-10 leading-relaxed">
        <h1 className="text-2xl font-bold text-gray-900">プライバシーポリシー</h1>
        <p className="mt-1 text-sm text-gray-500">最終改定日: 2026年7月3日</p>

        <p className="mt-6 text-sm">
          <span className="text-gray-500">【要設定：事業者名】</span>
          （以下「当社」）は、配送業務支援アプリ「楽天スーパー配送アプリ」（以下「本アプリ」）における個人情報の取扱いについて、個人情報の保護に関する法律その他の関係法令を遵守し、以下のとおり本ポリシーを定めます。
        </p>

        <Section title="1. 事業者情報">
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>事業者名：<Todo>正式名称</Todo></li>
            <li>所在地：<Todo>住所</Todo></li>
            <li>個人情報保護管理者：<Todo>氏名・部署</Todo></li>
            <li>問い合わせ窓口：<Todo>メール／電話</Todo></li>
          </ul>
        </Section>

        <Section title="2. 取得する個人情報">
          <p className="text-sm">本アプリは配送業務の遂行のため、次の個人情報を取得・取扱いします。</p>
          <h3 className="mt-3 font-semibold text-sm">配送先（お客様）</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>氏名、住所（および緯度・経度等の位置情報）、電話番号</li>
            <li>伝票番号（配送No）・配車番号、配送品目・数量・配送ステータス</li>
            <li>配車表（PDF・画像・Excel・CSV・カメラ撮影画像）に含まれる上記情報</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            ※これら配送先情報の多くは、配送委託元（楽天グループおよび配車管理システム「CARIO」）から委託を受けて取り扱うものを含みます。
          </p>
          <h3 className="mt-3 font-semibold text-sm">ドライバー（従業員・委託クルー）</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>氏名、所属会社名、担当エリア、車両番号</li>
            <li>ログイン用メールアドレス・パスワード（ハッシュ化して保存）</li>
            <li>業務中の位置情報（進捗・見守り機能利用時）、出勤・シフト・増便申請情報</li>
          </ul>
          <h3 className="mt-3 font-semibold text-sm">自動的に取得する情報</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>アクセスログ・操作ログ・監査ログ（氏名・電話番号・住所・伝票番号などの値は記録せず、項目名・処理種別・ステータスのみ）</li>
            <li>Cookie・セッション情報（ログイン状態の維持等に限る）</li>
          </ul>
        </Section>

        <Section title="3. 利用目的">
          <ol className="list-decimal pl-5 text-sm space-y-1">
            <li>配送業務の受託・遂行、配車・ルート編成・配送進捗管理</li>
            <li>配車表のOCRによる取込・データ化</li>
            <li>配送先住所の地図表示・ナビゲーション・座標補正</li>
            <li>増便申請の受付・関係者への連絡・報告</li>
            <li>ドライバーの認証・シフト管理・業務連絡</li>
            <li>品質向上、不具合対応、セキュリティ確保、監査対応</li>
            <li>法令に基づく対応、当社の権利・財産の保護</li>
          </ol>
        </Section>

        <Section title="4. 予測値・推定値の取扱い">
          <p className="text-sm">
            OCR結果・自動補正値・地図APIによる座標は<strong>推定値</strong>として確定値と区別して管理します。座標は初期状態では「推定」、管理者が承認したもののみ「確定」として扱い、自動処理で上書きしません。推定値・低信頼値は画面上で明示し、誤配送防止に努めます。
          </p>
        </Section>

        <Section title="5. 安全管理措置">
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>役割（管理者／ドライバー）に基づくアクセス・認可制御。ドライバーは自身の割当分のみ参照・更新可能</li>
            <li>パスワードは bcrypt でハッシュ化。認証トークンの比較はタイミングセーフに実施</li>
            <li>HTTPS による暗号化通信、セキュリティヘッダー（HSTS 等）の適用</li>
            <li>ログ・監査ログに氏名・電話番号・住所・伝票番号等の値を出力しない</li>
            <li>画像取得元を自社ストレージに限定（SSRF 対策）</li>
            <li>定期的なセキュリティレビュー・依存脆弱性の監視</li>
            <li><strong>外的環境の把握</strong>：個人データの一部は国外クラウド（<Todo>例 米国等</Todo>）で保管・処理され、当該国の制度を踏まえた安全管理措置を講じます</li>
          </ul>
        </Section>

        <Section title="6. 第三者提供・業務委託">
          <p className="text-sm">法令に基づく場合等を除き、本人の同意なく第三者提供しません。利用目的の達成に必要な範囲で、以下へ取扱いを委託し、適切に監督します。</p>
          <ul className="list-disc pl-5 text-sm space-y-1 mt-2">
            <li>CARIO（配車管理／楽天グループ）：配車データ連携・増便申請の授受</li>
            <li>OCR.space：配車表画像の文字認識（氏名・住所・電話・伝票No等を含む画像）</li>
            <li>Google（Geocoding／Maps）：住所の座標化・地図表示・ナビ</li>
            <li>LINE（Messaging API）：増便申請等の業務連絡・報告</li>
            <li>Vercel（ホスティング／Blob）／PostgreSQL：本アプリの稼働・データ保管</li>
          </ul>
        </Section>

        <Section title="7. 外国にある第三者への提供">
          <p className="text-sm">
            上記委託先の一部（OCR.space・Google・LINE・Vercel 等）は日本国外にサーバー・事業拠点を有する場合があり、個人情報が外国で取り扱われることがあります。とりわけ配車表画像（氏名・住所・電話番号・伝票番号等を含む）のOCR処理は国外事業者により行われる場合があります。当社は個人情報保護法第28条に基づき必要な対応を行い、本人同意による場合は提供先の国名・当該国の制度・提供先の保護措置に関する参考情報を提供します。詳細は問い合わせ窓口にてご確認いただけます。
          </p>
          <p className="mt-2 text-xs text-gray-500">対象国・リージョン：<Todo>各委託先の保管国を確認のうえ記載</Todo></p>
        </Section>

        <Section title="8. 保存期間">
          <p className="text-sm">利用目的の達成に必要な期間または法令で定められた期間保存し、経過後は速やかに消去・匿名化します（配送関連情報・アカウント情報・OCR画像の各保存期間：<Todo>期間を設定</Todo>）。</p>
        </Section>

        <Section title="9. ご本人の権利">
          <p className="text-sm">
            ご本人は、保有個人データについて利用目的の通知・開示・訂正・追加・削除・利用停止・第三者提供の停止を請求できます。問い合わせ窓口へご連絡ください（本人確認のうえ合理的期間内に対応）。手数料：<Todo>有無・金額（無料なら「無料」）</Todo>。委託元から受託した配送先情報は委託元の手続きに従う場合があります。
          </p>
        </Section>

        <Section title="10. Cookie 等の利用">
          <p className="text-sm">ログイン状態の維持等に必要な範囲で Cookie・セッション情報を利用し、広告目的のトラッキングには使用しません。</p>
        </Section>

        <Section title="11. 本ポリシーの改定">
          <p className="text-sm">法令の変更や運用見直しに応じて改定することがあります。重要な変更は本アプリ上での掲示等で周知し、掲載時点から効力を生じます。</p>
        </Section>

        <Section title="12. お問い合わせ・苦情申出先">
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>事業者名：<Todo>正式名称</Todo></li>
            <li>窓口（苦情申出先）：<Todo>担当部署・氏名</Todo></li>
            <li>メール：<Todo>例 riku@clorellc.jp</Todo></li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">個人情報の取扱いに関するご相談は、個人情報保護委員会（PPC）の相談窓口もご利用いただけます。</p>
        </Section>

        <div className="mt-10 border-t pt-6">
          <Link href="/driver/today" className="text-sm text-[#b8923f] underline">
            ← 戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-bold text-gray-900 border-l-4 border-[#b8923f] pl-2">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

// 事業者情報が未確定の箇所を視覚的に示すプレースホルダ。確定後に置換する。
function Todo({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-400">【要設定：{children}】</span>;
}
