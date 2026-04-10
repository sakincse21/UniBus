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
import CreateNoticeModal from "@/components/CreateNoticeModal";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NoticeFilter = "all" | "forAll" | "forTeachers" | "myBatch";

export default function NoticesTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [notices, setNotices] = useState<INotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<INotice | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [filterType, setFilterType] = useState<NoticeFilter>("all");

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

  const getFilteredNotices = (): INotice[] => {
    switch (filterType) {
      case "forAll":
        return notices.filter((n) => n.forAll);
      case "forTeachers":
        return notices.filter((n) => n.forTeachers);
      case "myBatch":
        return notices.filter(
          (n) =>
            n.targetBatch?.id === user?.batch?.id &&
            !n.forAll &&
            !n.forTeachers,
        );
      case "all":
      default:
        return notices;
    }
  };

  const handleNoticePress = (notice: INotice) => {
    setSelectedNotice(notice);
    setDetailModalVisible(true);
  };

  const handleNoticeDelete = (noticeId: number) => {
    setNotices((prev) => prev.filter((n) => n.id !== noticeId));
    setDetailModalVisible(false);
  };

  const handleCreateSuccess = () => {
    fetchNotices();
  };

  const canCreateNotice =
    user?.role === "admin" ||
    user?.role === "teacher" ||
    user?.role === "cr" ||
    user?.role === "student";

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
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-gray-900">Notices</Text>
          </View>
          {canCreateNotice && (
            <TouchableOpacity
              onPress={() => setCreateModalVisible(true)}
              className="bg-blue-600 rounded-lg p-3"
            >
              <Text className="text-white text-sm font-semibold">
                ✏️ Create
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="border-b border-gray-100">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setFilterType("all")}
            className={`px-4 py-2 rounded-full ${
              filterType === "all" ? "bg-blue-600" : "bg-gray-100"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                filterType === "all" ? "text-white" : "text-gray-700"
              }`}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterType("forAll")}
            className={`px-4 py-2 rounded-full ${
              filterType === "forAll" ? "bg-blue-600" : "bg-gray-100"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                filterType === "forAll" ? "text-white" : "text-gray-700"
              }`}
            >
              For All
            </Text>
          </TouchableOpacity>

          {(user?.role === "teacher" || user?.role === "admin") && (
            <TouchableOpacity
              onPress={() => setFilterType("forTeachers")}
              className={`px-4 py-2 rounded-full ${
                filterType === "forTeachers" ? "bg-blue-600" : "bg-gray-100"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  filterType === "forTeachers" ? "text-white" : "text-gray-700"
                }`}
              >
                Teachers
              </Text>
            </TouchableOpacity>
          )}

          {user?.batch && (
            <TouchableOpacity
              onPress={() => setFilterType("myBatch")}
              className={`px-4 py-2 rounded-full ${
                filterType === "myBatch" ? "bg-blue-600" : "bg-gray-100"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  filterType === "myBatch" ? "text-white" : "text-gray-700"
                }`}
              >
                My Batch
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
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
        {getFilteredNotices().length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-5xl mb-3">📋</Text>
            <Text className="text-gray-900 text-lg font-semibold">
              No notices found
            </Text>
            <Text className="text-gray-500 text-sm mt-2">
              {filterType === "all"
                ? "Check back later for updates"
                : `No notices for this category`}
            </Text>
          </View>
        ) : (
          getFilteredNotices().map((notice) => (
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

      {/* Create Notice Modal */}
      <CreateNoticeModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />
    </View>
  );
}
