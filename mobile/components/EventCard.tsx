import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { ICalendarEvent } from "@/interfaces";
import { formatBangladeshTime } from "@/lib/dateFormatter";
import { toggleSingleEventInCalendar, checkEventSyncState } from "@/lib/calendar";
import { APP_THEME_COLORS } from "@/lib/theme";

interface EventCardProps {
  event: ICalendarEvent;
  onDelete?: () => void;
  isDeleting?: boolean;
}

const COLORS = APP_THEME_COLORS;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type EventMeta = {
  label: string;
  icon: IconName;
  accent: string;
  surface: string;
  border: string;
};

const EVENT_META: Record<string, EventMeta> = {
  notice: {
    label: "Notice",
    icon: "megaphone-outline",
    accent: "#0053DC",
    surface: "#EEF4FF",
    border: "#9FC1FF",
  },
  personal: {
    label: "Personal",
    icon: "person-outline",
    accent: "#0D7A43",
    surface: "#EDF8F1",
    border: "#A7D8BF",
  },
  routine: {
    label: "Routine",
    icon: "calendar-outline",
    accent: "#5B4A75",
    surface: "#F4F1F9",
    border: "#C9C0DA",
  },
  default: {
    label: "Event",
    icon: "bookmark-outline",
    accent: "#6B7280",
    surface: "#F7F7F8",
    border: "#D6D8DD",
  },
};

