import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OcrReviewClient } from "@/components/ocr/OcrReviewClient";
import type { DispatchImage, DeliveryItem } from "@/types/dispatch";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OcrReviewPage({ params }: Props) {
  const { id } = await params;

  const image = await prisma.dispatchImage.findUnique({ where: { id } });
  if (!image) notFound();

  const items = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: id },
    orderBy: [{ waveNo: "asc" }, { vehicleNo: "asc" }, { deliverySeq: "asc" }],
  });

  const dispatchImage: DispatchImage = {
    id: image.id,
    deliveryDate: image.deliveryDate.toISOString(),
    area: image.area,
    waveNo: image.waveNo,
    imageUrl: image.imageUrl,
    ocrStatus: image.ocrStatus,
    importedAt: image.importedAt.toISOString(),
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };

  const deliveryItems: DeliveryItem[] = items.map((i) => ({
    id: i.id,
    dispatchImageId: i.dispatchImageId,
    dispatchKey: i.dispatchKey,
    waveNo: i.waveNo,
    vehicleNo: i.vehicleNo,
    deliverySeq: i.deliverySeq,
    invoiceNo: i.invoiceNo,
    customerName: i.customerName,
    customerPhone: i.customerPhone,
    address: i.address,
    specialFlag: i.specialFlag,
    normalOriconCount: i.normalOriconCount,
    coolerBoxCount: i.coolerBoxCount,
    caseCount: i.caseCount,
    totalCount: i.totalCount,
    memo: i.memo,
    ocrNotes: i.ocrNotes,
    ocrStatus: i.ocrStatus,
    fieldStatusJson: i.fieldStatusJson,
    fieldSourceJson: i.fieldSourceJson,
    predictionWarningsJson: i.predictionWarningsJson,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));

  return (
    <OcrReviewClient
      dispatchImage={dispatchImage}
      initialItems={deliveryItems}
    />
  );
}
