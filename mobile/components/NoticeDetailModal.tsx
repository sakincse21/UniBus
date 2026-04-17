import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INotice } from "@/interfaces";
import { noticeAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { toggleNoticeInCalendar, checkNoticeSyncState } from "@/lib/calendar";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import config from "@/lib/config";
import storage from "@/lib/storage";
import {
  formatBangladeshDate,
  formatBangladeshDateTime,
} from "@/lib/dateFormatter";
import { APP_THEME_COLORS } from "@/lib/theme";

interface NoticeDetailModalProps {
  visible: boolean;
  notice: INotice | null;
  onClose: () => void;
  onDelete?: (noticeId: number) => void;
  onApprove?: (noticeId: number) => void;
}

interface Attachment {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

const COLORS = APP_THEME_COLORS;

function getStatusMeta(status: INotice["status"]): {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        icon: "checkmark-circle-outline",
        color: COLORS.success,
        bg: COLORS.successSoft,
        border: "#A7D8BF",
      };
    case "pending":
      return {
        label: "Pending",
        icon: "time-outline",
        color: COLORS.warning,
        bg: COLORS.warningSoft,
        border: "#E4C580",
      };
    case "rejected":
      return {
        label: "Rejected",
        icon: "close-circle-outline",
        color: COLORS.danger,
        bg: COLORS.dangerSoft,
        border: "#F6CACA",
      };
    default:
      return {
        label: "Unknown",
        icon: "help-circle-outline",
        color: COLORS.onSurfaceMuted,
        bg: COLORS.surfaceLow,
        border: "#D6D8DD",
      };
  }
}

function getTagMeta(tag: INotice["tag"]): {
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (tag) {
    case "academic":
      return { label: "Academic", color: "#5C3D99", bg: "#F2ECFF", border: "#CEB8FF" };
    case "exam":
      return { label: "Exam", color: "#9A5800", bg: "#FFF4DA", border: "#E4C580" };
    case "event":
      return { label: "Event", color: "#0053DC", bg: "#EEF4FF", border: "#9FC1FF" };
    case "transport":
      return { label: "Transport", color: "#0D7A43", bg: "#EDF8F1", border: "#A7D8BF" };
    case "urgent":
      return { label: "Urgent", color: "#B6403C", bg: "#FDECEC", border: "#F6CACA" };
    case "general":
    default:
      return { label: "General", color: "#2F323A", bg: "#F3F3FA", border: "#D6D8DD" };
  }
}

