import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useAuthStore } from "@/store/authStore";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { syncBackgroundLocationTracking } from "@/lib/backgroundLocation";
import "@/global.css";

export default function RootLayout() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    syncBackgroundLocationTracking(isAuthenticated).catch((error) => {
      console.error("Failed to sync background location tracking:", error);
    });
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView>
          <View style={{ flex: 1 }}>
            <GluestackUIProvider mode="light">
              <StatusBar hidden={false} />
            </GluestackUIProvider>
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView>
        <View style={{ flex: 1 }}>
          <GluestackUIProvider mode="light">
            <StatusBar hidden={false} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="+not-found" />
            </Stack>
          </GluestackUIProvider>
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
