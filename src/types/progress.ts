export interface DashboardStats {
  date: string;
  dispatchImageCount: number;
  ocrPendingCount: number;
  addressErrorCount: number;
  countMismatchCount: number;
  unassignedCount: number;
  activeDriverCount: number;
  assignedCount: number;
  completedCount: number;
  absentCount: number;
  returnedCount: number;
  skippedCount: number;
  inProgressCount: number;
}

export interface DriverProgress {
  driverId: string;
  driverName: string;
  companyName: string | null;
  area: string | null;
  vehicleId: string | null;
  totalCount: number;
  completedCount: number;
  absentCount: number;
  returnedCount: number;
  skippedCount: number;
  inProgressCount: number;
  lastUpdatedAt: string | null;
}

export interface DeliveryProgress {
  deliveryItemId: string;
  assignmentId: string;
  routeOrder: number | null;
  waveNo: string | null;
  dispatchKey: string | null;
  address: string | null;
  totalCount: number | null;
  memo: string | null;
  deliveryStatus: string;
  updatedAt: string;
}
