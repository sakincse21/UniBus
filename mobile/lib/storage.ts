import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  TOKEN: "@unibus_token",
  USER: "@unibus_user",
  AUTH_STATE: "auth-storage",
};

export const storage = {
  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
  },

  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
  },

  async setUser(user: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, user);
  },

  async getUser(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.USER);
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  },

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.AUTH_STATE,
    ]);
  },
};

export default storage;