export default function NoticeDetailModal({
  visible,
  notice,
  onClose,
  onDelete,
  onApprove,
}: NoticeDetailModalProps) {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (visible && notice) {
      loadAttachments();
      checkNoticeSyncState(notice.id).then(setIsSynced);
      return;
    }

    setAttachments([]);
    setIsSynced(false);
  }, [visible, notice?.id]);

  const loadAttachments = async () => {
    if (!notice) return;

    setIsLoadingAttachments(true);
    try {
      const response = await noticeAPI.getAttachments(notice.id);
      if (response.data.success) {
        setAttachments(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to load attachments:", error);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const handleAddToCalendar = async () => {
    if (!notice || !notice.eventDate) {
      Alert.alert("No Date", "This notice does not have an event date set.");
      return;
    }

    setIsAddingToCalendar(true);
    try {
      const nextState = await toggleNoticeInCalendar(notice);
      setIsSynced(nextState);
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      setDownloadingAttachmentId(attachment.id);

      const token = await storage.getToken();
      if (!token) {
        Alert.alert("Error", "You must be logged in to download attachments.");
        return;
      }

      const downloadUrl = `${config.API_BASE_URL}/attachment/download/${attachment.id}`;
      const safeFileName = attachment.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const localUri = `${FileSystem.documentDirectory}${safeFileName}`;

      const fileInfo = await FileSystem.getInfoAsync(localUri);
      let uriToShare = localUri;

      if (!fileInfo.exists) {
        Alert.alert("Downloading", "Please wait while the file downloads.");
        const { uri } = await FileSystem.downloadAsync(downloadUrl, localUri, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        uriToShare = uri;
      }

      if (Platform.OS === "android") {
        try {
          const contentUri = await FileSystem.getContentUriAsync(uriToShare);
          await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
            data: contentUri,
            flags: 1,
            type: attachment.fileType || "application/octet-stream",
          });
        } catch {
          Alert.alert("No App Found", "No application found to open this file type.");
        }
      } else {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(uriToShare, {
            dialogTitle: attachment.fileName,
            mimeType: attachment.fileType || "application/octet-stream",
          });
        } else {
          Alert.alert("Success", `File available at ${uriToShare}`);
        }
      }
    } catch (error) {
      console.error("Download Error:", error);
      Alert.alert("Error", "Failed to download attachment.");
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const canDeleteNotice = () => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.role === "teacher") return true;
    if (user.role === "cr") return true;
    if (user.role === "student" && notice?.createdBy?.user_id === user.user_id) {
      return true;
    }
    return false;
  };

  const canApproveNotice = () => {
    if (!notice || notice.status !== "pending") return false;
    return (
      user?.role === "admin" || user?.role === "teacher" || user?.role === "cr"
    );
  };

  const handleDeleteNotice = () => {
    if (!notice) return;

    Alert.alert("Delete Notice", "Are you sure you want to delete this notice?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await noticeAPI.deleteNotice(notice.id);
            onDelete?.(notice.id);
            onClose();
          } catch {
            Alert.alert("Error", "Failed to delete notice.");
          }
        },
      },
    ]);
  };

  const handleApproveNotice = () => {
    if (!notice) return;

    Alert.alert("Approve Notice", "Are you sure you want to approve this notice?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          setIsProcessing(true);
          try {
            await noticeAPI.approveNotice(notice.id);
            Alert.alert("Success", "Notice approved.");
            onApprove?.(notice.id);
            onClose();
          } catch (error: any) {
            Alert.alert(
              "Error",
              error.response?.data?.message || "Failed to approve.",
            );
          } finally {
            setIsProcessing(false);
          }
        },
      },
    ]);
  };

  const handleRejectNotice = () => {
    if (!notice) return;

    Alert.alert("Reject Notice", "Are you sure you want to reject this notice?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          setIsProcessing(true);
          try {
            await noticeAPI.rejectNotice(notice.id);
            Alert.alert("Success", "Notice rejected.");
            onClose();
          } catch (error: any) {
            Alert.alert(
              "Error",
              error.response?.data?.message || "Failed to reject.",
            );
          } finally {
            setIsProcessing(false);
          }
        },
      },
    ]);
  };

  const getTargetLabel = () => {
    if (!notice) return "General";
    if (notice.forAll) return "Everyone";
    if (notice.forTeachers) return "Teachers";
    if (notice.targetBatch?.name) return `Batch ${notice.targetBatch.name}`;
    return "General";
  };

  if (!notice) return null;

  const status = getStatusMeta(notice.status);
  const tag = getTagMeta(notice.tag);
  const hasEventDate = !!notice.eventDate && notice.eventDate.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: COLORS.background }}>
        <View
          style={{
            paddingTop: insets.top,
            paddingHorizontal: 16,
            paddingBottom: 10,
          }}
        >
          <View
            className="rounded-xl px-4 py-3"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.86}
                className="flex-row items-center"
              >
                <Feather name="chevron-left" size={17} color={COLORS.primary} />
                <Text className="text-base font-semibold ml-1" style={{ color: COLORS.primary }}>
                  Back
                </Text>
              </TouchableOpacity>

              <Text className="text-lg font-bold" style={{ color: COLORS.onSurface }}>
                Notice Details
              </Text>

              {canDeleteNotice() ? (
                <TouchableOpacity
                  onPress={handleDeleteNotice}
                  activeOpacity={0.86}
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{
                    backgroundColor: COLORS.dangerSoft,
                    borderWidth: 1,
                    borderColor: "#F6CACA",
                  }}
                >
                  <Feather name="trash-2" size={14} color={COLORS.danger} />
                </TouchableOpacity>
              ) : (
                <View className="w-8 h-8" />
              )}
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        >
          <View
            className="rounded-xl px-3.5 py-3.5 mb-2.5"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <Text className="text-3xl font-extrabold" style={{ color: COLORS.onSurface }}>
              {notice.title}
            </Text>

            <View className="flex-row flex-wrap gap-2 mt-3">
              <View
                className="px-2.5 py-1 rounded-md flex-row items-center"
                style={{
                  backgroundColor: status.bg,
                  borderWidth: 1,
                  borderColor: status.border,
                }}
              >
                <Ionicons name={status.icon} size={13} color={status.color} />
                <Text className="text-sm font-semibold ml-1" style={{ color: status.color }}>
                  {status.label}
                </Text>
              </View>

              <View
                className="px-2.5 py-1 rounded-md flex-row items-center"
                style={{
                  backgroundColor: COLORS.primarySoft,
                  borderWidth: 1,
                  borderColor: "#9FC1FF",
                }}
              >
                <Feather name="users" size={12} color={COLORS.primary} />
                <Text className="text-sm font-semibold ml-1" style={{ color: COLORS.primary }}>
                  {getTargetLabel()}
                </Text>
              </View>
            </View>

            <View className="mt-2">
              <View
                className="self-start px-2.5 py-1 rounded-md flex-row items-center"
                style={{
                  backgroundColor: tag.bg,
                  borderWidth: 1,
                  borderColor: tag.border,
                }}
              >
                <Ionicons name="pricetag-outline" size={12} color={tag.color} />
                <Text className="text-sm font-semibold ml-1" style={{ color: tag.color }}>
                  {tag.label}
                </Text>
              </View>
            </View>

            <View
              className="mt-3 pt-3"
              style={{ borderTopWidth: 1, borderTopColor: "#E4E5EC" }}
            >
              <View className="flex-row justify-between mb-2.5">
                <Text className="text-base" style={{ color: COLORS.onSurfaceMuted }}>
                  Posted
                </Text>
                <Text className="text-base font-semibold" style={{ color: COLORS.onSurface }}>
                  {formatBangladeshDateTime(notice.createdAt)}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-base" style={{ color: COLORS.onSurfaceMuted }}>
                  Author
                </Text>
                <Text className="text-base font-semibold" style={{ color: COLORS.onSurface }}>
                  {notice.createdBy?.name || "Unknown"}
                </Text>
              </View>
            </View>
          </View>

          {hasEventDate ? (
            <View
              className="rounded-xl px-3.5 py-3.5 mb-2.5"
              style={{
                backgroundColor: COLORS.primarySoft,
                borderWidth: 1,
                borderColor: "#9FC1FF",
              }}
            >
              <View className="flex-row items-center justify-between mb-2.5">
                <View className="flex-row items-center">
                  <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                  <Text className="text-base font-bold ml-1.5" style={{ color: COLORS.primary }}>
                    Schedule
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleAddToCalendar}
                  disabled={isAddingToCalendar}
                  activeOpacity={0.86}
                  className="min-h-[34px] px-3 rounded-lg flex-row items-center justify-center"
                  style={{
                    backgroundColor: isSynced ? COLORS.surface : COLORS.primary,
                    borderWidth: 1,
                    borderColor: isSynced ? "#A7D8BF" : COLORS.primary,
                  }}
                >
                  {isAddingToCalendar ? (
                    <ActivityIndicator
                      size="small"
                      color={isSynced ? COLORS.success : "#FFFFFF"}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={isSynced ? "checkmark-circle" : "calendar-number-outline"}
                        size={14}
                        color={isSynced ? COLORS.success : "#FFFFFF"}
                      />
                      <Text
                        className="text-sm font-bold ml-1.5"
                        style={{ color: isSynced ? COLORS.success : "#FFFFFF" }}
                      >
                        {isSynced ? "Synced" : "Add"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-base" style={{ color: COLORS.onSurfaceMuted }}>
                    Date
                  </Text>
                  <Text className="text-base font-semibold" style={{ color: COLORS.onSurface }}>
                    {notice.eventDate ? formatBangladeshDate(notice.eventDate) : "-"}
                  </Text>
                </View>

                {notice.startTime || notice.endTime ? (
                  <View className="flex-row justify-between">
                    <Text className="text-base" style={{ color: COLORS.onSurfaceMuted }}>
                      Time
                    </Text>
                    <Text className="text-base font-semibold" style={{ color: COLORS.onSurface }}>
                      {notice.startTime || "--:--"} - {notice.endTime || "--:--"}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <View
            className="rounded-xl px-3.5 py-3.5 mb-2.5"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <Text className="text-base font-bold mb-1.5" style={{ color: COLORS.onSurface }}>
              Message
            </Text>
            <Text className="text-lg leading-7" style={{ color: COLORS.onSurface }}>
              {notice.content}
            </Text>
          </View>

          {isLoadingAttachments ? (
            <View
              className="rounded-xl px-4 py-4 mb-2.5 items-center"
              style={{
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.outline,
              }}
            >
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text className="text-base mt-2" style={{ color: COLORS.onSurfaceMuted }}>
                Loading attachments...
              </Text>
            </View>
          ) : attachments.length > 0 ? (
            <View
              className="rounded-xl px-3.5 py-3.5 mb-2.5"
              style={{
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.outline,
              }}
            >
              <Text className="text-base font-bold mb-2.5" style={{ color: COLORS.onSurface }}>
                Attachments ({attachments.length})
              </Text>

              <View className="gap-2.5">
                {attachments.map((attachment) => (
                  <TouchableOpacity
                    key={attachment.id}
                    onPress={() => handleDownloadAttachment(attachment)}
                    disabled={downloadingAttachmentId === attachment.id}
                    activeOpacity={0.86}
                    className="rounded-lg px-2.5 py-2 flex-row items-center"
                    style={{
                      backgroundColor: COLORS.surfaceLow,
                      borderWidth: 1,
                      borderColor: "#D6D8DD",
                    }}
                  >
                    <View
                      className="w-8 h-8 rounded-lg items-center justify-center mr-2.5"
                      style={{
                        backgroundColor: COLORS.primarySoft,
                        borderWidth: 1,
                        borderColor: "#9FC1FF",
                      }}
                    >
                      <Feather name="paperclip" size={14} color={COLORS.primary} />
                    </View>

                    <View className="flex-1 pr-3">
                      <Text
                        className="text-base font-semibold"
                        style={{ color: COLORS.onSurface }}
                        numberOfLines={1}
                      >
                        {attachment.fileName}
                      </Text>
                      <Text className="text-sm mt-0.5" style={{ color: COLORS.onSurfaceMuted }}>
                        {attachment.createdAt
                          ? formatBangladeshDate(attachment.createdAt)
                          : ""}
                      </Text>
                    </View>

                    <View
                      className="w-8 h-8 rounded-lg items-center justify-center"
                      style={{
                        backgroundColor: COLORS.surface,
                        borderWidth: 1,
                        borderColor: COLORS.outline,
                      }}
                    >
                      {downloadingAttachmentId === attachment.id ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <Feather name="download" size={14} color={COLORS.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {canApproveNotice() ? (
            <View
              className="rounded-xl px-3.5 py-3.5"
              style={{
                backgroundColor: COLORS.warningSoft,
                borderWidth: 1,
                borderColor: "#E4C580",
              }}
            >
              <View className="flex-row items-center mb-3">
                <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.warning} />
                <Text className="text-base font-bold ml-1.5" style={{ color: COLORS.warning }}>
                  Pending Approval
                </Text>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleRejectNotice}
                  disabled={isProcessing}
                  activeOpacity={0.86}
                  className="flex-1 min-h-[38px] rounded-lg flex-row items-center justify-center"
                  style={{
                    backgroundColor: COLORS.dangerSoft,
                    borderWidth: 1,
                    borderColor: "#F6CACA",
                  }}
                >
                  <Feather name="x" size={14} color={COLORS.danger} />
                  <Text className="text-base font-bold ml-1.5" style={{ color: COLORS.danger }}>
                    Reject
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleApproveNotice}
                  disabled={isProcessing}
                  activeOpacity={0.86}
                  className="flex-1 min-h-[38px] rounded-lg flex-row items-center justify-center"
                  style={{
                    backgroundColor: COLORS.success,
                    borderWidth: 1,
                    borderColor: COLORS.success,
                  }}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check" size={14} color="#FFFFFF" />
                      <Text className="text-base font-bold text-white ml-1.5">Approve</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
