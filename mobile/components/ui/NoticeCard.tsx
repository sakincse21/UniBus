import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { INotice } from "@/interfaces";

interface NoticeCardProps {
  notice: INotice;
  onPress?: () => void;
}

export default function NoticeCard({ notice, onPress }: NoticeCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
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
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm active:bg-gray-50"
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start gap-2 mb-2">
        <Text
          className="text-base font-bold text-gray-900 flex-1"
          numberOfLines={2}
        >
          {notice.title}
        </Text>
        <View
          className={`${getStatusColor()} px-2 py-1 rounded-full flex-shrink-0`}
        >
          <Text className="text-xs font-medium capitalize">
            {notice.status}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-2 mb-3">
        <View className="bg-blue-50 px-2.5 py-1 rounded-full">
          <Text className="text-xs text-blue-600 font-medium">
            {getTargetLabel()}
          </Text>
        </View>
      </View>

      <Text className="text-gray-700 text-sm mb-3 leading-5" numberOfLines={3}>
        {notice.content}
      </Text>

      <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
        <View className="flex-1">
          <Text className="text-xs text-gray-500">
            {formatDate(notice.createdAt)}
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            By: {notice.createdBy?.name || "Unknown"}
          </Text>
        </View>
        <Text className="text-blue-600 text-xs font-medium">Details →</Text>
      </View>
    </TouchableOpacity>
  );
}
