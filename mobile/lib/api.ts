import axios from "axios";
import config from "./config";
import storage from "./storage";

console.log("API Base URL:", config.API_BASE_URL);

const api = axios.create({
  baseURL: config.API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.clear();
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post("/auth/register", { name, email, password }),
};

export const noticeAPI = {
  getNotices: () => api.get("/notice"),
  getPendingNotices: () => api.get("/notice/pending"),
  getNoticeById: (id: number) => api.get(`/notice/${id}`),
  createNotice: (data: any) => api.post("/notice", data),
  approveNotice: (id: number) => api.put(`/notice/${id}/approve`),
  rejectNotice: (id: number) => api.put(`/notice/${id}/reject`),
  deleteNotice: (id: number) => api.delete(`/notice/${id}`),
  getAttachments: (noticeId: number) =>
    api.get(`/attachment/notice/${noticeId}`),
  downloadAttachment: (attachmentId: number) =>
    api.get(`/attachment/download/${attachmentId}`, {
      responseType: "blob",
    }),
  uploadAttachments: (noticeId: number, files: any[]) => {
    const formData = new FormData();
    formData.append("noticeId", noticeId.toString());

    files.forEach((file, index) => {
      formData.append("attachments", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    });

    return api.post("/attachment/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 120000,
    });
  },
};

export const busAPI = {
  getBuses: () => api.get("/bus"),
  requestTracking: (busId: number) => api.post(`/tracking/request/${busId}`),
};

export const batchAPI = {
  getAllBatches: () => api.get("/batch"),
  getBatchById: (id: number) => api.get(`/batch/${id}`),
};

export const locationAPI = {
  updateLocation: (lat: number, lng: number) =>
    api.post("/location/update", { lat, lng }),
};

export const userAPI = {
  getProfile: () => api.get("/user/me"),
  updateProfile: (data: any) => api.patch("/user/me", data),
};

export const routineAPI = {
  uploadImage: (formData: FormData) =>
    api.post("/routine/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    }),
  confirmRoutine: (slots: any[]) => api.post("/routine/confirm", { slots }),
  getMyRoutine: () => api.get("/routine"),
  updateSlot: (id: number, data: any) => api.patch(`/routine/${id}`, data),
  deleteRoutine: () => api.delete("/routine"),
};

export const calendarAPI = {
  getCalendarEvents: (days: number = 30) =>
    api.get(`/calendar/events?days=${days}`),
  createFixture: (data: any) => api.post("/calendar/fixtures", data),
  getFixtures: () => api.get("/calendar/fixtures"),
  updateFixture: (id: number, data: any) =>
    api.put(`/calendar/fixtures/${id}`, data),
  deleteFixture: (id: number) => api.delete(`/calendar/fixtures/${id}`),
  deleteNotice: (id: number) => api.delete(`/calendar/notice/${id}`),
};

export default api;
