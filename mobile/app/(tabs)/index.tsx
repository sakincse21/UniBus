import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { noticeAPI } from "@/lib/api";
import { INotice } from "@/interfaces";
import { getSocket } from "@/lib/socket";
import NoticeCard from "@/components/ui/NoticeCard";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "expo-router";

export default function NoticesTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [notices, setNotices] = useState<INotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchNotices = async () => {
    try {
      const response = await noticeAPI.getNotices();
      if (response.data.success) {
        setNotices(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch notices:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotices();

    // Setup socket for real-time notices
    let socket: any;
    const setupSocket = async () => {
      socket = await getSocket();
      socket.on("notice_published", (notice: INotice) => {
        setNotices((prev) => [notice, ...prev]);
      });
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.off("notice_published");
      }
    };
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchNotices();
  };

  // Check if user can create notices
  const canCreateNotice =
    user?.role === "admin" || user?.role === "teacher" || user?.role === "cr";

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Notices</Text>
            <Text className="text-gray-500 text-sm mt-1">
              Latest updates from university
            </Text>
          </View>
          {canCreateNotice && (
            <TouchableOpacity
              className="bg-blue-600 px-4 py-2 rounded-lg"
              onPress={() => router.push("/create-notice")}
            >
              <Text className="text-white font-semibold">+ New</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Notice List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={["#2563eb"]}
          />
        }
      >
        {notices.length === 0 ? (
          <View className="items-center py-10">
            <Text className="text-4xl mb-4">📋</Text>
            <Text className="text-gray-500 text-lg">No notices yet</Text>
            <Text className="text-gray-400 text-sm mt-2">
              Check back later for updates
            </Text>
          </View>
        ) : (
          notices.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
