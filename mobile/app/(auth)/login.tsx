import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  View,
  Image,
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
import { APP_THEME_COLORS } from "@/lib/theme";

const COLORS = APP_THEME_COLORS;

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const openForgotPasswordModal = () => {
    setForgotEmail(email.trim());
    setForgotEmailError(null);
    setForgotPasswordVisible(true);
  };

  const closeForgotPasswordModal = () => {
    if (isForgotPasswordLoading) return;
    setForgotPasswordVisible(false);
    setForgotEmailError(null);
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = forgotEmail.trim();

    if (!normalizedEmail) {
      setForgotEmailError("Email is required");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setForgotEmailError("Please enter a valid email");
      return;
    }

    setForgotEmailError(null);
    setIsForgotPasswordLoading(true);

    try {
      const response = await authAPI.forgotPassword(normalizedEmail);

      if (response.data.success) {
        Alert.alert(
          "Password Reset",
          response.data.message ||
            "A temporary password has been sent to your email.",
        );
        setForgotPasswordVisible(false);
      } else {
        Alert.alert(
          "Reset Failed",
          response.data.message || "Failed to send reset password email.",
        );
      }
    } catch (error: any) {
      console.error("Forgot password error:", error);
      Alert.alert(
        "Reset Failed",
        error.response?.data?.message || "Failed to send reset password email.",
      );
    } finally {
      setIsForgotPasswordLoading(false);
    }
  };

  const handleLogin = async () => {
    const newErrors: typeof errors = {};

    if (!email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(email.trim())) {
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
          console.warn(
            "Background location tracking start failed:",
            trackingError,
          );
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
      style={{ flex: 1, backgroundColor: COLORS.background }}
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
          <Image
            source={require("../../assets/icon.png")}
            style={{
              width: 160,
              height: 160,
              alignSelf: "center",
              marginBottom: 6,
            }}
            resizeMode="contain"
            accessibilityLabel="TrackU logo"
          />


          <VStack style={{ gap: 12 }}>
            <FormControl isInvalid={!!errors.email}>
              <FormControl.Label>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: COLORS.onSurface,
                  }}
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
                  placeholderTextColor={COLORS.onSurfaceMuted}
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
                <View
                  style={{
                    width: "100%",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: COLORS.onSurface,
                    }}
                  >
                    Password
                  </Text>
                  <TouchableOpacity
                    onPress={openForgotPasswordModal}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: isLoading
                          ? COLORS.onSurfaceMuted
                          : COLORS.primary,
                      }}
                    >
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                </View>
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
                  placeholderTextColor={COLORS.onSurfaceMuted}
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
              backgroundColor: isLoading ? COLORS.surfaceHigh : COLORS.primary,
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

        </VStack>
      </ScrollView>

      <Modal
        visible={forgotPasswordVisible}
        transparent
        animationType="fade"
        onRequestClose={closeForgotPasswordModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(17, 24, 39, 0.45)",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <VStack
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
              borderRadius: 12,
              padding: 20,
              gap: 12,
            }}
          >
            <VStack style={{ gap: 4 }}>
              <Heading
                style={{
                  fontSize: 22,
                  fontWeight: "700",
                  color: COLORS.onSurface,
                }}
              >
                Forgot Password?
              </Heading>
              <Text
                style={{
                  fontSize: 13,
                  color: COLORS.onSurfaceMuted,
                  lineHeight: 20,
                }}
              >
                Enter your email address. We will send you a temporary password.
              </Text>
            </VStack>

            <FormControl isInvalid={!!forgotEmailError}>
              <FormControl.Label>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: COLORS.onSurface,
                  }}
                >
                  Email
                </Text>
              </FormControl.Label>
              <Input isDisabled={isForgotPasswordLoading}>
                <Input.Input
                  placeholder="Enter your email"
                  value={forgotEmail}
                  onChangeText={(text: string) => {
                    setForgotEmail(text);
                    if (forgotEmailError) {
                      setForgotEmailError(null);
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isForgotPasswordLoading}
                  placeholderTextColor={COLORS.onSurfaceMuted}
                />
              </Input>
              {forgotEmailError ? (
                <FormControl.Error>
                  <Text style={{ fontSize: 12, color: "#dc2626" }}>
                    {forgotEmailError}
                  </Text>
                </FormControl.Error>
              ) : null}
            </FormControl>

            <View
              style={{
                marginTop: 4,
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <Button
                onPress={closeForgotPasswordModal}
                isDisabled={isForgotPasswordLoading}
                style={{
                  backgroundColor: COLORS.surfaceLow,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 6,
                }}
              >
                <Button.Text
                  style={{ color: COLORS.onSurface, fontWeight: "600" }}
                >
                  Cancel
                </Button.Text>
              </Button>

              <Button
                onPress={handleForgotPassword}
                isDisabled={isForgotPasswordLoading}
                style={{
                  backgroundColor: isForgotPasswordLoading
                    ? COLORS.surfaceHigh
                    : COLORS.primary,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 6,
                }}
              >
                {isForgotPasswordLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Button.Text style={{ color: "white", fontWeight: "600" }}>
                    Send Reset Password
                  </Button.Text>
                )}
              </Button>
            </View>
          </VStack>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
