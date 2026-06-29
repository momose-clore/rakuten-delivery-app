export type LoadingMode = "SIMULTANEOUS" | "SPLIT";

export interface RouteItem {
  assignmentId: string;
  routeOrder: number | null;
  deliveryItemId: string;
  dispatchKey: string | null;
  waveNo: string | null;
  vehicleNo: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  totalCount: number | null;
  memo: string | null;
  deliveryStatus: string;
}

export interface RouteGroupInfo {
  routeGroupId: string | null;
  waveGroup: string;
  loadingMode: LoadingMode;
  returnToWarehouse: boolean;
}

export interface DriverRoute {
  driverId: string;
  driverName: string;
  companyName: string | null;
  area: string | null;
  vehicleId: string | null;
  items: RouteItem[];
  routeGroups: RouteGroupInfo[];
  mapsUrls: string[];
}

export interface RoutePageData {
  drivers: DriverRoute[];
  geocodedCount: number;
  ungeocodedCount: number;
}
