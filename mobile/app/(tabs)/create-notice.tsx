import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { noticeAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function CreateNoticeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetType, setTargetType] = useState<
    "all" | "teachers" | "batch" | ""
  >("");
  const [batchId, setBatchId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!title.trim() || !content.trim()) {
      Alert.alert("Error", "Title and content are required");
      return;
    }

    if (!targetType) {
      Alert.alert("Error", "Please select target audience");
      return;
    }

    if (targetType === "batch" && !batchId.trim()) {
      Alert.alert("Error", "Please enter batch ID");
      return;
    }

    // CR restrictions
    if (user?.role === "cr") {
      if (targetType !== "batch") {
        Alert.alert("Error", "CR can only post for their own batch");
        return;
      }
      // if (!user?.batch?.name) {
      //   Alert.alert("Error", "CR must belong to a batch");
      //   return;
      // }
    }

    // Student cannot create notice
    if (user?.role === "student") {
      Alert.alert("Error", "Students cannot create notices");
      return;
    }

    setIsLoading(true);
    try {
      const response = await noticeAPI.createNotice({
        title,
        content,
        forAll: targetType === "all",
        forTeachers: targetType === "teachers",
        targetBatchId: targetType === "batch" ? batchId : undefined,
      });

      if (response.data.success) {
        Alert.alert(
          "Success",
          user?.role === "admin" || user?.role === "teacher"
            ? "Notice published!"
            : "Notice submitted for approval",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(tabs)"),
            },
          ],
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create notice",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isAdminOrTeacher = user?.role === "admin" || user?.role === "teacher";
  const isCR = user?.role === "cr";

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Create Notice</Text>
        <Text className="text-gray-500 text-sm mt-1">
          {isAdminOrTeacher
            ? "Notice will be published immediately"
            : "Notice requires admin approval"}
        </Text>
      </View>

      {/* Form */}
      <View className="p-4 gap-4">
        {/* Title */}
        <View>
          <Text className="text-gray-900 font-medium mb-2">Title *</Text>
          <TextInput
            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
            placeholder="Enter notice title"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Content */}
        <View>
          <Text className="text-gray-900 font-medium mb-2">Content *</Text>
          <TextInput
            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 min-h-[120px]"
            placeholder="Enter notice content"
            placeholderTextColor="#9ca3af"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Target Audience */}
        <View>
          <Text className="text-gray-900 font-medium mb-2">
            Target Audience *
          </Text>
          <Text className="text-gray-500 text-sm mb-3">
            Select exactly one option
          </Text>

          {/* For All */}
          <TouchableOpacity
            className={`flex-row items-center p-3 rounded-lg border mb-2 ${
              targetType === "all"
                ? "bg-blue-50 border-blue-500"
                : "bg-white border-gray-300"
            } ${isCR ? "opacity-50" : ""}`}
            onPress={() => {
              if (!isCR) {
                setTargetType("all");
                setBatchId("");
              }
            }}
            disabled={isCR}
          >
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                targetType === "all"
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300"
              }`}
            >
              {targetType === "all" && (
                <View className="w-2 h-2 bg-white rounded-full" />
              )}
            </View>
            <Text className="text-gray-900 flex-1">For All</Text>
            {isCR && (
              <Text className="text-gray-400 text-xs">(Not available)</Text>
            )}
          </TouchableOpacity>

          {/* For Teachers */}
          <TouchableOpacity
            className={`flex-row items-center p-3 rounded-lg border mb-2 ${
              targetType === "teachers"
                ? "bg-blue-50 border-blue-500"
                : "bg-white border-gray-300"
            } ${isCR ? "opacity-50" : ""}`}
            onPress={() => {
              if (!isCR) {
                setTargetType("teachers");
                setBatchId("");
              }
            }}
            disabled={isCR}
          >
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                targetType === "teachers"
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300"
              }`}
            >
              {targetType === "teachers" && (
                <View className="w-2 h-2 bg-white rounded-full" />
              )}
            </View>
            <Text className="text-gray-900 flex-1">For Teachers Only</Text>
            {isCR && (
              <Text className="text-gray-400 text-xs">(Not available)</Text>
            )}
          </TouchableOpacity>

          {/* Target Batch */}
          <TouchableOpacity
            className={`flex-row items-center p-3 rounded-lg border ${
              targetType === "batch"
                ? "bg-blue-50 border-blue-500"
                : "bg-white border-gray-300"
            }`}
            onPress={() => {
              setTargetType("batch");
              // Auto-fill batch for CR users
              if (isCR && user?.batch?.name) {
                setBatchId(user.batch.name);
              } else {
                setBatchId("");
              }
            }}
          >
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                targetType === "batch"
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300"
              }`}
            >
              {targetType === "batch" && (
                <View className="w-2 h-2 bg-white rounded-full" />
              )}
            </View>
            <Text className="text-gray-900 flex-1">Target Specific Batch</Text>
          </TouchableOpacity>

          {/* Batch ID Input - Shows when targetType is "batch" */}
          {targetType === "batch" && (
            <View className="ml-8 mt-3">
              <Text className="text-gray-500 text-xs mb-1">
                {/* {isCR
                  ? `Your batch (auto-filled)`
                  : "Enter Batch ID (e.g., 2021, 2022, 2023)"} */}
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
                placeholder="Enter Batch ID"
                placeholderTextColor="#9ca3af"
                value={batchId}
                onChangeText={setBatchId}
                keyboardType="numeric"
                //editable={!isCR} // CR cannot edit
              />
              {isCR && user?.batch?.name && (
                <Text className="text-green-600 text-xs mt-1">
                  ✓ Batch: {user.batch.name}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          className="bg-blue-600 rounded-lg py-3 mt-4"
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">
              {isAdminOrTeacher ? "Publish Notice" : "Submit for Approval"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          className="bg-gray-200 rounded-lg py-3 mt-2"
          onPress={() => router.back()}
        >
          <Text className="text-gray-700 text-center font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
