import { create } from "zustand";
import { ITrackingRequestItem } from "@/interfaces";

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
  pendingRequests: ITrackingRequestItem[];
  shownRequestId: number | null;
  requestToStartSharing: ITrackingRequestItem | null;
  isSharingGps: boolean;
  sharingForBusId: number | null;
  setPendingRequests: (requests: ITrackingRequestItem[]) => void;
  upsertPendingRequest: (request: ITrackingRequestItem) => void;
  removePendingRequest: (requestId: number) => void;
  setShownRequestId: (requestId: number | null) => void;
  setRequestToStartSharing: (request: ITrackingRequestItem | null) => void;
  setSharingState: (isSharingGps: boolean, sharingForBusId: number | null) => void;
}

export const useBusTrackingStore = create<BusTrackingStoreState>((set) => ({
  pendingRequests: [],
  shownRequestId: null,
  requestToStartSharing: null,
  isSharingGps: false,
  sharingForBusId: null,
  setPendingRequests: (requests) =>
    set({
      pendingRequests: [...requests].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    }),
  upsertPendingRequest: (request) =>
    set((state) => {
      const filtered = state.pendingRequests.filter((item) => item.id !== request.id);
      const pendingRequests = [...filtered, request].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return { pendingRequests };
    }),
  removePendingRequest: (requestId) =>
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((request) => request.id !== requestId),
      shownRequestId: state.shownRequestId === requestId ? null : state.shownRequestId,
      requestToStartSharing:
        state.requestToStartSharing?.id === requestId
          ? null
          : state.requestToStartSharing,
    })),
  setShownRequestId: (shownRequestId) => set({ shownRequestId }),
  setRequestToStartSharing: (requestToStartSharing) => set({ requestToStartSharing }),
  setSharingState: (isSharingGps, sharingForBusId) =>
    set({ isSharingGps, sharingForBusId }),
}));
