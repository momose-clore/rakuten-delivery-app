"use client";

/**
 * プレビュー入口ページ（デザイン確認用の分かりやすい入口）
 * localhost:3001/preview からクルー画面の各レイアウトへ飛べる。
 * DB / 認証 不要。middleware 対象外。本番には影響しない。
 */

import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";

const NAVY = "#26324F";

const LINKS = [
  { href: "/driver-lab", title: "クルー画面（新デザイン案）", desc: "デザイン部門の統合案。Next Stopヒーロー＋下部アクションバー", tag: "おすすめ" },
  { href: "/driver-preview", title: "クルー画面（ハブ案）", desc: "到着連絡/カメラ/フォロー＋W1〜W6進捗＋フォロー中の配送", tag: "" },
];

export default function PreviewIndex() {
  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <header className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Image src="/brand/clore-logo-full.png" alt="CLORE" width={1254} height={1254} className="h-10 w-10 object-contain" />
          <span className="text-sm font-semibold tracking-[0.18em]" style={{ color: NAVY }}>DELIVERY — プレビュー</span>
        </div>
        <div className="h-[2px]" style={{ background: "linear-gradient(90deg, #d8b45c, #b8923f)" }} />
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-3">
        <p className="text-sm text-gray-500">確認したいレイアウトを選んでください（サンプルデータ・本番には影響しません）</p>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}
            className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-bold" style={{ color: NAVY }}>{l.title}</p>
                  {l.tag && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white" style={{ background: "#b8923f" }}>{l.tag}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{l.desc}</p>
                <p className="text-[11px] text-gray-400 mt-1 font-mono">{l.href}</p>
              </div>
              <ChevronRight className="text-gray-300 shrink-0" size={20} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
