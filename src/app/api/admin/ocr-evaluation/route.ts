import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/** POST: 正解セットを作成 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { name, dispatchImageId, items } = await req.json();
  if (!name || !dispatchImageId || !Array.isArray(items)) {
    return NextResponse.json({ error: "name, dispatchImageId, items は必須" }, { status: 400 });
  }

  const set = await prisma.ocrGroundTruthSet.create({
    data: {
      name,
      dispatchImageId,
      items: {
        create: items.map((item: Record<string, unknown>, idx: number) => ({
          rowNo: idx + 1,
          dispatchKey: item.dispatchKey as string ?? null,
          invoiceNo: item.invoiceNo as string ?? null,
          customerName: item.customerName as string ?? null,
          customerPhone: item.customerPhone as string ?? null,
          address: item.address as string ?? null,
          normalOriconCount: item.normalOriconCount as number ?? null,
          coolerBoxCount: item.coolerBoxCount as number ?? null,
          caseCount: item.caseCount as number ?? null,
          totalCount: item.totalCount as number ?? null,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json({ id: set.id, name: set.name, itemCount: set.items.length });
}

/** GET: 正解セット一覧 */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const sets = await prisma.ocrGroundTruthSet.findMany({
    include: { items: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sets.map((s) => ({ id: s.id, name: s.name, itemCount: s.items.length, createdAt: s.createdAt })));
}