function getEventMeta(type: string): EventMeta {
  return EVENT_META[type] || EVENT_META.default;
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
    let active = true;

    checkEventSyncState(event.id).then((value) => {
      if (active) {
        setIsSynced(value);
      }
    });

    return () => {
      active = false;
    };
  }, [event.id]);

  const handleSyncToCalendar = async () => {
    setIsSyncing(true);
    try {
      const newSyncState = await toggleSingleEventInCalendar(event);
      setIsSynced(newSyncState);
    } finally {
      setIsSyncing(false);
    }
  };

  const getTimeString = () => {
    if (event.isAllDay) return "All day";
    try {
      return formatBangladeshTime(event.startDateTime);
    } catch {
      return "";
    }
  };

  const shouldShowDelete = event.type === "personal" || event.metadata?.canDelete;
  const meta = getEventMeta(event.type);

  const getMetadataDisplay = () => {
    const parts: string[] = [];
    if (event.metadata?.forAll) parts.push("For all");
    if (event.metadata?.forTeachers) parts.push("For teachers");
    if (event.metadata?.batchName) parts.push(`Batch ${event.metadata.batchName}`);
    return parts.join(" • ");
  };

  const metadataDisplay = getMetadataDisplay();

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => setModalVisible(true)}
        className="rounded-xl mb-3 px-4 py-3.5"
        style={{
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderColor: COLORS.outline,
          borderLeftWidth: 4,
          borderLeftColor: meta.accent,
        }}
      >
        <View className="flex-row items-start">
          <View
            className="w-10 h-10 rounded-lg items-center justify-center mr-3"
            style={{ backgroundColor: meta.surface, borderWidth: 1, borderColor: meta.border }}
          >
            <Ionicons name={meta.icon} size={18} color={meta.accent} />
          </View>

          <View className="flex-1 pr-3">
            <Text className="text-base font-bold" style={{ color: COLORS.onSurface }} numberOfLines={1}>
              {event.title}
            </Text>

            <View className="flex-row items-center gap-1.5 mt-1.5">
              <Feather name="clock" size={12} color={COLORS.onSurfaceMuted} />
              <Text className="text-sm" style={{ color: COLORS.onSurfaceMuted }} numberOfLines={1}>
                {getTimeString()}
              </Text>
            </View>

            {event.description ? (
              <Text
                className="text-sm mt-1"
                style={{ color: COLORS.onSurfaceMuted }}
                numberOfLines={1}
              >
                {event.description}
              </Text>
            ) : null}
          </View>

          <View className="items-end gap-2">
            <TouchableOpacity
              onPress={handleSyncToCalendar}
              disabled={isSyncing}
              activeOpacity={0.8}
              className="w-9 h-9 rounded-lg items-center justify-center"
              style={{
                backgroundColor: isSynced ? COLORS.successSoft : COLORS.primarySoft,
                borderWidth: 1,
                borderColor: isSynced ? "#A7D8BF" : "#9FC1FF",
              }}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={isSynced ? COLORS.success : COLORS.primary} />
              ) : (
                <Ionicons
                  name={isSynced ? "checkmark-circle" : "calendar-outline"}
                  size={17}
                  color={isSynced ? COLORS.success : COLORS.primary}
                />
              )}
            </TouchableOpacity>

            {shouldShowDelete && onDelete ? (
              <TouchableOpacity
                onPress={onDelete}
                disabled={isDeleting}
                activeOpacity={0.8}
                className="w-9 h-9 rounded-lg items-center justify-center"
                style={{ backgroundColor: COLORS.dangerSoft, borderWidth: 1, borderColor: "#F6CACA" }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={COLORS.danger} />
                ) : (
                  <Feather name="trash-2" size={15} color={COLORS.danger} />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: "rgba(12, 15, 25, 0.45)" }}>
          <View
            className="w-full max-w-sm rounded-xl p-5"
            style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}
          >
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                <View
                  className="w-10 h-10 rounded-lg items-center justify-center"
                  style={{ backgroundColor: meta.surface, borderWidth: 1, borderColor: meta.border }}
                >
                  <Ionicons name={meta.icon} size={18} color={meta.accent} />
                </View>

                <View className="flex-1">
                  <Text className="text-lg font-extrabold" style={{ color: COLORS.onSurface }} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <Text className="text-sm mt-0.5" style={{ color: COLORS.onSurfaceMuted }}>
                    {meta.label}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="w-8 h-8 rounded-lg items-center justify-center"
                style={{ backgroundColor: COLORS.surfaceLow, borderWidth: 1, borderColor: COLORS.outline }}
              >
                <Feather name="x" size={16} color={COLORS.onSurfaceMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <View>
                  <Text className="text-xs font-bold mb-1" style={{ color: COLORS.onSurfaceMuted }}>
                    Time
                  </Text>
                  <Text className="text-base font-semibold" style={{ color: COLORS.onSurface }}>
                    {getTimeString()}
                  </Text>
                </View>

                {event.description ? (
                  <View>
                    <Text className="text-xs font-bold mb-1" style={{ color: COLORS.onSurfaceMuted }}>
                      Description
                    </Text>
                    <Text className="text-sm leading-5" style={{ color: COLORS.onSurface }}>
                      {event.description}
                    </Text>
                  </View>
                ) : null}

                {metadataDisplay ? (
                  <View>
                    <Text className="text-xs font-bold mb-1" style={{ color: COLORS.onSurfaceMuted }}>
                      Audience
                    </Text>
                    <Text className="text-sm" style={{ color: COLORS.onSurface }}>
                      {metadataDisplay}
                    </Text>
                  </View>
                ) : null}

                {event.metadata?.note ? (
                  <View>
                    <Text className="text-xs font-bold mb-1" style={{ color: COLORS.onSurfaceMuted }}>
                      Note
                    </Text>
                    <Text className="text-sm leading-5" style={{ color: COLORS.onSurface }}>
                      {event.metadata.note}
                    </Text>
                  </View>
                ) : null}

                {event.metadata?.createdBy ? (
                  <View>
                    <Text className="text-xs font-bold mb-1" style={{ color: COLORS.onSurfaceMuted }}>
                      Created by
                    </Text>
                    <Text className="text-sm" style={{ color: COLORS.onSurface }}>
                      {event.metadata.createdBy}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="flex-1 min-h-[42px] rounded-lg items-center justify-center"
                style={{ backgroundColor: COLORS.surfaceLow, borderWidth: 1, borderColor: COLORS.outline }}
              >
                <Text className="text-sm font-semibold" style={{ color: COLORS.onSurface }}>
                  Close
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSyncToCalendar}
                disabled={isSyncing}
                className="flex-1 min-h-[42px] rounded-lg items-center justify-center flex-row gap-2"
                style={{
                  backgroundColor: isSynced ? COLORS.successSoft : COLORS.primary,
                  borderWidth: 1,
                  borderColor: isSynced ? "#A7D8BF" : COLORS.primary,
                }}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color={isSynced ? COLORS.success : "#FFFFFF"} />
                ) : (
                  <>
                    <Ionicons
                      name={isSynced ? "checkmark-circle" : "calendar-outline"}
                      size={15}
                      color={isSynced ? COLORS.success : "#FFFFFF"}
                    />
                    <Text
                      className="text-sm font-bold"
                      style={{ color: isSynced ? COLORS.success : "#FFFFFF" }}
                    >
                      {isSynced ? "Synced" : "Sync"}
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
