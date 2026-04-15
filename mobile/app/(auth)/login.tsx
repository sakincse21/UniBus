import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authAPI, userAPI } from "@/lib/api";
import { initializePushNotifications } from "@/lib/notifications";
import { startBackgroundLocationTracking } from "@/lib/backgroundLocation";
import { useAuthStore } from "@/store/authStore";
import { IUser } from "@/interfaces";
import {
  Text,
  VStack,
  Heading,
  FormControl,
  Input,
  Button,
} from "@gluestack-ui/themed";

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const handleLogin = async () => {
    const newErrors: typeof errors = {};

    if (!email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const response = await authAPI.login(email, password);

      if (response.data.success) {
        const { id, email: userEmail, role, token } = response.data.data;

        // Initial user without batch
        const initialUser: IUser = {
          user_id: id,
          name: email,
          email: userEmail,
          role: role as IUser["role"],
        };

        await login(initialUser, token);

        // Fetch full profile to get batch
        try {
          const profileResponse = await userAPI.getProfile();
          if (profileResponse.data.success && profileResponse.data.data) {
            const fullProfile = profileResponse.data.data;
            const updatedUser = {
              ...initialUser,
              name: fullProfile.name || initialUser.name,
              batch: fullProfile.batch,
            };
            await login(updatedUser, token);
          }
        } catch (profileError) {
          console.warn("Failed to fetch full profile:", profileError);
        }

        try {
          const pushToken = await initializePushNotifications();
          if (pushToken) {
            await userAPI.updatePushToken(pushToken);
          }
        } catch (pushError) {
          console.warn("Push token registration failed at login:", pushError);
        }

        startBackgroundLocationTracking().catch((trackingError) => {
          console.warn("Background location tracking start failed:", trackingError);
        });

        await refreshProfile();
        router.replace("/(tabs)");
      } else {
        Alert.alert("Error", response.data.message || "Login failed");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      Alert.alert(
        "Login Failed",
        error.response?.data?.message ||
          "Please check your credentials and try again",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={false}
      >
        <VStack
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
            justifyContent: "center",
            gap: 16,
          }}
        >
          <VStack style={{ alignItems: "center", marginBottom: 16, gap: 12 }}>
            <Heading
              style={{
                textAlign: "center",
                fontSize: 32,
                fontWeight: "700",
                color: "#000",
              }}
            >
              UniBus
            </Heading>
            <Text
              style={{ textAlign: "center", fontSize: 14, color: "#4b5563" }}
            >
              University Bus Tracking System
            </Text>
          </VStack>

          <VStack style={{ gap: 12 }}>
            <FormControl isInvalid={!!errors.email}>
              <FormControl.Label>
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#000" }}
                >
                  Email
                </Text>
              </FormControl.Label>
              <Input isDisabled={isLoading}>
                <Input.Input
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={(text: string) => {
                    setEmail(text);
                    if (errors.email)
                      setErrors({ ...errors, email: undefined });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                  placeholderTextColor="#9ca3af"
                />
              </Input>
              {errors.email && (
                <FormControl.Error>
                  <Text style={{ fontSize: 12, color: "#dc2626" }}>
                    {errors.email}
                  </Text>
                </FormControl.Error>
              )}
            </FormControl>

            <FormControl isInvalid={!!errors.password}>
              <FormControl.Label>
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#000" }}
                >
                  Password
                </Text>
              </FormControl.Label>
              <Input isDisabled={isLoading}>
                <Input.Input
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={(text: string) => {
                    setPassword(text);
                    if (errors.password)
                      setErrors({ ...errors, password: undefined });
                  }}
                  secureTextEntry
                  editable={!isLoading}
                  placeholderTextColor="#9ca3af"
                />
              </Input>
              {errors.password && (
                <FormControl.Error>
                  <Text style={{ fontSize: 12, color: "#dc2626" }}>
                    {errors.password}
                  </Text>
                </FormControl.Error>
              )}
            </FormControl>
          </VStack>

          <Button
            onPress={handleLogin}
            isDisabled={isLoading}
            style={{
              marginTop: 8,
              width: "100%",
              backgroundColor: isLoading ? "#d1d5db" : "#0ea5e9",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 6,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Button.Text style={{ color: "white", fontWeight: "600" }}>
                Sign In
              </Button.Text>
            )}
          </Button>

          <VStack style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 14, color: "#4b5563" }}>
              Don't have an account?
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: "#0ea5e9" }}
              >
                Sign Up Here
              </Text>
            </TouchableOpacity>
          </VStack>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
