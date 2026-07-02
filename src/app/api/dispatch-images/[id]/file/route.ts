import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { storageProvider } from "@/lib/storage";

/**
 * 配送表画像を認証付きで配信するプロキシ。
 *
 * ブラウザには生の Blob URL を渡さず、この認証済みエンドポイント経由でのみ画像を返す。
 * ADMIN セッションが必須。個人情報を含む配送表画像の直接公開を防ぐ。
 * （ストレージ層の read はサーバー側で実行され、URL はクライアントに露出しない）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const image = await prisma.dispatchImage.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  if (!image) return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await storageProvider.read(image.imageUrl);
  } catch {
    // ❌ URL やストレージ詳細はレスポンス／ログに出さない
    return NextResponse.json({ error: "画像の読み込みに失敗しました" }, { status: 502 });
  }

  const contentType = contentTypeFromUrl(image.imageUrl);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // 個人情報を含むため共有キャッシュ・CDN に残さない
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

function contentTypeFromUrl(url: string): string {
  const clean = url.split("?")[0]!.toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
