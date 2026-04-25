import { create } from "zustand";
import { ITrackingRequestItem } from "@/interfaces";

interface BusTrackingStoreState {
  requestToStartSharing: ITrackingRequestItem | null;
  isSharingGps: boolean;
  sharingForBusId: number | null;
  setRequestToStartSharing: (request: ITrackingRequestItem | null) => void;
  setSharingState: (isSharingGps: boolean, sharingForBusId: number | null) => void;
}

export const useBusTrackingStore = create<BusTrackingStoreState>((set) => ({
  requestToStartSharing: null,
  isSharingGps: false,
  sharingForBusId: null,
  setRequestToStartSharing: (requestToStartSharing) => set({ requestToStartSharing }),
  setSharingState: (isSharingGps, sharingForBusId) =>
    set({ isSharingGps, sharingForBusId }),
}));
