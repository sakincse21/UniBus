import axios from "axios";
import config from "./config";
import storage from "./storage";

const api = axios.create({
  baseURL: config.API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
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

export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post("/auth/register", { name, email, password }),
};

export const noticeAPI = {
  getNotices: () => api.get("/notice"),
  getPendingNotices: () => api.get("/notice/pending"),
  createNotice: (data: any) => api.post("/notice", data),
  approveNotice: (id: number) => api.put(`/notice/${id}/approve`),
  rejectNotice: (id: number) => api.put(`/notice/${id}/reject`),
  deleteNotice: (id: number) => api.delete(`/notice/${id}`),
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
  getProfile: () => api.get("/user/profile"),
  updateProfile: (data: any) => api.patch("/user/profile", data),
};

export const routineAPI = {
  /** Upload routine image for AI analysis. Returns editable draft slots. */
  uploadImage: (formData: FormData) =>
    api.post("/routine/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  /** Save confirmed routine slots (replaces all existing) */
  confirmRoutine: (slots: any[]) => api.post("/routine/confirm", { slots }),

  /** Get current user's saved routine */
  getMyRoutine: () => api.get("/routine"),

  /** Update a single routine slot */
  updateSlot: (id: number, data: any) => api.patch(`/routine/${id}`, data),

  /** Delete all routine entries */
  deleteRoutine: () => api.delete("/routine"),
};

export default api;
