export interface AssignedItem {
  deliveryItemId: string;
  dispatchKey: string | null;
  waveNo: string | null;
  vehicleNo: string | null;
  deliverySeq: number | null;
  address: string | null;
  totalCount: number | null;
  deliveryStatus: string;
  // 現在の割当（未割当は null）
  assignmentId: string | null;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
}

export interface AvailableDriver {
  driverId: string;
  name: string;
  companyName: string | null;
  area: string | null;
  vehicleId: string | null;
  startTime: string | null;
  endTime: string | null;
  shiftStatus: string;
  assignedCount: number;
}

export interface AssignmentPageData {
  items: AssignedItem[];
  drivers: AvailableDriver[];
  summary: AssignmentSummary;
}

export interface AssignmentSummary {
  totalItems: number;
  unassignedCount: number;
  assignedCount: number;
  driverCount: number;
  driverBreakdown: Record<string, number>;   // driverName → count
  waveBreakdown: Record<string, number>;      // waveNo → count
  vehicleBreakdown: Record<string, number>;   // vehicleNo → count
}
