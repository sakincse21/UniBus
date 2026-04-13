import axios from "axios";
import config from "./config";
import storage from "./storage";

console.log("API Base URL:", config.API_BASE_URL);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

const resolveUploadFileName = (file: any): string => {
  const uriName = (file?.uri || "").split("/").pop()?.split("?")[0];
  return (file?.name || uriName || `upload-${Date.now()}.jpg`).replace(/\s+/g, "_");
};

const resolveUploadMimeType = (file: any, fileName: string): string => {
  const rawType = (file?.type || file?.mimeType || "").toLowerCase().trim();

  if (rawType.includes("/")) {
    if (rawType === "image/jpg" || rawType === "image/pjpeg") {
      return "image/jpeg";
    }
    return rawType;
  }

  const ext = fileName.toLowerCase().split(".").pop();
  if (ext && EXT_TO_MIME[ext]) {
    return EXT_TO_MIME[ext];
  }

  return "application/octet-stream";
};

const api = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: 60000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await storage.getToken();
    if (token) {
      config.headers = config.headers || {};
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

    // Append files directly - axios will handle multipart encoding
    files.forEach((file) => {
      const name = resolveUploadFileName(file);
      const type = resolveUploadMimeType(file, name);
      formData.append("attachments", {
        uri: file.uri,
        name,
        type,
      } as any);
    });

    return api.post("/attachment/upload", formData, {
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
      timeout: 180000,
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
