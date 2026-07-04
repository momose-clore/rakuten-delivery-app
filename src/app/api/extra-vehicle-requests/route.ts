import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import type {
  ExtraVehicleRequestDTO,
  ExtraVehicleRequestStatus,
  CarioSyncStatus,
  RequesterRole,
} from "@/types/extra-vehicle-request";

// Prisma の増便申請レコード → API DTO（型は最小限で受ける）
type Row = {
  id: string;
  requestDate: Date;
  depot: string;
  waveNo: string;
  vehicleCount: number;
  assignedDriverName: string | null;
  reason: string;
  status: string;
  createdByRole: string;
  createdByName: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  carioSyncStatus: string;
  carioSentAt: Date | null;
  createdAt: Date;
};

export function toDTO(r: Row): ExtraVehicleRequestDTO {
  return {
    id: r.id,
    requestDate: r.requestDate.toISOString().split("T")[0],
    depot: r.depot,
    waveNo: r.waveNo,
    vehicleCount: r.vehicleCount,
    assignedDriverName: r.assignedDriverName,
    reason: r.reason,
    status: r.status as ExtraVehicleRequestStatus,
    createdByRole: r.createdByRole as RequesterRole,
    createdByName: r.createdByName,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    rejectedReason: r.rejectedReason,
    carioSyncStatus: r.carioSyncStatus as CarioSyncStatus,
    carioSentAt: r.carioSentAt ? r.carioSentAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET: 一覧
//   ADMIN   → 全件（?status= で絞り込み可）
//   DRIVER  → 自分の申請のみ
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const isAdmin = session.user.role === "ADMIN";
  const rows = await prisma.extraVehicleRequest.findMany({
    where: {
      ...(isAdmin ? {} : { createdByUserId: session.user.id }),
      ...buildRequestFilter(req.nextUrl.searchParams),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests: rows.map(toDTO) });
}

// 一覧/CSV共通の絞り込み条件を組み立てる（status / depot / from / to）。
// requestDate(@db.Date) の from/to は YYYY-MM-DD で日付範囲を指定。
export function buildRequestFilter(sp: URLSearchParams) {
  const status = sp.get("status") || undefined;
  const depot = sp.get("depot")?.trim() || undefined;
  const fromStr = sp.get("from");
  const toStr = sp.get("to");

  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(toStr) : undefined;
  const dateFilter: Record<string, Date> = {};
  if (from && !Number.isNaN(from.getTime())) dateFilter.gte = from;
  if (to && !Number.isNaN(to.getTime())) dateFilter.lte = to;

  return {
    ...(status ? { status } : {}),
    ...(depot ? { depot: { contains: depot } } : {}),
    ...(Object.keys(dateFilter).length ? { requestDate: dateFilter } : {}),
  };
}

// POST: 新規申請（ADMIN / DRIVER 双方）
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const requestDate = typeof b.requestDate === "string" ? b.requestDate.trim() : "";
  const depot = typeof b.depot === "string" ? b.depot.trim() : "";
  const waveNo = typeof b.waveNo === "string" ? b.waveNo.trim() : "";
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  const vehicleCountRaw = b.vehicleCount;
  const vehicleCount =
    typeof vehicleCountRaw === "number"
      ? Math.floor(vehicleCountRaw)
      : parseInt(String(vehicleCountRaw ?? ""), 10);
  const assignedDriverName =
    typeof b.assignedDriverName === "string" && b.assignedDriverName.trim()
      ? b.assignedDriverName.trim()
      : null;

  if (!requestDate || !depot || !waveNo || !reason) {
    return NextResponse.json(
      { error: "対象日・対象デポ・該当便・申請理由は必須です" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(vehicleCount) || vehicleCount < 1) {
    return NextResponse.json({ error: "台数は1以上で入力してください" }, { status: 400 });
  }
  const parsedDate = new Date(requestDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "対象日の形式が不正です" }, { status: 400 });
  }

  // 申請者表示名（ドライバーはドライバー名、管理者はメール）
  let createdByName: string | null = session.user.email ?? null;
  if (session.user.role === "DRIVER" && session.user.driverId) {
    const driver = await prisma.driver.findUnique({
      where: { id: session.user.driverId },
      select: { name: true },
    });
    createdByName = driver?.name ?? createdByName;
  }

  const created = await prisma.extraVehicleRequest.create({
    data: {
      requestDate: parsedDate,
      depot,
      waveNo,
      vehicleCount,
      assignedDriverName,
      reason,
      status: "pending",
      createdByUserId: session.user.id,
      createdByRole: session.user.role,
      createdByName,
    },
  });

  // 個人情報（理由本文）はログに残さない。件数・状態のみ。
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "EXTRA_VEHICLE_REQUEST_CREATED",
      targetType: "extra_vehicle_requests",
      targetId: created.id,
      status: "pending",
    },
  });

  return NextResponse.json({ request: toDTO(created) }, { status: 201 });
}
