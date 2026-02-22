import React from "react";
import { View, Text } from "react-native";
import { INotice } from "@/interfaces";

interface NoticeCardProps {
  notice: INotice;
}

export default function NoticeCard({ notice }: NoticeCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
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
        return "bg-green-100 text-green-600";
      case "pending":
        return "bg-yellow-100 text-yellow-600";
      case "rejected":
        return "bg-red-100 text-red-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-start mb-2">
        <Text
          className="text-lg font-bold text-gray-900 flex-1"
          numberOfLines={2}
        >
          {notice.title}
        </Text>
        <View className={`${getStatusColor()} px-2 py-1 rounded-full ml-2`}>
          <Text className="text-xs font-medium capitalize">
            {notice.status}
          </Text>
        </View>
      </View>

      <View className="bg-blue-50 px-2 py-1 rounded-full mb-2 self-start">
        <Text className="text-xs text-blue-600 font-medium">
          {getTargetLabel()}
        </Text>
      </View>

      <Text className="text-gray-900 mb-3 leading-5" numberOfLines={4}>
        {notice.content}
      </Text>

      <View className="flex-row justify-between items-center">
        <Text className="text-xs text-gray-500">
          {formatDate(notice.createdAt)}
        </Text>
        <Text className="text-xs text-gray-500">
          By: {notice.createdBy?.name || "Unknown"}
        </Text>
      </View>
    </View>
  );
}
