import { create } from "zustand";
import { IUser } from "@/interfaces";
import storage from "@/lib/storage";

interface AuthState {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (user: IUser, token: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (user, token) => {
    await storage.setToken(token);
    await storage.setUser(JSON.stringify(user));
    set({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    await storage.clear();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  checkAuth: async () => {
    try {
      const [token, userStr] = await Promise.all([
        storage.getToken(),
        storage.getUser(),
      ]);

      if (token && userStr) {
        const user = JSON.parse(userStr) as IUser;
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    }

    set({ isLoading: false });
    return false;
  },
}));

export default useAuthStore;
