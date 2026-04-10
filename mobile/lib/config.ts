// mobile/lib/config.ts
import Constants from "expo-constants";

// Get the IP from environment or use localhost with fallback
const getApiBaseUrl = (): string => {
  // Priority order:
  // 1. Expo config extra
  // 2. Environment variable
  // 3. Localhost (for web/emulator)
  // 4. Fallback IP

  const expoConfig = Constants.expoConfig?.extra?.apiBaseUrl;
  if (expoConfig) return expoConfig;

  const envVar = process.env.API_BASE_URL;
  if (envVar) return envVar;

  // Default to localhost:5000 for development
  return "http://localhost:5000/api/v1";
};

const getSocketUrl = (): string => {
  const expoConfig = Constants.expoConfig?.extra?.socketUrl;
  if (expoConfig) return expoConfig;

  const envVar = process.env.SOCKET_URL;
  if (envVar) return envVar;

  // Default to localhost:5000 for development
  return "http://localhost:5000";
};

export const config = {
  API_BASE_URL: getApiBaseUrl(),
  SOCKET_URL: getSocketUrl(),
};

export default config;
