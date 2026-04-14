import Constants from "expo-constants";

const getApiBaseUrl = (): string => {
  // Priority 1: Environment variable (set in .env or eas.json)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    console.log(
      "📡 Using API URL from env:",
      process.env.EXPO_PUBLIC_API_BASE_URL,
    );
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // Priority 2: Expo constants extra (from app.json)
  const expoConfig = Constants.expoConfig?.extra?.apiBaseUrl;
  if (expoConfig && typeof expoConfig === "string") {
    console.log("📡 Using API URL from expoConfig:", expoConfig);
    return expoConfig;
  }

  // Priority 3: Default for development
  // In production builds, ensure EXPO_PUBLIC_API_BASE_URL is set in eas.json
  const fallbackUrl = "http://localhost:5000/api/v1";
  console.warn("⚠️ No API URL configured, using fallback:", fallbackUrl);
  return fallbackUrl;
};

const getSocketUrl = (): string => {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    console.log(
      "📡 Using Socket URL from env:",
      process.env.EXPO_PUBLIC_SOCKET_URL,
    );
    return process.env.EXPO_PUBLIC_SOCKET_URL;
  }

  const expoConfig = Constants.expoConfig?.extra?.socketUrl;
  if (expoConfig && typeof expoConfig === "string") {
    return expoConfig;
  }

  return "http://192.168.10.191:5000";
};

export const config = {
  API_BASE_URL: getApiBaseUrl(),
  SOCKET_URL: getSocketUrl(),
};

console.log("🔧 Final config:", {
  API_BASE_URL: config.API_BASE_URL,
  SOCKET_URL: config.SOCKET_URL,
});

export default config;
