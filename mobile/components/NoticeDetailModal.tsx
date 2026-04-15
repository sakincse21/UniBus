import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { INotice } from "@/interfaces";
import { noticeAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { addNoticeToCalendar } from "@/lib/calendar";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";
import config from "@/lib/config";
import storage from "@/lib/storage";
import {
  formatBangladeshDate,
  formatBangladeshDateTime,
} from "@/lib/dateFormatter";

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

export default function NoticeDetailModal({
  visible,
  notice,
  onClose,
  onDelete,
  onApprove,
}: NoticeDetailModalProps) {
  const { user } = useAuthStore();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);

  useEffect(() => {
    if (visible && notice) {
      loadAttachments();
    }
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
      Alert.alert("No Date", "This notice doesn't have an event date set.");
      return;
    }

    setIsAddingToCalendar(true);
    try {
      const success = await addNoticeToCalendar(
        notice.title,
        notice.content,
        notice.eventDate,
        notice.startTime,
        notice.endTime,
      );

      if (success) {
        Alert.alert(
          "Success",
          "Event added to your calendar with a reminder 15 minutes before.",
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to add to calendar. Please check permissions.",
        );
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      const token = await storage.getToken();
      if (!token) {
        Alert.alert("Error", "You must be logged in to download attachments");
        return;
      }
      
      const downloadUrl = `${config.API_BASE_URL}/attachment/download/${attachment.id}`;
      // Clean up filename to prevent weird paths
      const safeFileName = attachment.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const localUri = FileSystem.documentDirectory + safeFileName;
      
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      let uriToShare = localUri;

      if (!fileInfo.exists) {
        Alert.alert("Downloading", "Please wait while the file downloads...");
        const { uri } = await FileSystem.downloadAsync(
          downloadUrl,
          localUri,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
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
        } catch (e) {
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
      Alert.alert("Error", "Failed to download attachment");
    }
  };

  const canDeleteNotice = () => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.role === "teacher") return true;
    if (user.role === "cr") return true;
    if (user.role === "student" && notice?.createdBy?.user_id === user.user_id)
      return true;
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
    Alert.alert(
      "Delete Notice",
      "Are you sure you want to delete this notice?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await noticeAPI.deleteNotice(notice.id);
              onDelete?.(notice.id);
              onClose();
            } catch (error) {
              Alert.alert("Error", "Failed to delete notice");
            }
          },
        },
      ],
    );
  };

  const handleApproveNotice = () => {
    if (!notice) return;
    Alert.alert(
      "Approve Notice",
      "Are you sure you want to approve this notice?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setIsProcessing(true);
            try {
              await noticeAPI.approveNotice(notice.id);
              Alert.alert("Success", "Notice approved");
              onApprove?.(notice.id);
              onClose();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to approve",
              );
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleRejectNotice = () => {
    if (!notice) return;
    Alert.alert(
      "Reject Notice",
      "Are you sure you want to reject this notice?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setIsProcessing(true);
            try {
              await noticeAPI.rejectNotice(notice.id);
              Alert.alert("Success", "Notice rejected");
              onClose();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to reject",
              );
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  if (!notice) return null;

  const formatDate = (dateString: string) => {
    return formatBangladeshDateTime(dateString);
  };

  const getTargetLabel = () => {
    if (notice.forAll) return "🌍 Everyone";
    if (notice.forTeachers) return "👨‍🏫 Teachers Only";
    if (notice.targetBatch?.name) return `📚 Batch ${notice.targetBatch.name}`;
    return "📌 General";
  };

  const getStatusColor = () => {
    switch (notice.status) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const hasEventDate = notice.eventDate && notice.eventDate.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="flex-row justify-between items-center px-4 py-4 bg-white border-b border-gray-100">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-blue-600 text-base font-semibold">
              ← Back
            </Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">
            Notice Details
          </Text>
          {canDeleteNotice() ? (
            <TouchableOpacity onPress={handleDeleteNotice}>
              <Text className="text-red-600 text-base font-semibold">
                Delete
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="w-12" />
          )}
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4">
            {/* Title */}
            <Text className="text-2xl font-bold text-gray-900 mb-3">
              {notice.title}
            </Text>

            {/* Meta Info */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              <View className={`px-3 py-1 rounded-full ${getStatusColor()}`}>
                <Text className="text-xs font-medium capitalize">
                  {notice.status}
                </Text>
              </View>
              <View className="bg-blue-50 px-3 py-1 rounded-full">
                <Text className="text-xs text-blue-600 font-medium">
                  {getTargetLabel()}
                </Text>
              </View>
            </View>

            {/* Date and Author */}
            <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
              <View className="flex-row justify-between mb-3">
                <Text className="text-gray-500 text-sm">📅 Posted</Text>
                <Text className="text-gray-900 font-medium text-sm">
                  {formatDate(notice.createdAt)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">👤 Posted by</Text>
                <Text className="text-gray-900 font-medium text-sm">
                  {notice.createdBy?.name || "Unknown"}
                </Text>
              </View>
            </View>

            {/* Event Schedule - with Add to Calendar button */}
            {hasEventDate && (
              <View className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
                <Text className="text-blue-800 font-semibold text-sm mb-3">
                  📅 Event Schedule
                </Text>

                <View className="space-y-2 mb-3">
                  <View className="flex-row justify-between">
                    <Text className="text-blue-700 text-sm">Date</Text>
                    <Text className="text-blue-900 font-medium text-sm">
                      {notice.eventDate && formatBangladeshDate(notice.eventDate)}
                    </Text>
                  </View>

                  {(notice.startTime || notice.endTime) && (
                    <View className="flex-row justify-between">
                      <Text className="text-blue-700 text-sm">Time</Text>
                      <Text className="text-blue-900 font-medium text-sm">
                        {notice.startTime || "—"} — {notice.endTime || "—"}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleAddToCalendar}
                  disabled={isAddingToCalendar}
                  className="bg-blue-600 rounded-xl py-2.5 mt-1 flex-row items-center justify-center gap-2"
                >
                  {isAddingToCalendar ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Text className="text-white text-sm font-semibold">
                        📅
                      </Text>
                      <Text className="text-white text-sm font-semibold">
                        Add to Calendar
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Content */}
            <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
              <Text className="text-gray-800 text-base leading-6">
                {notice.content}
              </Text>
            </View>

            {/* Attachments */}
            {isLoadingAttachments ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            ) : attachments.length > 0 ? (
              <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
                <Text className="text-lg font-bold text-gray-900 mb-3">
                  📎 Attachments ({attachments.length})
                </Text>
                <View className="space-y-2">
                  {attachments.map((attachment, index) => (
                    <TouchableOpacity
                      key={attachment.id}
                      className={`flex-row items-center justify-between p-3 rounded-xl ${
                        index !== attachments.length - 1
                          ? "border-b border-gray-100"
                          : ""
                      }`}
                      onPress={() => handleDownloadAttachment(attachment)}
                    >
                      <View className="flex-1">
                        <Text
                          className="text-blue-600 font-medium"
                          numberOfLines={1}
                        >
                          {attachment.fileName}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-0.5">
                          {attachment.createdAt ? formatBangladeshDate(attachment.createdAt) : ""}
                        </Text>
                      </View>
                      <Text className="text-blue-600 text-lg">↓</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text className="text-xs text-gray-400 mt-3 text-center">
                  Tap to share/download
                </Text>
              </View>
            ) : null}

            {/* Approval Actions */}
            {canApproveNotice() && (
              <View className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <Text className="text-amber-800 font-semibold mb-3">
                  Pending Approval
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={handleRejectNotice}
                    disabled={isProcessing}
                    className="flex-1 bg-red-600 rounded-xl py-3 items-center"
                  >
                    <Text className="text-white font-semibold">Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleApproveNotice}
                    disabled={isProcessing}
                    className="flex-1 bg-green-600 rounded-xl py-3 items-center"
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-white font-semibold">Approve</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
