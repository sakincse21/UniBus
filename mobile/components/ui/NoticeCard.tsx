import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { INotice } from "@/interfaces";
import {
  formatBangladesh,
  formatBangladeshDate,
} from "@/lib/dateFormatter";
import { APP_THEME_COLORS } from "@/lib/theme";

interface NoticeCardProps {
  notice: INotice;
  onPress?: () => void;
}

const COLORS = APP_THEME_COLORS;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function getStatusMeta(status: INotice["status"]): {
  label: string;
  icon: IconName;
  color: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        icon: "checkmark-circle-outline",
        color: "#0D7A43",
        bg: "#E8F5EE",
        border: "#A7D8BF",
      };
    case "pending":
      return {
        label: "Pending",
        icon: "time-outline",
        color: "#9A5800",
        bg: "#FFF4DA",
        border: "#E4C580",
      };
    case "rejected":
      return {
        label: "Rejected",
        icon: "close-circle-outline",
        color: "#962D2A",
        bg: "#FDECEC",
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

function getAudienceMeta(notice: INotice): {
  label: string;
  icon: IconName;
  accent: string;
  surface: string;
  border: string;
} {
  if (notice.forAll) {
    return {
      label: "Everyone",
      icon: "earth-outline",
      accent: "#0053DC",
      surface: "#EEF4FF",
      border: "#9FC1FF",
    };
  }

  if (notice.forTeachers) {
    return {
      label: "Teachers",
      icon: "people-outline",
      accent: "#5B4A75",
      surface: "#F4F1F9",
      border: "#C9C0DA",
    };
  }

  if (notice.targetBatch?.name) {
    return {
      label: `Batch ${notice.targetBatch.name}`,
      icon: "school-outline",
      accent: "#0D7A43",
      surface: "#EDF8F1",
      border: "#A7D8BF",
    };
  }

  return {
    label: "General",
    icon: "megaphone-outline",
    accent: COLORS.onSurfaceMuted,
    surface: COLORS.surfaceLow,
    border: "#D6D8DD",
  };
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

    return formatBangladesh(date, {
      month: "short",
      day: "numeric",
    });
  };

  const status = getStatusMeta(notice.status);
  const audience = getAudienceMeta(notice);
  const tag = getTagMeta(notice.tag);
  const hasSchedule = !!notice.eventDate;

  const getScheduleText = () => {
    if (!notice.eventDate) return "";

    const dayLabel = formatBangladeshDate(notice.eventDate);
    if (notice.startTime || notice.endTime) {
      return `${dayLabel} • ${notice.startTime || "--:--"} - ${notice.endTime || "--:--"}`;
    }
    return dayLabel;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-xl px-3.5 py-3 mb-2.5"
      activeOpacity={0.86}
      style={{
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.outline,
      }}
    >
      <View className="flex-row items-start">
        <View
          className="w-10 h-10 rounded-lg items-center justify-center mr-3"
          style={{
            backgroundColor: audience.surface,
            borderWidth: 1,
            borderColor: audience.border,
          }}
        >
          <Ionicons name={audience.icon} size={18} color={audience.accent} />
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <Text
              className="text-lg font-bold flex-1 pr-2"
              style={{ color: COLORS.onSurface }}
              numberOfLines={2}
            >
              {notice.title}
            </Text>

            <View className="items-end ml-2">
              <View
                className="px-2 py-0.5 rounded-md flex-row items-center"
                style={{
                  backgroundColor: status.bg,
                  borderWidth: 1,
                  borderColor: status.border,
                }}
              >
                <Ionicons name={status.icon} size={12} color={status.color} />
                <Text className="text-sm font-semibold ml-1" style={{ color: status.color }}>
                  {status.label}
                </Text>
              </View>

              <View
                className="mt-1.5 rounded-md px-2 py-0.5"
                style={{
                  backgroundColor: tag.bg,
                  borderWidth: 1,
                  borderColor: tag.border,
                }}
              >
                <Text className="text-sm font-semibold" style={{ color: tag.color }}>
                  {tag.label}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center mt-1">
            <Feather name="users" size={13} color={COLORS.onSurfaceMuted} />
            <Text
              className="text-base ml-1.5"
              style={{ color: COLORS.onSurfaceMuted }}
              numberOfLines={1}
            >
              {audience.label}
            </Text>
          </View>

          <Text
            className="text-base mt-1.5 leading-6"
            style={{ color: COLORS.onSurfaceMuted }}
            numberOfLines={3}
          >
            {notice.content}
          </Text>

          {hasSchedule ? (
            <View
              className="mt-2 rounded-lg px-2.5 py-1.5 flex-row items-center"
              style={{
                backgroundColor: "#EEF4FF",
                borderWidth: 1,
                borderColor: "#9FC1FF",
              }}
            >
              <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
              <Text
                className="text-sm font-semibold ml-1.5"
                style={{ color: COLORS.primary }}
                numberOfLines={1}
              >
                {getScheduleText()}
              </Text>
            </View>
          ) : null}

          <View
            className="mt-2.5 pt-2 flex-row items-center justify-between"
            style={{ borderTopWidth: 1, borderTopColor: "#E4E5EC" }}
          >
            <View className="flex-row items-center flex-1 pr-3">
              <Feather name="user" size={12} color={COLORS.onSurfaceMuted} />
              <Text
                className="text-sm ml-1.5"
                style={{ color: COLORS.onSurfaceMuted }}
                numberOfLines={1}
              >
                {notice.createdBy?.name || "Unknown"}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Feather name="clock" size={12} color={COLORS.onSurfaceMuted} />
              <Text className="text-sm ml-1.5" style={{ color: COLORS.onSurfaceMuted }}>
                {formatDate(notice.createdAt)}
              </Text>
            </View>

            <View className="flex-row items-center ml-3">
              <Text className="text-sm font-semibold" style={{ color: COLORS.primary }}>
                Open
              </Text>
              <Feather name="chevron-right" size={14} color={COLORS.primary} />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
