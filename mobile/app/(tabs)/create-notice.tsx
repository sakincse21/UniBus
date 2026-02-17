import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { noticeAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function CreateNoticeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [forAll, setForAll] = useState(false);
  const [forTeachers, setForTeachers] = useState(false);
  const [targetBatchId, setTargetBatchId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert("Error", "Title and content are required");
      return;
    }

    // Validate targeting (exactly one must be selected)
    const targetCount =
      (forAll ? 1 : 0) + (forTeachers ? 1 : 0) + (targetBatchId ? 1 : 0);
    if (targetCount !== 1) {
      Alert.alert("Error", "Select exactly one target audience");
      return;
    }

    // CR restrictions
    if (user?.role === "cr") {
      if (forAll || forTeachers) {
        Alert.alert("Error", "CR can only post for their own batch");
        return;
      }
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
        forAll,
        forTeachers,
        targetBatchId: targetBatchId ? Number(targetBatchId) : undefined,
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

  return (
    <ScrollView className="flex-1 bg-white">
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
            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 h-32 text-top"
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
          <Text className="text-gray-500 text-sm mb-2">
            Select exactly one option
          </Text>

          {/* For All */}
          <TouchableOpacity
            className={`flex-row items-center p-3 rounded-lg border mb-2 ${
              forAll ? "bg-blue-50 border-blue-500" : "bg-white border-gray-300"
            }`}
            onPress={() => {
              setForAll(!forAll);
              setForTeachers(false);
              setTargetBatchId("");
            }}
            disabled={user?.role === "cr"}
          >
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                forAll ? "border-blue-500 bg-blue-500" : "border-gray-300"
              }`}
            >
              {forAll && <View className="w-2 h-2 bg-white rounded-full" />}
            </View>
            <Text className="text-gray-900 flex-1">For All</Text>
            {user?.role === "cr" && (
              <Text className="text-gray-400 text-xs">
                (Not available for CR)
              </Text>
            )}
          </TouchableOpacity>

          {/* For Teachers */}
          <TouchableOpacity
            className={`flex-row items-center p-3 rounded-lg border mb-2 ${
              forTeachers
                ? "bg-blue-50 border-blue-500"
                : "bg-white border-gray-300"
            }`}
            onPress={() => {
              setForTeachers(!forTeachers);
              setForAll(false);
              setTargetBatchId("");
            }}
            disabled={user?.role === "cr"}
          >
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                forTeachers ? "border-blue-500 bg-blue-500" : "border-gray-300"
              }`}
            >
              {forTeachers && (
                <View className="w-2 h-2 bg-white rounded-full" />
              )}
            </View>
            <Text className="text-gray-900 flex-1">For Teachers Only</Text>
            {user?.role === "cr" && (
              <Text className="text-gray-400 text-xs">
                (Not available for CR)
              </Text>
            )}
          </TouchableOpacity>

          {/* Target Batch */}
          <TouchableOpacity
            className={`flex-row items-center p-3 rounded-lg border ${
              targetBatchId
                ? "bg-blue-50 border-blue-500"
                : "bg-white border-gray-300"
            }`}
            onPress={() => {
              setTargetBatchId(targetBatchId ? "" : "1"); // Default to batch 1 for demo
              setForAll(false);
              setForTeachers(false);
            }}
          >
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                targetBatchId
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300"
              }`}
            >
              {targetBatchId && (
                <View className="w-2 h-2 bg-white rounded-full" />
              )}
            </View>
            <Text className="text-gray-900 flex-1">Target Specific Batch</Text>
          </TouchableOpacity>

          {targetBatchId ? (
            <View className="ml-8 mt-2">
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
                placeholder="Enter Batch ID (e.g., 1, 2, 3)"
                placeholderTextColor="#9ca3af"
                value={targetBatchId}
                onChangeText={setTargetBatchId}
                keyboardType="numeric"
              />
            </View>
          ) : null}
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
