import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      </View>

      <View className="p-4">
        <View className="bg-gray-50 rounded-xl p-4 shadow-sm border border-gray-100">
          <View className="items-center mb-4">
            <View className="w-20 h-20 rounded-full bg-blue-600 items-center justify-center mb-3">
              <Text className="text-3xl text-white font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="text-xl font-bold text-gray-900">
              {user?.name}
            </Text>
            <Text className="text-gray-500">{user?.email}</Text>
          </View>

          <View className="border-t border-gray-200 pt-4">
            <View className="flex-row justify-between py-2">
              <Text className="text-gray-500">Role</Text>
              <Text className="text-gray-900 font-medium capitalize">
                {user?.role}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          className="bg-red-500 rounded-lg py-3 mt-6"
          onPress={handleLogout}
        >
          <Text className="text-white text-center font-semibold text-lg">
            Logout
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
