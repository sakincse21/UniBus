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
import NoticeDetailModal from "@/components/NoticeDetailModal";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NoticesTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [notices, setNotices] = useState<INotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<INotice | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

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

  const handleNoticePress = (notice: INotice) => {
    setSelectedNotice(notice);
    setDetailModalVisible(true);
  };

  const handleNoticeDelete = (noticeId: number) => {
    setNotices((prev) => prev.filter((n) => n.id !== noticeId));
    setDetailModalVisible(false);
  };

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
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 py-4 border-b border-gray-100">
        <View>
          <Text className="text-3xl font-bold text-gray-900">Notices</Text>
          <Text className="text-gray-500 text-sm font-medium mt-1">
            {user?.role === "admin"
              ? "All notices"
              : user?.role === "teacher"
                ? "Teacher & general"
                : user?.batch
                  ? `Batch ${user.batch.name}`
                  : "General"}
          </Text>
        </View>
      </View>

      {/* Notices List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={["#2563eb"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {notices.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-5xl mb-3">📋</Text>
            <Text className="text-gray-900 text-lg font-semibold">
              No notices yet
            </Text>
            <Text className="text-gray-500 text-sm mt-2">
              Check back later for updates
            </Text>
          </View>
        ) : (
          notices.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              onPress={() => handleNoticePress(notice)}
            />
          ))
        )}
      </ScrollView>

      {/* Notice Detail Modal */}
      <NoticeDetailModal
        visible={detailModalVisible}
        notice={selectedNotice}
        onClose={() => setDetailModalVisible(false)}
        onDelete={handleNoticeDelete}
      />
    </View>
  );
}
