import { Redirect, useRootNavigationState } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const rootNavigationState = useRootNavigationState();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading || !rootNavigationState?.key) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return isAuthenticated ? (
    <Redirect href="/(tabs)" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}
