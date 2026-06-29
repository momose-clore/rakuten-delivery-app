import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { OcrStatusBadge } from "@/components/dispatch/OcrStatusBadge";

export default async function OcrReviewIndexPage() {
  const images = await prisma.dispatchImage.findMany({
    where: { ocrStatus: { in: ["REVIEW_REQUIRED", "CONFIRMED", "ERROR"] } },
    orderBy: { importedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">OCR確認</h1>
        <p className="mt-1 text-sm text-gray-500">
          OCR処理済みの配車表を確認・修正します
        </p>
      </div>

      {images.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">確認待ちの配車表はありません</p>
          <Link
            href="/admin/dispatch-images"
            className="mt-3 inline-block text-sm text-blue-600 hover:underline"
          >
            配車表取込画面へ →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["配送日", "エリア", "W番号", "OCRステータス", "取込日時", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {images.map((img) => (
                <tr key={img.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    {new Date(img.deliveryDate).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{img.area ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{img.waveNo ?? "—"}</td>
                  <td className="px-4 py-3">
                    <OcrStatusBadge status={img.ocrStatus} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(img.importedAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/ocr-review/${img.id}`}
                      className="text-sm px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      確認・修正
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
