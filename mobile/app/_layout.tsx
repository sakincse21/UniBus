import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useAuthStore } from "@/store/authStore";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "@/global.css";

export default function RootLayout() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GluestackUIProvider mode="light">
          <StatusBar style="auto" />
        </GluestackUIProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GluestackUIProvider mode="light">
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  );
}
