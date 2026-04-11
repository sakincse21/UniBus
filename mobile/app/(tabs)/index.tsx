import React, { useEffect, useState, useCallback } from "react";
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

type NoticeFilter = "accessible" | "pending" | "forTeachers" | "myBatch";

export default function NoticesTab() {
  const router = useRouter();
  const { user, refreshProfile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [notices, setNotices] = useState<INotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<INotice | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [filterType, setFilterType] = useState<NoticeFilter>("accessible");
  const [pendingNotices, setPendingNotices] = useState<INotice[]>([]);

  useEffect(() => {
    refreshProfile();
  }, []);

  const fetchNotices = useCallback(async () => {
    try {
      const approvedResponse = await noticeAPI.getNotices();
      if (approvedResponse.data.success) {
        setNotices(approvedResponse.data.data || []);
      }

      // Fetch pending notices for approvers or students
      if (
        user?.role === "admin" ||
        user?.role === "teacher" ||
        user?.role === "cr" ||
        user?.role === "student"
      ) {
        try {
          const pendingResponse = await noticeAPI.getPendingNotices();
          if (pendingResponse.data.success) {
            setPendingNotices(pendingResponse.data.data || []);
          }
        } catch (err) {
          console.error("Failed to fetch pending notices:", err);
        }
      }
    } catch (error) {
      console.error("Failed to fetch notices:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchNotices();

    let socket: any;
    const setupSocket = async () => {
      socket = await getSocket();
      socket.on("notice_published", (notice: INotice) => {
        setNotices((prev) => [notice, ...prev]);
        setPendingNotices((prev) => prev.filter((n) => n.id !== notice.id));
      });
      socket.on("notice_deleted", (data: { id: number }) => {
        setNotices((prev) => prev.filter((n) => n.id !== data.id));
        setPendingNotices((prev) => prev.filter((n) => n.id !== data.id));
      });
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.off("notice_published");
        socket.off("notice_deleted");
      }
    };
  }, [fetchNotices]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchNotices();
  };

  const getFilteredNotices = (): INotice[] => {
    switch (filterType) {
      case "forTeachers":
        return notices.filter((n) => n.forTeachers === true);

      case "myBatch":
        // Show notices targeting user's specific batch
        const userBatchId = user?.batch?.id;
        if (!userBatchId) return [];
        return notices.filter(
          (n) =>
            n.targetBatch?.id === userBatchId && !n.forAll && !n.forTeachers,
        );

      case "pending":
        if (user?.role === "student") {
          return pendingNotices.filter(
            (n) => n.createdBy?.user_id === user?.user_id,
          );
        }
        if (
          user?.role === "admin" ||
          user?.role === "teacher" ||
          user?.role === "cr"
        ) {
          return pendingNotices;
        }
        return [];

      case "accessible":
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
    setPendingNotices((prev) => prev.filter((n) => n.id !== noticeId));
    setDetailModalVisible(false);
  };

  const handleNoticeApprove = (noticeId: number) => {
    setPendingNotices((prev) => prev.filter((n) => n.id !== noticeId));
    fetchNotices();
  };

  const handleCreateSuccess = () => {
    fetchNotices();
  };

  const canCreateNotice =
    user?.role === "admin" ||
    user?.role === "teacher" ||
    user?.role === "cr" ||
    user?.role === "student";

  const filteredNotices = getFilteredNotices();

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-gray-900">Notices</Text>
            {user?.batch?.name && (
              <Text className="text-sm text-gray-500 mt-1">
                Batch: {user.batch.name}
              </Text>
            )}
          </View>
          {canCreateNotice && (
            <TouchableOpacity
              onPress={() => setCreateModalVisible(true)}
              className="bg-blue-600 rounded-xl px-4 py-2.5 active:bg-blue-700"
            >
              <Text className="text-white font-semibold">+ Create</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="bg-white border-b border-gray-100">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setFilterType("accessible")}
            className={`px-4 py-2 rounded-full ${
              filterType === "accessible" ? "bg-blue-600" : "bg-gray-100"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                filterType === "accessible" ? "text-white" : "text-gray-700"
              }`}
            >
              📢 All
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
                👨‍🏫 Teachers
              </Text>
            </TouchableOpacity>
          )}

          {user?.batch && (user?.role === "cr" || user?.role === "student") && (
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
                📚 Batch {user.batch.name}
              </Text>
            </TouchableOpacity>
          )}

          {(user?.role === "admin" ||
            user?.role === "teacher" ||
            user?.role === "cr" ||
            user?.role === "student") && (
            <TouchableOpacity
              onPress={() => setFilterType("pending")}
              className={`px-4 py-2 rounded-full ${
                filterType === "pending" ? "bg-amber-600" : "bg-amber-50"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  filterType === "pending" ? "text-white" : "text-amber-700"
                }`}
              >
                ⏳ {user?.role === "student" ? "My Pending" : "Pending"}
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
        {filteredNotices.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-5xl mb-3">📋</Text>
            <Text className="text-gray-900 text-lg font-semibold">
              No notices found
            </Text>
            <Text className="text-gray-500 text-sm mt-2 text-center">
              {filterType === "myBatch"
                ? `No notices for your batch yet`
                : filterType === "pending"
                  ? "No pending notices"
                  : "Check back later for updates"}
            </Text>
          </View>
        ) : (
          filteredNotices.map((notice) => (
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
        onApprove={handleNoticeApprove}
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
