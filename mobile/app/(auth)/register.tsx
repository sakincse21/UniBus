import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { authAPI } from "@/lib/api";

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleRegister = async () => {
    Keyboard.dismiss();
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    try {
      const response = await authAPI.register(name, email, password);
      if (response.data.success) {
        Alert.alert("Success", "Account created! Please login.", [
          {
            text: "OK",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]);
      }
    } catch (error: any) {
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
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ flexGrow: 1, padding: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center">
          <View className="items-center mb-8">
            <Text className="text-3xl font-bold text-foreground">
              Create Account
            </Text>
            <Text className="text-muted-foreground mt-2">
              Join UniBus Tracking
            </Text>
          </View>

          <View className="gap-4">
            {/* Name Field */}
            <View>
              <Text className="text-foreground font-medium mb-2 text-sm">
                Full Name
              </Text>
              <TextInput
                className="bg-muted/50 border border-border rounded-xl px-4 py-3.5 text-foreground"
                placeholder="Enter your name"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {/* Email Field */}
            <View>
              <Text className="text-foreground font-medium mb-2 text-sm">
                Email
              </Text>
              <TextInput
                className="bg-muted/50 border border-border rounded-xl px-4 py-3.5 text-foreground"
                placeholder="Enter your email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Field */}
            <View>
              <Text className="text-foreground font-medium mb-2 text-sm">
                Password
              </Text>
              <TextInput
                className="bg-muted/50 border border-border rounded-xl px-4 py-3.5 text-foreground"
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* Confirm Password Field */}
            <View>
              <Text className="text-foreground font-medium mb-2 text-sm">
                Confirm Password
              </Text>
              <TextInput
                className="bg-muted/50 border border-border rounded-xl px-4 py-3.5 text-foreground"
                placeholder="Confirm your password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              className="bg-primary rounded-xl py-4 mt-6 active:opacity-90"
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-primary-foreground text-center font-semibold text-base">
                  Sign Up
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View className="flex-row justify-center mt-6 gap-1">
            <Text className="text-muted-foreground">
              Already have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
              <Text className="text-primary font-semibold">Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
