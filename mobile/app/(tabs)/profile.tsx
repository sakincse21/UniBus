import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { userAPI } from "@/lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, refreshProfile, updateUser } = useAuthStore();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [editPassword, setEditPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    refreshProfile();
  }, []);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email);
    }
  }, [user]);

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

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    if (!editEmail.trim()) {
      Alert.alert("Error", "Email cannot be empty");
      return;
    }

    if (editPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const updateData: any = {
        name: editName,
        email: editEmail,
      };

      if (editPassword) {
        updateData.password = editPassword;
      }

      await userAPI.updateProfile(updateData);
      updateUser({ name: editName, email: editEmail });
      await refreshProfile();

      Alert.alert("Success", "Profile updated successfully");
      setIsEditModalVisible(false);
      setEditPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to update profile",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case "admin":
        return "bg-purple-100 text-purple-700";
      case "teacher":
        return "bg-blue-100 text-blue-700";
      case "cr":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-4 py-4 bg-white border-b border-gray-100">
          <Text className="text-2xl font-bold text-gray-900">Profile</Text>
        </View>

        <View className="p-4">
          <View className="bg-white rounded-lg p-6 mb-6 border border-gray-200">
            <View className="items-center mb-4">
              <View className="w-20 h-20 rounded-full bg-blue-600 items-center justify-center mb-3">
                <Text className="text-3xl font-bold text-white">
                  {user?.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-xl font-bold text-gray-900 text-center">
                {user?.name}
              </Text>
              <Text className="text-gray-500 text-center mt-1">
                {user?.email}
              </Text>
            </View>

            <View className="border-t border-gray-100 pt-4">
              <View className="flex-row justify-between items-center py-2">
                <Text className="text-gray-600">Role</Text>
                <View
                  className={`px-3 py-1 rounded-full ${getRoleBadgeColor()}`}
                >
                  <Text className={`font-medium capitalize`}>{user?.role}</Text>
                </View>
              </View>

              {user?.batch?.name && (
                <View className="flex-row justify-between items-center py-2">
                  <Text className="text-gray-600">Batch</Text>
                  <View className="bg-blue-50 px-3 py-1 rounded-full">
                    <Text className="text-blue-700 font-medium">
                      {user.batch.name}
                    </Text>
                  </View>
                </View>
              )}

              <View className="flex-row justify-between items-center py-2">
                <Text className="text-gray-600">Account Status</Text>
                <View className="bg-green-50 px-3 py-1 rounded-full">
                  <Text className="text-green-700 font-medium">Active</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            className="bg-blue-600 rounded-lg py-3 mb-3"
            onPress={() => setIsEditModalVisible(true)}
          >
            <Text className="text-white text-center font-semibold text-base">
              Edit Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-red-600 rounded-lg py-3"
            onPress={handleLogout}
          >
            <Text className="text-white text-center font-semibold text-base">
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
          <View className="flex-row justify-between items-center px-4 py-4 bg-white border-b border-gray-100">
            <TouchableOpacity
              onPress={() => {
                setIsEditModalVisible(false);
                setEditPassword("");
                setConfirmPassword("");
              }}
            >
              <Text className="text-blue-600 text-base font-semibold">
                Back
              </Text>
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900">
              Edit Profile
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            className="flex-1 p-4"
            showsVerticalScrollIndicator={false}
          >
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-2">
                Full Name
              </Text>
              <TextInput
                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 text-base"
                placeholder="Enter full name"
                value={editName}
                onChangeText={setEditName}
                editable={!isLoading}
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-2">Email</Text>
              <TextInput
                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 text-base"
                placeholder="Enter email"
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <View className="bg-gray-100 rounded-lg p-4 mb-4">
              <Text className="text-gray-900 font-semibold mb-3">
                Change Password (Optional)
              </Text>

              <View className="mb-3">
                <Text className="text-gray-600 font-medium text-sm mb-2">
                  New Password
                </Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 text-base"
                  placeholder="Leave blank to keep current"
                  value={editPassword}
                  onChangeText={setEditPassword}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>

              <View>
                <Text className="text-gray-600 font-medium text-sm mb-2">
                  Confirm Password
                </Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 text-base"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>
            </View>

            <TouchableOpacity
              className="bg-blue-600 rounded-lg py-3 flex-row justify-center items-center"
              onPress={handleUpdateProfile}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-center font-semibold text-base">
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
