// 【一時廃止・停止中】楽天スーパーのクルー（ドライバー）向け画面は一時停止。
// /driver/* のすべてを「停止のお知らせ」に置換し、children（各ドライバーページ）は描画しない。
// GPS トラッカー（DriverLocationTracker）も非マウント＝位置送信は一切行わない。
//
// ▼ 復帰方法（再開する時）：
//   以前の実装に戻す:
//     import Link from "next/link";
//     import { requireDriver } from "@/lib/auth/permissions";
//     import { DriverLocationTracker } from "@/components/driver/DriverLocationTracker";
//     export default async function DriverLayout({ children }) {
//       await requireDriver();
//       return (<><DriverLocationTracker />{children}<footer>…privacy…</footer></>);
//     }

export default function DriverLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f5f7] px-6 text-center">
      <div className="max-w-sm">
        <div className="mb-3 text-5xl">🚧</div>
        <h1 className="text-lg font-bold text-gray-900">クルー画面は現在停止しています</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          楽天スーパーのクルー（ドライバー）向け画面は一時的に停止しています。<br />
          再開までしばらくお待ちください。
        </p>
      </div>
    </div>
  );
}
