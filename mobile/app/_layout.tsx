import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useAuthStore } from "@/store/authStore";
import "@/global.css";

export default function RootLayout() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <GluestackUIProvider mode="light">
        <StatusBar style="auto" />
      </GluestackUIProvider>
    );
  }

  return (
    <GluestackUIProvider mode="light">
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </GluestackUIProvider>
  );
}
