import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  updateUser: (user: Partial<IUser>) => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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

      updateUser: (updatedData) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...updatedData };
          set({ user: updatedUser });
          storage.setUser(JSON.stringify(updatedUser));
        }
      },

      refreshProfile: async () => {
        try {
          const { userAPI } = await import("@/lib/api");
          const response = await userAPI.getProfile();
          if (response.data.success && response.data.data) {
            const profile = response.data.data;
            const currentUser = get().user;
            const updatedUser = {
              ...currentUser,
              ...profile,
              batch: profile.batch || currentUser?.batch,
            } as IUser;
            set({ user: updatedUser });
            await storage.setUser(JSON.stringify(updatedUser));
          }
        } catch (error) {
          console.error("Failed to refresh profile:", error);
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export default useAuthStore;
