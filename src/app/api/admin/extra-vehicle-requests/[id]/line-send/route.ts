import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { pushLineText } from "@/lib/line/send";
import { formatExtraVehicleReport } from "@/lib/line/format";
import { toDTO } from "@/app/api/extra-vehicle-requests/route";

// POST: 増便通知を LINE の増便専用グループへ送信（ADMIN のみ）
//
// 送信先: body.to → LINE_EXTRA_VEHICLE_GROUP_ID（増便専用グループ）
// 成功したら報告ステータス(carioSyncStatus)を sent に更新する。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const r = await prisma.extraVehicleRequest.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
  if (r.status === "rejected") {
    return NextResponse.json({ error: "却下済みの申請は送信できません" }, { status: 400 });
  }

  let to: string | undefined;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.to === "string" && body.to.trim()) to = body.to.trim();
  } catch {
    // body なしなら専用グループへ
  }
  to = to ?? process.env.LINE_EXTRA_VEHICLE_GROUP_ID;

  if (!to) {
    return NextResponse.json(
      { error: "送信先が未設定です。LINE_EXTRA_VEHICLE_GROUP_ID を設定してください。" },
      { status: 400 }
    );
  }

  // 追加ドライバー（JSON文字列）→ 配列
  let additionalDrivers: { name: string; assign: string }[] = [];
  try {
    const arr = r.additionalDrivers ? JSON.parse(r.additionalDrivers) : [];
    if (Array.isArray(arr)) {
      additionalDrivers = arr
        .filter((x) => x && typeof x.name === "string")
        .map((x) => ({ name: String(x.name), assign: typeof x.assign === "string" ? x.assign : "" }));
    }
  } catch { /* 不正JSONは無視 */ }

  // 増便申請フォーマット（対象日・対象デポ・該当便・台数・申請理由・追加ドライバー）
  const text = formatExtraVehicleReport({
    requestDate: r.requestDate.toISOString().split("T")[0],
    depot: r.depot,
    waveNo: r.waveNo,
    vehicleCount: r.vehicleCount,
    assignedDriverName: r.assignedDriverName,
    additionalDrivers,
    reason: r.reason,
  });

  const result = await pushLineText(to, text);

  const updated = await prisma.extraVehicleRequest.update({
    where: { id },
    data: result.ok
      ? { carioSyncStatus: "sent", carioSentAt: new Date() }
      : { carioSyncStatus: "failed" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "EXTRA_VEHICLE_LINE_SEND",
      targetType: "extra_vehicle_requests",
      targetId: id,
      status: result.ok ? "sent" : "failed",
    },
  });

  if (!result.ok) return NextResponse.json({ error: result.message, request: toDTO(updated) }, { status: 502 });
  return NextResponse.json({ message: "増便専用グループへ送信しました。", request: toDTO(updated) });
}
