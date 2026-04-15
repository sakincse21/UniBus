import { create } from "zustand";
import { calendarAPI } from "@/lib/api";
import { ICalendarEvent } from "@/interfaces";

interface CalendarState {
  events: ICalendarEvent[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchCalendarEvents: (days?: number) => Promise<void>;
  createFixture: (data: any) => Promise<void>;
  updateFixture: (id: number, data: any) => Promise<void>;
  deleteFixture: (id: number) => Promise<void>;
  deleteNotice: (id: number) => Promise<void>;
  setEvents: (events: ICalendarEvent[]) => void;
  clearError: () => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  isLoading: false,
  error: null,

  fetchCalendarEvents: async (days = 30) => {
    set({ isLoading: true, error: null });
    try {
      const response = await calendarAPI.getCalendarEvents(days);
      if (response.data.success) {
        const fetchedEvents = response.data.data || [];
        set({ events: fetchedEvents, error: null });
      } else {
        set({ error: response.data.message || "Failed to fetch events" });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to fetch calendar events";
      set({ error: errorMsg });
      console.error("Calendar fetch error:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createFixture: async (data) => {
    set({ error: null });
    try {
      const response = await calendarAPI.createFixture(data);
      if (response.data.success) {
        // Refetch all events to get the new fixture
        await get().fetchCalendarEvents();
      } else {
        set({ error: response.data.message || "Failed to create fixture" });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to create fixture";
      set({ error: errorMsg });
      console.error("Create fixture error:", error);
      throw error;
    }
  },

  updateFixture: async (id, data) => {
    set({ error: null });
    try {
      const response = await calendarAPI.updateFixture(id, data);
      if (response.data.success) {
        // Refetch all events
        await get().fetchCalendarEvents();
      } else {
        set({ error: response.data.message || "Failed to update fixture" });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to update fixture";
      set({ error: errorMsg });
      console.error("Update fixture error:", error);
      throw error;
    }
  },

  deleteFixture: async (id) => {
    set({ error: null });
    try {
      const response = await calendarAPI.deleteFixture(id);
      if (response.data.success) {
        // Remove from local state
        const currentEvents = get().events;
        set({ events: currentEvents.filter(e => !(e.type === "personal" && e.source.fixtureId === id)) });
      } else {
        set({ error: response.data.message || "Failed to delete fixture" });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to delete fixture";
      set({ error: errorMsg });
      console.error("Delete fixture error:", error);
      throw error;
    }
  },

  deleteNotice: async (id) => {
    set({ error: null });
    try {
      const response = await calendarAPI.deleteNotice(id);
      if (response.data.success) {
        // Remove from local state
        const currentEvents = get().events;
        set({ events: currentEvents.filter(e => !(e.type === "notice" && e.source.noticeId === id)) });
      } else {
        set({ error: response.data.message || "Failed to delete notice" });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to delete notice";
      set({ error: errorMsg });
      console.error("Delete notice error:", error);
      throw error;
    }
  },

  setEvents: (events) => set({ events }),

  clearError: () => set({ error: null }),
}));
