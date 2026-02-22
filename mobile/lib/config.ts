// mobile/lib/config.ts
import Constants from "expo-constants";

export const config = {
  API_BASE_URL:
    Constants.expoConfig?.extra?.apiBaseUrl ||
    process.env.API_BASE_URL ||
    "http://localhost:5000/api/v1", // ← Your IP here

  SOCKET_URL:
    Constants.expoConfig?.extra?.socketUrl ||
    process.env.SOCKET_URL ||
    "http://localhost:5000", // ← Your IP here
};

export default config;
