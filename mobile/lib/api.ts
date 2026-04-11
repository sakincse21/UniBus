import axios from "axios";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import storage from "./storage";

// Get config from app.json extra
const getApiBaseUrl = (): string => {
  const expoConfig = Constants.expoConfig?.extra?.apiBaseUrl;
  if (expoConfig) return expoConfig;
  return process.env.API_BASE_URL || "http://localhost:5000/api/v1";
};

const getSocketUrl = (): string => {
  const expoConfig = Constants.expoConfig?.extra?.socketUrl;
  if (expoConfig) return expoConfig;
  return process.env.SOCKET_URL || "http://localhost:5000";
};

export const config = {
  API_BASE_URL: getApiBaseUrl(),
  SOCKET_URL: getSocketUrl(),
};

const api = axios.create({
  baseURL: config.API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000,
});

// Request interceptor - add token
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

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.clear();
    }
    return Promise.reject(error);
  },
);

// Helper to convert file URI to blob for upload
export const fileUriToBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  return await response.blob();
};

export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post("/auth/register", { name, email, password }),
  getSocketToken: () => api.get("/auth/socket-token"),
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
  uploadAttachments: (
    noticeId: number,
    files: { uri: string; name: string; type: string }[],
  ) => {
    const formData = new FormData();
    formData.append("noticeId", noticeId.toString());

    files.forEach((file) => {
      formData.append("attachments", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    });

    return api.post("/attachment/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Accept: "application/json",
      },
    });
  },
};

export const busAPI = {
  getBuses: () => api.get("/bus"),
  requestTracking: (busId: number) => api.post(`/tracking/request/${busId}`),
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
