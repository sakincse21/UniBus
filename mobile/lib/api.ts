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
  // Fetch all visible notices for the user
  getNotices: () => api.get("/notice"),

  // Fetch pending notices (Admin only)
  getPendingNotices: () => api.get("/notice/pending"),

  // Create a new notice
  createNotice: (data: any) => api.post("/notice", data),

  // Approve a pending notice (Admin only)
  approveNotice: (id: number) => api.patch(`/notice/${id}/approve`),

  // Reject a pending notice (Admin only)
  rejectNotice: (id: number) => api.patch(`/notice/${id}/reject`),

  // Delete a notice (Admin only)
  deleteNotice: (id: number) => api.delete(`/notice/${id}`),
};

export const busAPI = {
  getBuses: () => api.get("/bus"),
  requestTracking: (busId: number) => api.post(`/tracking/request/${busId}`),
};

export const userAPI = {
  getProfile: () => api.get("/user/profile"),
  updateProfile: (data: any) => api.patch("/user/profile", data),
};

export default api;
