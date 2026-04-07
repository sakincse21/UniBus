import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ICalendarEvent } from "@/interfaces";

interface EventCardProps {
  event: ICalendarEvent;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onDelete, isDeleting }) => {
  const getEventColor = (type: string) => {
    switch (type) {
      case "notice":
        return "bg-blue-100 border-l-4 border-blue-500";
      case "routine":
        return "bg-purple-100 border-l-4 border-purple-500";
      case "personal":
        return "bg-green-100 border-l-4 border-green-500";
      default:
        return "bg-gray-100 border-l-4 border-gray-500";
    }
  };

  const getTimeString = () => {
    if (event.isAllDay) {
      return "All Day";
    }
    try {
      const start = new Date(event.startDateTime);
      const time = start.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return time;
    } catch {
      return "";
    }
  };

  const shouldShowDelete = event.type === "personal" || event.metadata?.canDelete;

  return (
    <View className={`p-3 rounded-md mb-2 ${getEventColor(event.type)}`}>
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="font-semibold text-sm">{event.title}</Text>
          {event.description && (
            <Text className="text-xs text-gray-600 mt-1">{event.description}</Text>
          )}
          {!event.isAllDay && (
            <Text className="text-xs text-gray-500 mt-1">{getTimeString()}</Text>
          )}
          {event.metadata?.createdBy && (
            <Text className="text-xs text-gray-500 mt-1">
              by {event.metadata.createdBy}
            </Text>
          )}
          {event.metadata?.note && (
            <Text className="text-xs text-gray-600 mt-1 italic">
              Note: {event.metadata.note}
            </Text>
          )}
        </View>
        {shouldShowDelete && onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            disabled={isDeleting}
            className="ml-2 p-2"
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
