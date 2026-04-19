import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { noticeAPI, userAPI } from "@/lib/api";
import {
  INotice,
  INoticeTagOption,
  NoticeSortBy,
  NoticeSortOrder,
  NoticeTag,
} from "@/interfaces";
import { getSocket } from "@/lib/socket";
import { sendLocalNotification } from "@/lib/notifications";
import NoticeCard from "@/components/ui/NoticeCard";
import NoticeDetailModal from "../../components/NoticeDetailModal";
import CreateNoticeModal from "../../components/CreateNoticeModal";
import { useAuthStore } from "@/store/authStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_THEME_COLORS } from "@/lib/theme";

type NoticeFilter = "accessible" | "forTeachers" | "myBatch";
type PickerSheet = "view" | "sort" | "tag";

const COLORS = APP_THEME_COLORS;

const DEFAULT_TAG_OPTIONS: INoticeTagOption[] = [
  { value: "general", label: "General" },
  { value: "academic", label: "Academic" },
  { value: "exam", label: "Exam" },
  { value: "event", label: "Event" },
  { value: "transport", label: "Transport" },
  { value: "urgent", label: "Urgent" },
];

function getDefaultSortOrder(sortBy: NoticeSortBy): NoticeSortOrder {
  return sortBy === "timePosted" ? "desc" : "asc";
}

