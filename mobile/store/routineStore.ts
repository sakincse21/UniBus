import { create } from "zustand";
import { IRoutineSlot } from "@/interfaces";
import { routineAPI } from "@/lib/api";

interface RoutineState {
  /** Draft from AI analysis (before confirm) */
  draft: IRoutineSlot[];
  /** Confirmed routine saved on server */
  routine: IRoutineSlot[];
  isAnalyzing: boolean;
  isLoading: boolean;
  error: string | null;

  /** Upload image → get AI draft */
  analyzeImage: (imageUri: string) => Promise<void>;

  /** Update a draft slot locally (user edits) */
  updateDraftSlot: (index: number, patch: Partial<IRoutineSlot>) => void;

  /** Remove a draft slot */
  removeDraftSlot: (index: number) => void;

  /** Confirm draft → save to server */
  confirmDraft: () => Promise<void>;

  /** Load saved routine from server */
  fetchRoutine: () => Promise<void>;

  /** Update a single saved slot */
  updateSavedSlot: (id: number, patch: Partial<IRoutineSlot>) => Promise<void>;

  /** Delete all routine data */
  deleteRoutine: () => Promise<void>;

  clearDraft: () => void;
  clearError: () => void;
}

export const useRoutineStore = create<RoutineState>((set, get) => ({
  draft: [],
  routine: [],
  isAnalyzing: false,
  isLoading: false,
  error: null,

  analyzeImage: async (imageUri: string) => {
    set({ isAnalyzing: true, error: null });
    try {
      const formData = new FormData();
      const filename = imageUri.split("/").pop() || "routine.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      formData.append("routineImage", {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      const res = await routineAPI.uploadImage(formData);
      set({ draft: res.data.data, isAnalyzing: false });
    } catch (err: any) {
      set({
        isAnalyzing: false,
        error:
          err.response?.data?.message ||
          err.message ||
          "Failed to analyze image",
      });
    }
  },

  updateDraftSlot: (index, patch) => {
    const draft = [...get().draft];
    draft[index] = { ...draft[index], ...patch };
    set({ draft });
  },

  removeDraftSlot: (index) => {
    const draft = get().draft.filter((_, i) => i !== index);
    set({ draft });
  },

  confirmDraft: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await routineAPI.confirmRoutine(get().draft);
      set({ routine: res.data.data, draft: [], isLoading: false });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.message || "Failed to save routine",
      });
    }
  },

  fetchRoutine: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await routineAPI.getMyRoutine();
      set({ routine: res.data.data, isLoading: false });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.message || "Failed to fetch routine",
      });
    }
  },

  updateSavedSlot: async (id, patch) => {
    try {
      const res = await routineAPI.updateSlot(id, patch);
      const routine = get().routine.map((r) =>
        r.id === id ? res.data.data : r,
      );
      set({ routine });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || "Failed to update slot",
      });
    }
  },

  deleteRoutine: async () => {
    set({ isLoading: true });
    try {
      await routineAPI.deleteRoutine();
      set({ routine: [], draft: [], isLoading: false });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.message || "Failed to delete routine",
      });
    }
  },

  clearDraft: () => set({ draft: [] }),
  clearError: () => set({ error: null }),
}));

export default useRoutineStore;
