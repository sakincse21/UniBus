import React, { useState, useRef } from "react";
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
import { authAPI } from "@/lib/api";
import {
  Text,
  VStack,
  Heading,
  FormControl,
  Input,
  Button,
} from "@gluestack-ui/themed";
import type { ViewProps } from "react-native";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const handleRegister = async () => {
    const newErrors: typeof errors = {};

    if (!name?.trim()) {
      newErrors.name = "Name is required";
    }

    if (!email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const response = await authAPI.register(name, email, password);

      if (response.data.success) {
        Alert.alert("Success", "Account created! Please sign in.", [
          {
            text: "OK",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]);
      } else {
        Alert.alert("Error", response.data.message || "Registration failed");
      }
    } catch (error: any) {
      console.error("Register error:", error);
      Alert.alert(
        "Registration Failed",
        error.response?.data?.message || "Please try again",
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
        ref={scrollViewRef}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 20,
            justifyContent: "center",
            gap: 16,
          }}
        >
          {/* Header */}
          <VStack style={{ alignItems: "center", marginBottom: 12, gap: 8 }}>
            <Heading
              style={{
                textAlign: "center",
                fontSize: 32,
                fontWeight: "700",
                color: "#000",
              }}
            >
              Create Account
            </Heading>
            <Text
              style={{ textAlign: "center", fontSize: 14, color: "#4b5563" }}
            >
              Join UniBus Tracking
            </Text>
          </VStack>

          {/* Form Fields */}
          <VStack style={{ gap: 12 }}>
            {/* Name */}
            <FormControl isInvalid={!!errors.name}>
              <FormControl.Label>
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#000" }}
                >
                  Full Name
                </Text>
              </FormControl.Label>
              <Input isDisabled={isLoading}>
                <Input.Input
                  placeholder="Enter your name"
                  value={name}
                  onChangeText={(text: string) => {
                    setName(text);
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  autoCapitalize="words"
                  editable={!isLoading}
                  placeholderTextColor="#9ca3af"
                />
              </Input>
              {errors.name && (
                <FormControl.Error>
                  <Text style={{ fontSize: 12, color: "#dc2626" }}>
                    {errors.name}
                  </Text>
                </FormControl.Error>
              )}
            </FormControl>

            {/* Email */}
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

            {/* Password */}
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
                  placeholder="At least 6 characters"
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

            {/* Confirm Password */}
            <FormControl isInvalid={!!errors.confirmPassword}>
              <FormControl.Label>
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#000" }}
                >
                  Confirm Password
                </Text>
              </FormControl.Label>
              <Input isDisabled={isLoading}>
                <Input.Input
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={(text: string) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword)
                      setErrors({ ...errors, confirmPassword: undefined });
                  }}
                  secureTextEntry
                  editable={!isLoading}
                  placeholderTextColor="#9ca3af"
                />
              </Input>
              {errors.confirmPassword && (
                <FormControl.Error>
                  <Text style={{ fontSize: 12, color: "#dc2626" }}>
                    {errors.confirmPassword}
                  </Text>
                </FormControl.Error>
              )}
            </FormControl>
          </VStack>

          {/* Register Button */}
          <Button
            onPress={handleRegister}
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
                Create Account
              </Button.Text>
            )}
          </Button>

          {/* Sign In Link */}
          <VStack style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 14, color: "#4b5563" }}>
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: "#0ea5e9" }}
              >
                Sign In Here
              </Text>
            </TouchableOpacity>
          </VStack>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
