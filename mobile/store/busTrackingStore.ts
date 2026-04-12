import { create } from "zustand";

export interface PendingBusTrackingRequest {
  busId: number;
  routeId?: number | null;
  estimate?: {
    lat?: number;
    lng?: number;
    confidence?: number;
  };
}

interface BusTrackingStoreState {
  pendingRequest: PendingBusTrackingRequest | null;
  isSharingGps: boolean;
  sharingForBusId: number | null;
  setPendingRequest: (request: PendingBusTrackingRequest | null) => void;
  clearPendingRequest: () => void;
  setSharingState: (isSharingGps: boolean, sharingForBusId: number | null) => void;
}

export const useBusTrackingStore = create<BusTrackingStoreState>((set) => ({
  pendingRequest: null,
  isSharingGps: false,
  sharingForBusId: null,
  setPendingRequest: (pendingRequest) => set({ pendingRequest }),
  clearPendingRequest: () => set({ pendingRequest: null }),
  setSharingState: (isSharingGps, sharingForBusId) =>
    set({ isSharingGps, sharingForBusId }),
}));
