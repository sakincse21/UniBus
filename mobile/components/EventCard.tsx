import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from "react-native";
import { ICalendarEvent } from "@/interfaces";
import { formatBangladeshTime } from "@/lib/dateFormatter";
import { toggleSingleEventInCalendar, checkEventSyncState } from "@/lib/calendar";

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    checkEventSyncState(event.id).then(setIsSynced);
  }, [event.id]);

  const handleSyncToCalendar = async () => {
    setIsSyncing(true);
    const newSyncState = await toggleSingleEventInCalendar(event);
    setIsSynced(newSyncState);
    setIsSyncing(false);
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "notice":
        return "bg-blue-50 border-l-4 border-blue-500";
      case "routine":
        return "bg-purple-50 border-l-4 border-purple-500";
      case "personal":
        return "bg-green-50 border-l-4 border-green-500";
      default:
        return "bg-gray-50 border-l-4 border-gray-400";
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
    if (event.isAllDay) return "All Day";
    try {
      return formatBangladeshTime(event.startDateTime);
    } catch {
      return "";
    }
  };

  const shouldShowDelete = event.type === "personal" || event.metadata?.canDelete;

  const getMetadataDisplay = () => {
    const parts: string[] = [];
    if (event.metadata?.forAll) parts.push("For All");
    if (event.metadata?.forTeachers) parts.push("For Teachers");
    if (event.metadata?.batchName) parts.push(`Batch ${event.metadata.batchName}`);
    return parts.join(" • ");
  };

  return (
    <>
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => setModalVisible(true)}
        className={`rounded-xl mb-3 h-20 flex-row items-center px-4 ${getEventColor(event.type)}`}
      >
        <View className="flex-1 justify-center">
          <View className="flex-row items-center gap-2">
            <Text className="text-base">{getEventTypeIcon(event.type)}</Text>
            <Text className="font-bold text-gray-900 text-base" numberOfLines={1}>
              {event.title}
            </Text>
          </View>
          <Text className="text-xs text-gray-500 font-medium mt-1 ml-6" numberOfLines={1}>
            {getTimeString()}{event.description ? ` • ${event.description}` : ""}
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={handleSyncToCalendar}
            disabled={isSyncing}
            className={`p-2 rounded-full ${isSynced ? 'bg-green-100' : 'bg-white shadow-sm'}`}
            style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={isSynced ? "#16a34a" : "#2563eb"} />
            ) : (
              <Text className="text-sm">{isSynced ? "✅" : "📆"}</Text>
            )}
          </TouchableOpacity>

          {shouldShowDelete && onDelete && (
            <TouchableOpacity onPress={onDelete} disabled={isDeleting} className="p-2">
              <Text className="text-lg text-red-500 font-bold">{isDeleting ? "..." : "✕"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl max-h-[80%]">
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-row items-center gap-2 flex-1">
                <Text className="text-2xl">{getEventTypeIcon(event.type)}</Text>
                <Text className="font-extrabold text-xl text-gray-900 flex-1">{event.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-1 top-0">
                <Text className="text-xl text-gray-400 font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="space-y-4">
                <View>
                  <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Time</Text>
                  <Text className="text-base text-gray-800 font-medium">{getTimeString()}</Text>
                </View>

                {event.description && (
                  <View>
                    <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Description</Text>
                    <Text className="text-sm text-gray-700 leading-relaxed">{event.description}</Text>
                  </View>
                )}

                {getMetadataDisplay() && (
                  <View>
                    <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Audience</Text>
                    <Text className="text-sm text-gray-800 font-medium">{getMetadataDisplay()}</Text>
                  </View>
                )}

                {event.metadata?.note && (
                  <View>
                    <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Note</Text>
                    <Text className="text-sm text-gray-700 italic">{event.metadata.note}</Text>
                  </View>
                )}

                {event.metadata?.createdBy && (
                  <View>
                    <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Created By</Text>
                    <Text className="text-sm text-gray-800 font-medium">{event.metadata.createdBy}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View className="mt-6 border-t border-gray-100 pt-4 flex-row items-center justify-between gap-3">
              <TouchableOpacity
                onPress={handleSyncToCalendar}
                disabled={isSyncing}
                className={`flex-1 py-3 rounded-xl flex-row justify-center items-center gap-2 ${isSynced ? 'bg-green-100' : 'bg-blue-600'}`}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color={isSynced ? "#16a34a" : "#ffffff"} />
                ) : (
                  <>
                    <Text className="text-base">{isSynced ? "✅" : "📆"}</Text>
                    <Text className={`font-bold ${isSynced ? 'text-green-700' : 'text-white'}`}>
                      {isSynced ? "Synced to Calendar" : "Sync to Calendar"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default EventCard;
