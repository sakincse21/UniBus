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
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NoticeFilter = "accessible" | "forTeachers" | "myBatch";

export default function NoticesTab() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [notices, setNotices] = useState<INotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<INotice | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [filterType, setFilterType] = useState<NoticeFilter>("accessible");
  const [pendingNotices, setPendingNotices] = useState<INotice[]>([]);
  const [showPending, setShowPending] = useState(false);

  const canApproveNotices =
    user?.role === "admin" || user?.role === "teacher" || user?.role === "cr";
  const canCreateNotice =
    user?.role === "admin" ||
    user?.role === "teacher" ||
    user?.role === "cr" ||
    user?.role === "student";
  const hasBatch = !!user?.batch;
  const isStudent = user?.role === "student";
  const isTeacher = user?.role === "teacher";
  const isCR = user?.role === "cr";
  const isAdmin = user?.role === "admin";

  const fetchNotices = useCallback(async () => {
    try {
      const approvedResponse = await noticeAPI.getNotices();
      if (approvedResponse.data.success) {
        setNotices(approvedResponse.data.data || []);
      }

      if (canApproveNotices) {
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
  }, [canApproveNotices]);

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
    if (showPending && canApproveNotices) {
      return pendingNotices;
    }

    switch (filterType) {
      case "forTeachers":
        return notices.filter((n) => n.forTeachers === true);
      case "myBatch":
        const userBatchId = user?.batch?.id;
        if (!userBatchId) return [];
        return notices.filter(
          (n) =>
            n.targetBatch?.id === userBatchId && !n.forAll && !n.forTeachers,
        );
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

  const filteredNotices = getFilteredNotices();
  const hasPendingNotices = canApproveNotices && pendingNotices.length > 0;

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900">Notices</Text>
            {user?.batch?.name && (
              <Text className="text-sm text-gray-500 mt-1">
                Batch: {user.batch.name}
              </Text>
            )}
          </View>
          {canCreateNotice && (
            <TouchableOpacity
              onPress={() => setCreateModalVisible(true)}
              className="bg-blue-600 rounded-lg px-4 py-2"
            >
              <Text className="text-white font-semibold">Create</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View className="bg-white border-b border-gray-100">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setShowPending(false);
              setFilterType("accessible");
            }}
            className={`px-4 py-2 rounded-lg ${!showPending && filterType === "accessible" ? "bg-blue-600" : "bg-gray-100"}`}
          >
            <Text
              className={`text-sm font-medium ${!showPending && filterType === "accessible" ? "text-white" : "text-gray-700"}`}
            >
              All
            </Text>
          </TouchableOpacity>

          {/* Teachers Only - for admin and teacher roles */}
          {(isTeacher || isAdmin) && (
            <TouchableOpacity
              onPress={() => {
                setShowPending(false);
                setFilterType("forTeachers");
              }}
              className={`px-4 py-2 rounded-lg ${!showPending && filterType === "forTeachers" ? "bg-blue-600" : "bg-gray-100"}`}
            >
              <Text
                className={`text-sm font-medium ${!showPending && filterType === "forTeachers" ? "text-white" : "text-gray-700"}`}
              >
                Teachers
              </Text>
            </TouchableOpacity>
          )}

          {/* My Batch - for students and CR who have a batch */}
          {hasBatch && (isStudent || isCR) && (
            <TouchableOpacity
              onPress={() => {
                setShowPending(false);
                setFilterType("myBatch");
              }}
              className={`px-4 py-2 rounded-lg ${!showPending && filterType === "myBatch" ? "bg-blue-600" : "bg-gray-100"}`}
            >
              <Text
                className={`text-sm font-medium ${!showPending && filterType === "myBatch" ? "text-white" : "text-gray-700"}`}
              >
                My Batch
              </Text>
            </TouchableOpacity>
          )}

          {/* Pending - only for admin, teacher, CR */}
          {canApproveNotices && (
            <TouchableOpacity
              onPress={() => {
                setShowPending(true);
              }}
              className={`px-4 py-2 rounded-lg ${showPending ? "bg-amber-600" : "bg-gray-100"}`}
            >
              <Text
                className={`text-sm font-medium ${showPending ? "text-white" : "text-amber-700"}`}
              >
                Pending {hasPendingNotices ? `(${pendingNotices.length})` : ""}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

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
            <Text className="text-gray-400 text-base">No notices found</Text>
            <Text className="text-gray-400 text-sm mt-2">
              {showPending
                ? "No pending notices to review"
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

      <NoticeDetailModal
        visible={detailModalVisible}
        notice={selectedNotice}
        onClose={() => setDetailModalVisible(false)}
        onDelete={handleNoticeDelete}
        onApprove={handleNoticeApprove}
      />

      <CreateNoticeModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />
    </View>
  );
}
