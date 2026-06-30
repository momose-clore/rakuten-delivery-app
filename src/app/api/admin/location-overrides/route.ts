import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/address/address-normalizer";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const search = req.nextUrl.searchParams.get("search") ?? undefined;

  const overrides = await prisma.deliveryLocationOverride.findMany({
    where: {
      ...(status && { status }),
      ...(search && { normalizedAddress: { contains: search } }),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({ overrides });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const body = await req.json();
  const { address, lat, lng, entranceMemo, buildingMemo, nameplateMemo, accessMemo, cautionMemo, parkingMemo } = body;

  if (!address) return NextResponse.json({ error: "address は必須です" }, { status: 400 });

  const parts = normalizeAddress(address);

  const override = await prisma.deliveryLocationOverride.create({
    data: {
      normalizedAddress: parts.lookupKey,
      postalCode: parts.postalCode,
      prefecture: parts.prefecture,
      city: parts.city,
      town: parts.town,
      block: parts.block,
      buildingName: parts.buildingName,
      lat: lat ?? null, lng: lng ?? null,
      entranceMemo: entranceMemo ?? null,
      buildingMemo: buildingMemo ?? null,
      nameplateMemo: nameplateMemo ?? null,
      accessMemo: accessMemo ?? null,
      cautionMemo: cautionMemo ?? null,
      parkingMemo: parkingMemo ?? null,
      source: "ADMIN",
      status: "approved",
      createdBy: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LOCATION_OVERRIDE_CREATED",
      targetType: "delivery_location_overrides",
      targetId: override.id,
      afterData: { status: "approved", source: "ADMIN" },
    },
  });

  return NextResponse.json({ override }, { status: 201 });
}
