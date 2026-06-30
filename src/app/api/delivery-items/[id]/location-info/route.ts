import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { assessAddressConfidence } from "@/lib/address/address-confidence";
import { findApprovedOverride } from "@/lib/address/location-override-matcher";
import { buildBestNavigationUrl, buildCopyableAddress } from "@/lib/maps/navigation";
import type { LocationInfo } from "@/types/location";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;

  const item = await prisma.deliveryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ドライバーは自分の担当のみ
  if (session.user.role === "DRIVER") {
    const assignment = await prisma.assignment.findFirst({
      where: { deliveryItemId: id, driverId: session.user.driverId ?? "" },
    });
    if (!assignment) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const override = item.address ? await findApprovedOverride(item.address) : null;
  const { confidence, warnings } = assessAddressConfidence({
    address: item.address,
    lat: item.lat,
    lng: item.lng,
    hasApprovedOverride: !!override,
  });

  const navigationUrl = buildBestNavigationUrl({
    address: item.address,
    lat: item.lat,
    lng: item.lng,
    override,
  });

  const copyableAddress = buildCopyableAddress({ address: item.address, override });

  const locationInfo: LocationInfo = {
    deliveryItemId: id,
    address: item.address,
    normalizedAddress: null,
    lat: override?.lat ?? item.lat,
    lng: override?.lng ?? item.lng,
    confidence,
    warnings,
    override,
    navigationUrl,
    copyableAddress,
  };

  return NextResponse.json({ locationInfo });
}
