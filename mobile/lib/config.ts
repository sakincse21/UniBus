// mobile/lib/config.ts
import Constants from "expo-constants";

type AppExtraConfig = {
  apiBaseUrl?: string;
  socketUrl?: string;
};

const getExtraConfig = (): AppExtraConfig => {
  const constantsAny = Constants as any;

  return (
    (Constants.expoConfig?.extra as AppExtraConfig | undefined) ||
    (constantsAny.manifest2?.extra?.expoClient?.extra as
      | AppExtraConfig
      | undefined) ||
    (constantsAny.manifest?.extra as AppExtraConfig | undefined) ||
    {}
  );
};

const extra = getExtraConfig();

// Get the IP from environment or use localhost with fallback
const getApiBaseUrl = (): string => {
  // Priority order:
  // 1. Expo config extra
  // 2. Environment variable
  // 3. Localhost (for web/emulator)
  // 4. Fallback IP

  const expoConfig = extra.apiBaseUrl;
  if (expoConfig) return expoConfig;

  const envVar =
    process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
  if (envVar) return envVar;

  // Default to localhost:5000 for development
  return "http://localhost:5000/api/v1";
};

const getSocketUrl = (): string => {
  const expoConfig = extra.socketUrl;
  if (expoConfig) return expoConfig;

  const envVar = process.env.EXPO_PUBLIC_SOCKET_URL || process.env.SOCKET_URL;
  if (envVar) return envVar;

  // Default to localhost:5000 for development
  return "http://localhost:5000";
};

export const config = {
  API_BASE_URL: getApiBaseUrl(),
  SOCKET_URL: getSocketUrl(),
};

export default config;
