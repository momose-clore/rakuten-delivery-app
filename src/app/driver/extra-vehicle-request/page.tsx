import { requireDriver } from "@/lib/auth/permissions";
import { ExtraVehicleDriverClient } from "@/components/extra-vehicle/ExtraVehicleDriverClient";

export default async function DriverExtraVehicleRequestPage() {
  await requireDriver();
  return <ExtraVehicleDriverClient />;
}
