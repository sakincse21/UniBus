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

interface NoticeDetailModalProps {
  visible: boolean;
  notice: INotice | null;
  onClose: () => void;
  onDelete?: (noticeId: number) => void;
}

interface Attachment {
  id: number;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

export default function NoticeDetailModal({
  visible,
  notice,
  onClose,
  onDelete,
}: NoticeDetailModalProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

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

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      Share.share({
        title: attachment.fileName,
        message: `Downloading: ${attachment.fileName}`,
        url: attachment.fileUrl,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to download attachment");
    }
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

  if (!notice) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTargetLabel = () => {
    if (notice.forAll) return "For All";
    if (notice.forTeachers) return "For Teachers";
    if (notice.targetBatch?.name) return `Batch ${notice.targetBatch.name}`;
    return "General";
  };

  const getStatusColor = () => {
    switch (notice.status) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row justify-between items-center px-4 py-4 border-b border-gray-200">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-blue-600 text-base font-semibold">
              ← Back
            </Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">
            Notice Details
          </Text>
          <TouchableOpacity onPress={handleDeleteNotice}>
            <Text className="text-red-600 text-base font-semibold">Delete</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Title */}
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            {notice.title}
          </Text>

          {/* Meta Info */}
          <View className="flex-row gap-2 mb-4">
            <View className={`${getStatusColor()} px-3 py-1 rounded-full`}>
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
          <View className="bg-gray-50 rounded-lg p-3 mb-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600 text-sm">Posted on</Text>
              <Text className="text-gray-900 font-medium text-sm">
                {formatDate(notice.createdAt)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-600 text-sm">Posted by</Text>
              <Text className="text-gray-900 font-medium text-sm">
                {notice.createdBy?.name || "Unknown"}
              </Text>
            </View>
          </View>

          {/* Event Date and Time - if present */}
          {(notice.eventDate || notice.startTime || notice.endTime) && (
            <View className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
              <Text className="text-blue-900 font-semibold text-sm mb-2">
                📅 Event Schedule
              </Text>
              {notice.eventDate && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-blue-700 text-sm">Date</Text>
                  <Text className="text-blue-900 font-medium text-sm">
                    {new Date(notice.eventDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              )}
              {(notice.startTime || notice.endTime) && (
                <View className="flex-row justify-between">
                  <Text className="text-blue-700 text-sm">Time</Text>
                  <Text className="text-blue-900 font-medium text-sm">
                    {notice.startTime || "—"} to {notice.endTime || "—"}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Content */}
          <View className="mb-6">
            <Text className="text-gray-900 text-base leading-6">
              {notice.content}
            </Text>
          </View>

          {/* Attachments */}
          {isLoadingAttachments ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : attachments.length > 0 ? (
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-900 mb-3">
                📎 Attachments ({attachments.length})
              </Text>
              <View className="border border-gray-200 rounded-lg overflow-hidden">
                {attachments.map((attachment, index) => (
                  <TouchableOpacity
                    key={attachment.id}
                    className={`flex-row items-center justify-between p-3 ${
                      index !== attachments.length - 1
                        ? "border-b border-gray-200"
                        : ""
                    }`}
                    onPress={() => handleDownloadAttachment(attachment)}
                  >
                    <View className="flex-1">
                      <Text className="text-blue-600 font-medium">
                        {attachment.fileName}
                      </Text>
                      <Text className="text-xs text-gray-500 mt-1">
                        {new Date(attachment.uploadedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text className="text-blue-600 text-lg">↓</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-xs text-gray-500 mt-2">
                Tap to download attachment
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
