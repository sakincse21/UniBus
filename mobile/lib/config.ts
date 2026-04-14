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

  // Priority 3: Production fallback
  return "https://tracku-backend.onrender.com/api/v1";
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

  return "https://tracku-backend.onrender.com";
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
