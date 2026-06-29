import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { storageProvider } from "@/lib/storage";
import {
  generateDispatchImageFilename,
  getExtension,
  isAllowedExtension,
} from "@/lib/storage/filename";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "フォームデータの解析に失敗しました" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
  }

  const ext = getExtension(file.name);
  if (!isAllowedExtension(ext)) {
    return NextResponse.json(
      { error: "対応形式は jpg / jpeg / png / webp のみです" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "ファイルサイズは 10MB 以下にしてください" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // 配送日・エリア・W番号は OCR で自動抽出するため暫定値を使用
  const now = new Date();
  const filename = generateDispatchImageFilename(
    now.toISOString().split("T")[0],
    "auto",
    "auto",
    ext
  );

  const { url, storagePath } = await storageProvider.save(buffer, filename);

  const record = await prisma.dispatchImage.create({
    data: {
      deliveryDate: now, // OCR 後に更新される
      area: null,        // OCR 後に更新される
      waveNo: null,      // OCR 後に更新される
      imageUrl: url,
      ocrStatus: "PENDING",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPLOAD_DISPATCH_IMAGE",
      targetType: "dispatch_images",
      targetId: record.id,
      afterData: { url, storagePath, filename },
    },
  });

  return NextResponse.json({ success: true, data: record }, { status: 201 });
}
