import Link from "next/link";

// 管理画面の取込センターは PDF と CSV/Excel のみを表示する方針（運用判断）。
// 画像OCR・貼付・スマホカメラOCR は当面 UI 非表示。コード/ルート/API は残しているため、
// 下の HIDDEN_IMPORT_METHODS を IMPORT_METHODS に戻せば即再表示できる。
const IMPORT_METHODS = [
  {
    id: "pdf",
    title: "PDF取込",
    description: "PDF形式の配送表を読み込みます。テキストデータがある場合はOCRせずに取り込みます。",
    icon: "📄",
    href: "/admin/dispatch-images",  // 既存画面に統合
    available: true,
  },
  {
    id: "file",
    title: "CSV / Excel取込",
    description: "列構造のあるデータを読み込みます。.csv / .xlsx / .xls に対応しています。",
    icon: "📊",
    href: "/admin/dispatch-import/file",
    available: true,
  },
];

// UI 非表示（コード・ルートは保持。再表示する場合は IMPORT_METHODS に含める）
const HIDDEN_IMPORT_METHODS = [
  {
    id: "paste",
    title: "表データ貼り付け",
    description: "配送サイトの表をコピーして貼り付けます。タブ区切り・カンマ区切り・HTMLに対応しています。",
    icon: "📋",
    href: "/admin/dispatch-import/paste",
    available: true,
  },
  {
    id: "image",
    title: "画像OCR取込",
    description: "画像データの配送表をOCRで読み込みます。JPEG / PNG / WEBP に対応しています。",
    icon: "🖼️",
    href: "/admin/dispatch-images",
    available: true,
  },
  {
    id: "camera",
    title: "スマホカメラOCR",
    description: "スマホで撮影した配送表を補正してOCRで読み込みます。L1M貨物一覧表専用の高精度解析を実行します。",
    icon: "📱",
    href: "/admin/dispatch-import/camera",
    available: true,
  },
];
void HIDDEN_IMPORT_METHODS;

export default function DispatchImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">配送表取込</h1>
        <p className="mt-1 text-sm text-gray-500">
          L1M貨物一覧表／配車予定表を、PDF または CSV / Excel から取り込めます
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORT_METHODS.map((method) => (
          <Link
            key={method.id}
            href={method.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div className="text-3xl mb-3">{method.icon}</div>
            <h2 className="font-semibold text-gray-900 mb-1">{method.title}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{method.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
