import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ICalendarEvent } from "@/interfaces";
import { formatBangladeshTime } from "@/lib/dateFormatter";

interface EventCardProps {
  event: ICalendarEvent;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onDelete,
  isDeleting,
}) => {
  const getEventColor = (type: string) => {
    switch (type) {
      case "notice":
        return "bg-blue-100 border-l-4 border-blue-600";
      case "routine":
        return "bg-purple-100 border-l-4 border-purple-600";
      case "personal":
        return "bg-green-100 border-l-4 border-green-600";
      default:
        return "bg-gray-100 border-l-4 border-gray-500";
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "notice":
        return "📋";
      case "routine":
        return "📅";
      case "personal":
        return "⭐";
      default:
        return "📌";
    }
  };

  const getTimeString = () => {
    if (event.isAllDay) {
      return "All Day";
    }
    try {
      return formatBangladeshTime(event.startDateTime);
    } catch {
      return "";
    }
  };

  const shouldShowDelete =
    event.type === "personal" || event.metadata?.canDelete;

  const getMetadataDisplay = () => {
    const parts: string[] = [];

    if (event.metadata?.forAll) parts.push("For All");
    if (event.metadata?.forTeachers) parts.push("For Teachers");
    if (event.metadata?.batchName)
      parts.push(`Batch ${event.metadata.batchName}`);

    return parts.join(" • ");
  };

  return (
    <View className={`p-3 rounded-lg mb-2 ${getEventColor(event.type)}`}>
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-base">{getEventTypeIcon(event.type)}</Text>
            <Text className="font-semibold text-sm text-gray-900 flex-1">
              {event.title}
            </Text>
          </View>

          {event.description && (
            <Text className="text-xs text-gray-600 mt-1.5 px-6">
              {event.description}
            </Text>
          )}

          <View className="mt-2 px-6 space-y-1">
            <Text className="text-xs text-gray-700 font-medium">
              Time: {getTimeString()}
            </Text>

            {getMetadataDisplay() && (
              <Text className="text-xs text-gray-600 font-medium">
                Audience: {getMetadataDisplay()}
              </Text>
            )}

            {event.metadata?.createdBy && (
              <Text className="text-xs text-gray-500">
                Created by: {event.metadata.createdBy}
              </Text>
            )}

            {event.metadata?.confidence !== undefined && (
              <Text
                className={`text-xs font-medium ${
                  event.metadata.confidence >= 0.8
                    ? "text-green-600"
                    : event.metadata.confidence >= 0.5
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                Confidence: {Math.round(event.metadata.confidence * 100)}%
              </Text>
            )}

            {event.metadata?.note && (
              <Text className="text-xs text-gray-600 italic">
                Note: {event.metadata.note}
              </Text>
            )}
          </View>
        </View>

        {shouldShowDelete && onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            disabled={isDeleting}
            className="ml-2 p-1"
          >
            <Text className="text-lg text-red-500 font-bold">
              {isDeleting ? "..." : "✕"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default EventCard;