function FilterTrigger({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  onPress: () => void;
}) {

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      className="rounded-lg px-3 py-2"
      style={{
        backgroundColor: COLORS.surfaceLow,
        borderWidth: 1,
        borderColor: COLORS.outline,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="w-5 h-5 rounded-md items-center justify-center"
          style={{
            backgroundColor: COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.outline,
          }}
        >
          <Feather name={icon} size={11} color={COLORS.onSurfaceMuted} />
        </View>
        <Text className="text-xs font-semibold ml-1.5" style={{ color: COLORS.onSurface }}>
          {label}
        </Text>
      </View>

      <View className="flex-row items-center mt-1">
        <Text className="text-xs font-semibold mr-1" style={{ color: COLORS.onSurfaceMuted }}>
          {value}
        </Text>
        <Feather name="chevron-down" size={12} color={COLORS.onSurfaceMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function NoticesTab() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [notices, setNotices] = useState<INotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<INotice | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [filterType, setFilterType] = useState<NoticeFilter>("accessible");
  const [sortBy, setSortBy] = useState<NoticeSortBy>("timePosted");
  const [sortOrder, setSortOrder] = useState<NoticeSortOrder>(
    getDefaultSortOrder("timePosted"),
  );
  const [tagFilter, setTagFilter] = useState<NoticeTag | "all">("all");
  const [tagOptions, setTagOptions] = useState<INoticeTagOption[]>(
    DEFAULT_TAG_OPTIONS,
  );
  const [pickerSheet, setPickerSheet] = useState<PickerSheet | null>(null);
  const [pendingNotices, setPendingNotices] = useState<INotice[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [accountSettingsVisible, setAccountSettingsVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

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
      const approvedResponse = await noticeAPI.getNotices({
        sortBy,
        sortOrder,
        tag: tagFilter,
      });
      if (approvedResponse.data.success) {
        setNotices(approvedResponse.data.data || []);
      }

      if (canApproveNotices) {
        try {
          const pendingResponse = await noticeAPI.getPendingNotices();
          if (pendingResponse.data.success) {
            setPendingNotices(pendingResponse.data.data || []);
          }
        } catch (pendingError) {
          console.error("Failed to fetch pending notices:", pendingError);
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return;
      }
      console.error("Failed to fetch notices:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [canApproveNotices, sortBy, sortOrder, tagFilter]);

  useEffect(() => {
    let active = true;

    noticeAPI
      .getNoticeTags()
      .then((response) => {
        if (!active) return;

        const options = response?.data?.data;
        if (Array.isArray(options) && options.length > 0) {
          setTagOptions(options);
        }
      })
      .catch(() => {
        // Keep fallback options when tag endpoint cannot be reached.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fetchNotices();

    let socket: any;

    const setupSocket = async () => {
      socket = await getSocket();

      socket.on("notice_published", (notice: INotice) => {
        const shouldInsertAtTop =
          sortBy === "timePosted" &&
          sortOrder === "desc" &&
          (tagFilter === "all" || notice.tag === tagFilter);

        if (shouldInsertAtTop) {
          setNotices((prev) => {
            if (prev.some((item) => item.id === notice.id)) {
              return prev;
            }
            return [notice, ...prev];
          });
        } else {
          fetchNotices();
        }

        setPendingNotices((prev) => prev.filter((item) => item.id !== notice.id));

        sendLocalNotification(
          `New Notice: ${notice.title}`,
          (notice.content || "New notice published").slice(0, 140),
          {
            type: "notice",
            noticeId: notice.id,
          },
          "notice-updates",
        ).catch(() => {});
      });

      socket.on("notice_deleted", (data: { id: number }) => {
        setNotices((prev) => prev.filter((item) => item.id !== data.id));
        setPendingNotices((prev) => prev.filter((item) => item.id !== data.id));
      });
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.off("notice_published");
        socket.off("notice_deleted");
      }
    };
  }, [fetchNotices, sortBy, sortOrder, tagFilter]);

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
        return notices.filter((item) => item.forTeachers === true);
      case "myBatch": {
        const userBatchId = user?.batch?.id;
        if (!userBatchId) return [];

        return notices.filter(
          (item) =>
            item.targetBatch?.id === userBatchId && !item.forAll && !item.forTeachers,
        );
      }
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
    setNotices((prev) => prev.filter((item) => item.id !== noticeId));
    setPendingNotices((prev) => prev.filter((item) => item.id !== noticeId));
    setDetailModalVisible(false);
  };

  const handleNoticeApprove = (noticeId: number) => {
    setPendingNotices((prev) => prev.filter((item) => item.id !== noticeId));
    fetchNotices();
  };

  const handleCreateSuccess = () => {
    fetchNotices();
  };

  const closeAccountSettingsModal = () => {
    setAccountSettingsVisible(false);
    setNewPassword("");
    setConfirmPassword("");
    setIsSavingPassword(false);
  };

  const handleOpenAccountSettings = () => {
    setMenuVisible(false);
    setAccountSettingsVisible(true);
  };

  const handleChangePassword = async () => {
    const trimmedPassword = newPassword.trim();

    if (!trimmedPassword) {
      Alert.alert("Password Required", "Please enter a new password.");
      return;
    }

    if (trimmedPassword.length < 6) {
      Alert.alert(
        "Password Too Short",
        "Password must be at least 6 characters.",
      );
      return;
    }

    if (trimmedPassword !== confirmPassword.trim()) {
      Alert.alert("Mismatch", "New password and confirm password do not match.");
      return;
    }

    setIsSavingPassword(true);

    try {
      await userAPI.updateProfile({ password: trimmedPassword });
      Alert.alert("Success", "Password changed successfully.");
      closeAccountSettingsModal();
    } catch (error) {
      const fallbackMessage = "Failed to change password. Please try again.";

      if (axios.isAxiosError(error)) {
        Alert.alert("Update Failed", error.response?.data?.message || fallbackMessage);
      } else {
        Alert.alert("Update Failed", fallbackMessage);
      }

      setIsSavingPassword(false);
    }
  };

  const handleLogout = () => {
    setMenuVisible(false);
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
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

  const hasPendingNotices = canApproveNotices && pendingNotices.length > 0;

  const getTagLabel = (value: NoticeTag | "all") => {
    if (value === "all") return "All Tags";
    return tagOptions.find((option) => option.value === value)?.label || "All Tags";
  };

  const selectedViewLabel = showPending
    ? `Pending${hasPendingNotices ? ` (${pendingNotices.length})` : ""}`
    : filterType === "forTeachers"
      ? "Teachers"
      : filterType === "myBatch"
        ? "My Batch"
        : "All Notices";

  const selectedSortLabel =
    sortBy === "timePosted"
      ? sortOrder === "desc"
        ? "Recently posted"
        : "Oldest first"
      : sortOrder === "asc"
        ? "Upcoming first"
        : "Latest event date";

  const isDefaultControlState =
    !showPending &&
    filterType === "accessible" &&
    sortBy === "timePosted" &&
    sortOrder === "desc" &&
    tagFilter === "all";

  const resetControls = () => {
    setShowPending(false);
    setFilterType("accessible");
    setSortBy("timePosted");
    setSortOrder("desc");
    setTagFilter("all");
  };

  const pickerTitle =
    pickerSheet === "view"
      ? "Choose View"
      : pickerSheet === "sort"
        ? "Sort Notices"
        : pickerSheet === "tag"
          ? "Choose Tag"
          : "";

  const pickerOptions = (() => {
    if (pickerSheet === "view") {
      const options: Array<{
        key: string;
        label: string;
        active: boolean;
        tone?: "primary" | "warning";
        onSelect: () => void;
      }> = [
        {
          key: "view-accessible",
          label: "All Notices",
          active: !showPending && filterType === "accessible",
          onSelect: () => {
            setShowPending(false);
            setFilterType("accessible");
          },
        },
      ];

      if (isTeacher || isAdmin) {
        options.push({
          key: "view-teachers",
          label: "Teachers",
          active: !showPending && filterType === "forTeachers",
          onSelect: () => {
            setShowPending(false);
            setFilterType("forTeachers");
          },
        });
      }

      if (hasBatch && (isStudent || isCR)) {
        options.push({
          key: "view-my-batch",
          label: "My Batch",
          active: !showPending && filterType === "myBatch",
          onSelect: () => {
            setShowPending(false);
            setFilterType("myBatch");
          },
        });
      }

      if (canApproveNotices) {
        options.push({
          key: "view-pending",
          label: `Pending${hasPendingNotices ? ` (${pendingNotices.length})` : ""}`,
          active: showPending,
          tone: "warning",
          onSelect: () => {
            setShowPending(true);
          },
        });
      }

      return options;
    }

    if (pickerSheet === "sort") {
      return [
        {
          key: "sort-time-desc",
          label: "Recently posted",
          active: sortBy === "timePosted" && sortOrder === "desc",
          onSelect: () => {
            setSortBy("timePosted");
            setSortOrder("desc");
            setTagFilter("all");
          },
        },
        {
          key: "sort-time-asc",
          label: "Oldest first",
          active: sortBy === "timePosted" && sortOrder === "asc",
          onSelect: () => {
            setSortBy("timePosted");
            setSortOrder("asc");
            setTagFilter("all");
          },
        },
        {
          key: "sort-event-asc",
          label: "Upcoming first",
          active: sortBy === "upcomingEvent" && sortOrder === "asc",
          onSelect: () => {
            setSortBy("upcomingEvent");
            setSortOrder("asc");
            setTagFilter("all");
          },
        },
        {
          key: "sort-event-desc",
          label: "Latest event date",
          active: sortBy === "upcomingEvent" && sortOrder === "desc",
          onSelect: () => {
            setSortBy("upcomingEvent");
            setSortOrder("desc");
            setTagFilter("all");
          },
        },
      ];
    }

    if (pickerSheet === "tag") {
      return [
        {
          key: "tag-all",
          label: "All Tags",
          active: tagFilter === "all",
          onSelect: () => setTagFilter("all"),
        },
        ...tagOptions.map((option) => ({
          key: `tag-${option.value}`,
          label: option.label,
          active: tagFilter === option.value,
          onSelect: () => setTagFilter(option.value),
        })),
      ];
    }

    return [];
  })();

  const filteredNotices = getFilteredNotices();
  const fabBottomOffset = insets.bottom;

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: COLORS.background }}>
      <View className="px-4 pt-4 pb-3">
        <View
          className="rounded-xl p-4"
          style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}
        >
          <View className="flex-row items-start justify-between">
            <View className="pr-3 flex-1">
              <Text className="text-3xl font-extrabold" style={{ color: COLORS.onSurface }}>
                Notices
              </Text>

              {user?.batch?.name ? (
                <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                  Batch: {user.batch.name}
                </Text>
              ) : (
                <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
                  Campus-wide updates and announcements
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel="Open account menu"
              className="w-10 h-10 rounded-lg items-center justify-center"
              style={{
                backgroundColor: COLORS.surfaceLow,
                borderWidth: 1,
                borderColor: COLORS.outline,
              }}
            >
              <Feather name="more-vertical" size={18} color={COLORS.onSurface} />
            </TouchableOpacity>
          </View>

          {hasPendingNotices ? (
            <View
              className="mt-3 rounded-lg px-3 py-2 flex-row items-center"
              style={{ backgroundColor: COLORS.warningSoft, borderWidth: 1, borderColor: "#E4C580" }}
            >
              <Ionicons name="time-outline" size={14} color={COLORS.warning} />
              <Text className="text-sm font-semibold ml-1.5" style={{ color: COLORS.warning }}>
                {pendingNotices.length} pending for review
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="px-4 pb-3">
        <View
          className="rounded-xl p-3 flex-row items-center justify-end"
          style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}
        >
          <View className="flex-row justify-end">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <FilterTrigger
                icon="filter"
                label="View"
                value={selectedViewLabel}
                onPress={() => setPickerSheet("view")}
              />

              <FilterTrigger
                icon="sliders"
                label="Sort"
                value={selectedSortLabel}
                onPress={() => setPickerSheet("sort")}
              />

              <FilterTrigger
                icon="tag"
                label="Tags"
                value={getTagLabel(tagFilter)}
                onPress={() => setPickerSheet("tag")}
              />
            </ScrollView>
          </View>

          {!isDefaultControlState ? (
            <TouchableOpacity
              onPress={resetControls}
              activeOpacity={0.86}
              className="self-start mt-2.5 px-3 py-1.5 rounded-lg flex-row items-center"
              style={{
                backgroundColor: COLORS.surfaceLow,
                borderWidth: 1,
                borderColor: COLORS.outline,
              }}
            >
              <Feather name="rotate-ccw" size={13} color={COLORS.onSurfaceMuted} />
              <Text className="text-sm font-semibold ml-1.5" style={{ color: COLORS.onSurfaceMuted }}>
                Reset filters
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: canCreateNotice ? fabBottomOffset + 72 : insets.bottom + 24,
          paddingTop: 0,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredNotices.length === 0 ? (
          <View
            className="items-center py-12 rounded-xl"
            style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}
          >
            <View
              className="w-14 h-14 rounded-full items-center justify-center"
              style={{ backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: "#9FC1FF" }}
            >
              <Ionicons name="megaphone-outline" size={24} color={COLORS.primary} />
            </View>

            <Text className="text-lg font-bold mt-3" style={{ color: COLORS.onSurface }}>
              No notices found
            </Text>

            <Text className="text-base mt-1 px-6 text-center" style={{ color: COLORS.onSurfaceMuted }}>
              {showPending
                ? "No pending notices to review right now."
                : "Check back soon for new updates."}
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

      {canCreateNotice ? (
        <TouchableOpacity
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Create notice"
          style={{
            position: "absolute",
            right: 16,
            bottom: fabBottomOffset,
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.primary,
            borderWidth: 1,
            borderColor: COLORS.primary,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 7,
          }}
        >
          <Feather name="plus" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          className="flex-1"
          style={{ backgroundColor: "rgba(0,0,0,0.12)" }}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              position: "absolute",
              top: insets.top + 68,
              right: 16,
              width: 224,
              borderRadius: 12,
              padding: 8,
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            <TouchableOpacity
              onPress={handleOpenAccountSettings}
              activeOpacity={0.85}
              className="min-h-[50px] px-3.5 rounded-lg flex-row items-center"
              style={{
                backgroundColor: COLORS.surfaceLow,
                borderWidth: 1,
                borderColor: "#D4D6E2",
              }}
            >
              <View
                className="w-8 h-8 rounded-lg items-center justify-center"
                style={{
                  backgroundColor: COLORS.surface,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                }}
              >
                <Feather name="settings" size={17} color={COLORS.onSurface} />
              </View>
              <Text className="text-base font-semibold ml-3" style={{ color: COLORS.onSurface }}>
                Account Settings
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.85}
              className="min-h-[50px] px-3.5 rounded-lg flex-row items-center mt-2"
              style={{
                backgroundColor: "#FFF2F1",
                borderWidth: 1,
                borderColor: "#E8C6C4",
              }}
            >
              <View
                className="w-8 h-8 rounded-lg items-center justify-center"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E8C6C4",
                }}
              >
                <Feather name="log-out" size={17} color="#B6403C" />
              </View>
              <Text className="text-base font-semibold ml-3" style={{ color: "#B6403C" }}>
                Logout
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={pickerSheet !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerSheet(null)}
      >
        <Pressable
          className="flex-1"
          style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
          onPress={() => setPickerSheet(null)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: insets.bottom + 12,
              borderRadius: 12,
              padding: 12,
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-bold" style={{ color: COLORS.onSurface }}>
                {pickerTitle}
              </Text>
              <TouchableOpacity
                onPress={() => setPickerSheet(null)}
                className="w-7 h-7 rounded-md items-center justify-center"
                style={{ backgroundColor: COLORS.surfaceLow, borderWidth: 1, borderColor: COLORS.outline }}
              >
                <Feather name="x" size={14} color={COLORS.onSurfaceMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 280 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {pickerOptions.map((option) => {
                const warningActive = option.active && option.tone === "warning";
                const isActive = option.active;

                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => {
                      option.onSelect();
                      setPickerSheet(null);
                    }}
                    activeOpacity={0.86}
                    className="min-h-[44px] rounded-lg px-3.5 py-2.5 flex-row items-center justify-between"
                    style={{
                      backgroundColor: isActive
                        ? warningActive
                          ? COLORS.warningSoft
                          : COLORS.primarySoft
                        : COLORS.surfaceLow,
                      borderWidth: 1,
                      borderColor: isActive
                        ? warningActive
                          ? "#E4C580"
                          : COLORS.primary
                        : COLORS.outline,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color: isActive
                          ? warningActive
                            ? COLORS.warning
                            : COLORS.primary
                          : COLORS.onSurface,
                      }}
                    >
                      {option.label}
                    </Text>

                    {isActive ? (
                      <Feather
                        name="check"
                        size={14}
                        color={warningActive ? COLORS.warning : COLORS.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={accountSettingsVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAccountSettingsModal}
      >
        <View
          className="flex-1 items-center justify-center px-5"
          style={{ backgroundColor: "rgba(0,0,0,0.28)" }}
        >
          <View
            className="w-full rounded-xl p-4"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
              maxWidth: 420,
            }}
          >
            <Text className="text-xl font-extrabold" style={{ color: COLORS.onSurface }}>
              Account Settings
            </Text>
            <Text className="text-sm mt-1" style={{ color: COLORS.onSurfaceMuted }}>
              Change your password
            </Text>

            <View className="mt-4">
              <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurface }}>
                New Password
              </Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                editable={!isSavingPassword}
                placeholder="Enter new password"
                placeholderTextColor={COLORS.onSurfaceMuted}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                  backgroundColor: COLORS.surfaceLow,
                  color: COLORS.onSurface,
                  fontSize: 15,
                  fontWeight: "500",
                }}
              />
            </View>

            <View className="mt-3">
              <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurface }}>
                Confirm Password
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!isSavingPassword}
                placeholder="Re-enter new password"
                placeholderTextColor={COLORS.onSurfaceMuted}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                  backgroundColor: COLORS.surfaceLow,
                  color: COLORS.onSurface,
                  fontSize: 15,
                  fontWeight: "500",
                }}
              />
            </View>

            <View className="flex-row mt-5" style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={closeAccountSettingsModal}
                disabled={isSavingPassword}
                activeOpacity={0.86}
                className="flex-1 min-h-[40px] rounded-lg items-center justify-center"
                style={{
                  backgroundColor: COLORS.surfaceLow,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                }}
              >
                <Text className="text-sm font-bold" style={{ color: COLORS.onSurfaceMuted }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={isSavingPassword}
                activeOpacity={0.86}
                className="flex-1 min-h-[40px] rounded-lg items-center justify-center"
                style={{
                  backgroundColor: COLORS.primary,
                  borderWidth: 1,
                  borderColor: COLORS.primary,
                }}
              >
                {isSavingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold" style={{ color: "#FFFFFF" }}>
                    Save Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
