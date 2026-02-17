import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { noticeAPI } from "@/lib/api";
import { INotice } from "@/interfaces";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "expo-router";

export default function PendingNoticesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [notices, setNotices] = useState<INotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPendingNotices = async () => {
    try {
      const response = await noticeAPI.getPendingNotices();
      if (response.data.success) {
        setNotices(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch pending notices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only admin can access this
    if (user?.role !== "admin") {
      Alert.alert("Access Denied", "Only admins can manage pending notices");
      router.replace("/(tabs)");
      return;
    }
    fetchPendingNotices();
  }, []);

  const handleApprove = async (id: number) => {
    Alert.alert(
      "Approve Notice",
      "Are you sure you want to approve this notice?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              await noticeAPI.approveNotice(id);
              setNotices((prev) => prev.filter((n) => n.id !== id));
              Alert.alert("Success", "Notice approved and published");
            } catch (error) {
              Alert.alert("Error", "Failed to approve notice");
            }
          },
        },
      ],
    );
  };

  const handleReject = async (id: number) => {
    Alert.alert(
      "Reject Notice",
      "Are you sure you want to reject this notice?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await noticeAPI.rejectNotice(id);
              setNotices((prev) => prev.filter((n) => n.id !== id));
              Alert.alert("Success", "Notice rejected");
            } catch (error) {
              Alert.alert("Error", "Failed to reject notice");
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">
          Pending Notices
        </Text>
        <Text className="text-gray-500 text-sm mt-1">
          {notices.length} notice(s) awaiting approval
        </Text>
      </View>

      {/* Notice List */}
      <View className="p-4 gap-4">
        {notices.length === 0 ? (
          <View className="items-center py-10">
            <Text className="text-4xl mb-4">✅</Text>
            <Text className="text-gray-500 text-lg">All caught up!</Text>
            <Text className="text-gray-400 text-sm mt-2">
              No pending notices to review
            </Text>
          </View>
        ) : (
          notices.map((notice) => (
            <View
              key={notice.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
            >
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-lg font-bold text-gray-900 flex-1">
                  {notice.title}
                </Text>
                <View className="bg-yellow-100 px-2 py-1 rounded-full ml-2">
                  <Text className="text-xs text-yellow-600 font-medium">
                    Pending
                  </Text>
                </View>
              </View>

              <Text className="text-gray-900 mb-3 leading-5">
                {notice.content}
              </Text>

              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-xs text-gray-500">
                  {new Date(notice.createdAt).toLocaleDateString()}
                </Text>
                <Text className="text-xs text-gray-500">
                  By: {notice.createdBy?.name || "Unknown"}
                </Text>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 bg-green-600 rounded-lg py-2"
                  onPress={() => handleApprove(notice.id)}
                >
                  <Text className="text-white text-center font-semibold">
                    Approve
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-red-600 rounded-lg py-2"
                  onPress={() => handleReject(notice.id)}
                >
                  <Text className="text-white text-center font-semibold">
                    Reject
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
