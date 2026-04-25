import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { noticeAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { INoticeTagOption, NoticeTag } from "@/interfaces";
import {
  formatBangladeshDate,
  formatDateForApi,
  parseApiDate,
} from "@/lib/dateFormatter";
import { APP_THEME_COLORS } from "@/lib/theme";

type AudienceType = "all" | "teachers" | "batch" | "myBatch";

interface AttachedFile {
  uri: string;
  name: string;
  size: number;
  type: string;
}

interface CreateNoticeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COLORS = APP_THEME_COLORS;

const DEFAULT_TAG_OPTIONS: INoticeTagOption[] = [
  { value: "general", label: "General" },
  { value: "academic", label: "Academic" },
  { value: "exam", label: "Exam" },
  { value: "event", label: "Event" },
  { value: "transport", label: "Transport" },
  { value: "urgent", label: "Urgent" },
];

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function resolveFileName(uri: string, fallback: string) {
  const fromUri = uri.split("/").pop()?.split("?")[0];
  return (fromUri || fallback).replace(/\s+/g, "_");
}

function resolveMimeType(mimeType: string | null | undefined, fileName: string) {
  const normalized = mimeType?.toLowerCase().trim();

  if (normalized) {
    if (normalized === "image/jpg" || normalized === "image/pjpeg") {
      return "image/jpeg";
    }
    if (normalized === "image/heic-sequence") {
      return "image/heic";
    }
    if (normalized === "image/heif-sequence") {
      return "image/heif";
    }
    return normalized;
  }

  const ext = fileName.toLowerCase().split(".").pop();
  if (ext && EXT_TO_MIME[ext]) {
    return EXT_TO_MIME[ext];
  }

  return "application/octet-stream";
}

function AudienceOption({
  label,
  description,
  active,
  disabled,
  onPress,
}: {
  label: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.86}
      className="rounded-lg px-3 py-3"
      style={{
        backgroundColor: active ? COLORS.primarySoft : COLORS.surface,
        borderWidth: 1,
        borderColor: active ? "#9FC1FF" : COLORS.outline,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View className="flex-row items-start">
        <View
          className="w-5 h-5 rounded-full mr-2.5 mt-0.5 items-center justify-center"
          style={{
            borderWidth: 1.6,
            borderColor: active ? COLORS.primary : COLORS.onSurfaceMuted,
            backgroundColor: active ? COLORS.primary : COLORS.surface,
          }}
        >
          {active ? <View className="w-2 h-2 rounded-full bg-white" /> : null}
        </View>

        <View className="flex-1">
          <Text className="text-sm font-semibold" style={{ color: COLORS.onSurface }}>
            {label}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: COLORS.onSurfaceMuted }}>
            {description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CreateNoticeModal({
  visible,
  onClose,
  onSuccess,
}: CreateNoticeModalProps) {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const isCR = user?.role === "cr";
  const isStudent = user?.role === "student";
  const userBatchId = user?.batch?.id;
  const userBatchName = user?.batch?.name;

  const initialAudience: AudienceType = isCR || isStudent ? "myBatch" : "all";

  const [audience, setAudience] = useState<AudienceType>(initialAudience);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState<NoticeTag>("general");
  const [tagOptions, setTagOptions] = useState<INoticeTagOption[]>(
    DEFAULT_TAG_OPTIONS,
  );
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedBatchName, setSelectedBatchName] = useState<string>("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isStartTimePickerVisible, setIsStartTimePickerVisible] = useState(false);
  const [isEndTimePickerVisible, setIsEndTimePickerVisible] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    content?: string;
    audience?: string;
    batch?: string;
  }>({});

  useEffect(() => {
    if (visible) {
      setAudience(initialAudience);
    }
  }, [visible, initialAudience]);

  useEffect(() => {
    if (!visible) return;

    let active = true;

    noticeAPI
      .getNoticeTags()
      .then((response) => {
        if (!active) return;

        const options = response?.data?.data;
        if (Array.isArray(options) && options.length > 0) {
          setTagOptions(options);
        }
      })
      .catch(() => {
        // Keep fallback options if network request fails.
      });

    return () => {
      active = false;
    };
  }, [visible]);

  const canPostForAll = isAdmin || isTeacher;
  const canPostForTeachers = isAdmin || isTeacher;
  const canPostForSpecificBatch = isAdmin || isTeacher;
  const canPostForMyBatch = isCR || isStudent;

  const willAutoApprove = isAdmin || isTeacher || isCR;
  const isPending = isStudent;

  const isAudienceDisabled = (type: AudienceType): boolean => {
    if (isStudent) return type !== "myBatch";
    if (isCR) return type !== "myBatch";
    if (isAdmin || isTeacher) {
      if (type === "myBatch") return !userBatchId;
      return false;
    }
    return true;
  };

  const pickFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const fileName = resolveFileName(
          asset.uri,
          asset.fileName || `file_${Date.now()}.jpg`,
        );

        const newFile: AttachedFile = {
          uri: asset.uri,
          name: fileName,
          size: asset.fileSize || 0,
          type: resolveMimeType(asset.mimeType, fileName),
        };

        if (newFile.size > 10 * 1024 * 1024) {
          Alert.alert("File too large", "Maximum file size is 10MB.");
          return;
        }

        setAttachments((prev) => {
          if (prev.length >= 5) {
            Alert.alert("Too many files", "Maximum 5 attachments allowed.");
            return prev;
          }
          return [...prev, newFile];
        });
      }
    } catch (error) {
      console.error("Error picking file:", error);
      Alert.alert("Error", "Failed to pick file.");
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDateConfirm = (_event: any, date?: Date) => {
    setIsDatePickerVisible(false);
    if (date) {
      setEventDate(formatDateForApi(date));
    }
  };

  const handleStartTimeConfirm = (_event: any, date?: Date) => {
    setIsStartTimePickerVisible(false);
    if (date) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setStartTime(`${hours}:${minutes}`);
    }
  };

  const handleEndTimeConfirm = (_event: any, date?: Date) => {
    setIsEndTimePickerVisible(false);
    if (date) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setEndTime(`${hours}:${minutes}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!content.trim()) {
      newErrors.content = "Content is required";
    }

    if (isStudent) {
      if (audience !== "myBatch") {
        newErrors.audience = "Students can only post for their own batch";
      }
      const hasBatch = userBatchName || selectedBatchName.trim();
      if (!hasBatch) {
        newErrors.audience = "Please enter your batch";
      }
    } else if (isCR) {
      if (audience !== "myBatch") {
        newErrors.audience = "CR can only post for their own batch";
      }
      const hasBatch = userBatchName || selectedBatchName.trim();
      if (!hasBatch) {
        newErrors.audience = "Please enter your batch";
      }
    } else if (isAdmin || isTeacher) {
      if (audience === "batch" && !selectedBatchName.trim()) {
        newErrors.batch = "Please enter a batch name";
      } else if (audience === "myBatch" && !userBatchId) {
        newErrors.audience = "You must belong to a batch to post for your batch";
      }
    }

    if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      newErrors.audience = "Invalid date format (use YYYY-MM-DD)";
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (startTime && !timeRegex.test(startTime)) {
      newErrors.audience = "Invalid start time format (use HH:MM)";
    }
    if (endTime && !timeRegex.test(endTime)) {
      newErrors.audience = "Invalid end time format (use HH:MM)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setTag("general");
    setEventDate("");
    setStartTime("");
    setEndTime("");
    setAudience(initialAudience);
    setSelectedBatchName("");
    setAttachments([]);
    setErrors({});
  };

  const handleCreateNotice = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      if (isStudent && audience !== "myBatch") {
        Alert.alert("Error", "Students can only post for their own batch.");
        setIsLoading(false);
        return;
      }
      if (isCR && audience !== "myBatch") {
        Alert.alert("Error", "CR can only post for their own batch.");
        setIsLoading(false);
        return;
      }

      if ((isStudent || isCR) && !userBatchName && !selectedBatchName.trim()) {
        Alert.alert(
          "Error",
          `${isStudent ? "Students" : "CR"} must have a batch to create notices`,
        );
        setIsLoading(false);
        return;
      }

      const payload: any = {
        title: title.trim(),
        content: content.trim(),
        tag,
        forAll: audience === "all",
        forTeachers: audience === "teachers",
        targetBatchId:
          audience === "batch"
            ? selectedBatchName.trim()
            : audience === "myBatch"
              ? userBatchName || selectedBatchName.trim()
              : undefined,
      };

      if (eventDate.trim()) {
        payload.eventDate = eventDate;
      }
      if (startTime.trim()) {
        payload.startTime = startTime;
      }
      if (endTime.trim()) {
        payload.endTime = endTime;
      }

      const response = await noticeAPI.createNotice(payload);

      if (response.data.success) {
        const noticeId = response.data.data.id;

        if (attachments.length > 0) {
          try {
            await noticeAPI.uploadAttachments(noticeId, attachments);
          } catch (attachmentError) {
            const apiError = attachmentError as any;
            console.error("Error uploading attachments:", {
              message: apiError?.message,
              code: apiError?.code,
              status: apiError?.response?.status,
              data: apiError?.response?.data,
            });
            Alert.alert(
              "Partial Success",
              apiError?.response?.data?.message ||
                "Notice created, but some attachments failed to upload",
            );
          }
        }

        Alert.alert(
          "Success",
          response.data.data.status === "pending"
            ? "Notice submitted for approval!"
            : "Notice created and published!",
        );

        resetForm();
        onClose();
        onSuccess();
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create notice";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const showBatchInput =
    (audience === "batch" && (isAdmin || isTeacher)) ||
    ((isCR || isStudent) && !userBatchName);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      transparent={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        style={{ backgroundColor: COLORS.background }}
      >
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
              <View className="flex-row items-center flex-1 pr-3">
                <View
                  className="w-9 h-9 rounded-lg items-center justify-center mr-2.5"
                  style={{
                    backgroundColor: COLORS.primarySoft,
                    borderWidth: 1,
                    borderColor: "#9FC1FF",
                  }}
                >
                  <Ionicons name="megaphone-outline" size={17} color={COLORS.primary} />
                </View>

                <View className="flex-1">
                  <Text className="text-lg font-extrabold" style={{ color: COLORS.onSurface }}>
                    Create Notice
                  </Text>
                  <Text className="text-xs" style={{ color: COLORS.onSurfaceMuted }}>
                    Publish updates for your audience
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleClose}
                disabled={isLoading}
                activeOpacity={0.86}
                className="w-8 h-8 rounded-lg items-center justify-center"
                style={{
                  backgroundColor: COLORS.surfaceLow,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                }}
              >
                <Feather name="x" size={16} color={COLORS.onSurfaceMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {isPending ? (
            <View
              className="rounded-lg px-3 py-2.5 mb-3"
              style={{
                backgroundColor: COLORS.warningSoft,
                borderWidth: 1,
                borderColor: "#E4C580",
              }}
            >
              <Text className="text-sm font-semibold" style={{ color: COLORS.warning }}>
                This notice will be sent for approval.
              </Text>
            </View>
          ) : null}

          {willAutoApprove ? (
            <View
              className="rounded-lg px-3 py-2.5 mb-3"
              style={{
                backgroundColor: COLORS.successSoft,
                borderWidth: 1,
                borderColor: "#A7D8BF",
              }}
            >
              <Text className="text-sm font-semibold" style={{ color: COLORS.success }}>
                This notice will be published immediately.
              </Text>
            </View>
          ) : null}

          <View
            className="rounded-xl px-4 py-4 mb-3"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <Text className="text-sm font-bold mb-2.5" style={{ color: COLORS.onSurface }}>
              Audience
            </Text>

            <View className="gap-2">
              {canPostForAll ? (
                <AudienceOption
                  label="All Users"
                  description="Visible to everyone"
                  active={audience === "all"}
                  disabled={isAudienceDisabled("all")}
                  onPress={() => {
                    if (!isAudienceDisabled("all")) setAudience("all");
                  }}
                />
              ) : null}

              {canPostForTeachers ? (
                <AudienceOption
                  label="Teachers"
                  description="Only for teachers"
                  active={audience === "teachers"}
                  disabled={isAudienceDisabled("teachers")}
                  onPress={() => {
                    if (!isAudienceDisabled("teachers")) setAudience("teachers");
                  }}
                />
              ) : null}

              {canPostForMyBatch ? (
                <AudienceOption
                  label={userBatchName ? `Batch ${userBatchName}` : "My Batch"}
                  description="Limited to your own batch"
                  active={audience === "myBatch"}
                  disabled={isAudienceDisabled("myBatch")}
                  onPress={() => {
                    if (!isAudienceDisabled("myBatch")) setAudience("myBatch");
                  }}
                />
              ) : null}

              {canPostForSpecificBatch ? (
                <AudienceOption
                  label="Specific Batch"
                  description="Publish for one selected batch"
                  active={audience === "batch"}
                  disabled={isAudienceDisabled("batch")}
                  onPress={() => {
                    if (!isAudienceDisabled("batch")) setAudience("batch");
                  }}
                />
              ) : null}
            </View>

            {errors.audience ? (
              <Text className="text-xs font-medium mt-2" style={{ color: COLORS.danger }}>
                {errors.audience}
              </Text>
            ) : null}
          </View>

          {showBatchInput ? (
            <View
              className="rounded-xl px-4 py-4 mb-3"
              style={{
                backgroundColor: COLORS.warningSoft,
                borderWidth: 1,
                borderColor: "#E4C580",
              }}
            >
              <Text className="text-sm font-bold mb-2" style={{ color: COLORS.onSurface }}>
                Batch Name
              </Text>
              <TextInput
                className="rounded-lg px-3 py-3 text-sm"
                style={{
                  backgroundColor: COLORS.surface,
                  borderWidth: 1,
                  borderColor: errors.batch ? COLORS.danger : COLORS.outline,
                  color: COLORS.onSurface,
                }}
                placeholder="e.g., 2021"
                placeholderTextColor="#8B8E97"
                value={selectedBatchName}
                onChangeText={setSelectedBatchName}
                editable={!isLoading}
              />
              {errors.batch ? (
                <Text className="text-xs font-medium mt-2" style={{ color: COLORS.danger }}>
                  {errors.batch}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View
            className="rounded-xl px-4 py-4 mb-3"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <Text className="text-sm font-bold mb-2" style={{ color: COLORS.onSurface }}>
              Title
            </Text>
            <TextInput
              className="rounded-lg px-3 py-3 text-sm"
              style={{
                borderWidth: 1,
                borderColor: errors.title ? COLORS.danger : COLORS.outline,
                color: COLORS.onSurface,
              }}
              placeholder="Enter notice title"
              placeholderTextColor="#8B8E97"
              value={title}
              onChangeText={setTitle}
              editable={!isLoading}
            />
            {errors.title ? (
              <Text className="text-xs font-medium mt-2" style={{ color: COLORS.danger }}>
                {errors.title}
              </Text>
            ) : null}

            <Text className="text-sm font-bold mt-4 mb-2" style={{ color: COLORS.onSurface }}>
              Content
            </Text>
            <TextInput
              className="rounded-lg px-3 py-3 text-sm h-32"
              style={{
                borderWidth: 1,
                borderColor: errors.content ? COLORS.danger : COLORS.outline,
                color: COLORS.onSurface,
              }}
              placeholder="Write your notice content"
              placeholderTextColor="#8B8E97"
              value={content}
              onChangeText={setContent}
              editable={!isLoading}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            {errors.content ? (
              <Text className="text-xs font-medium mt-2" style={{ color: COLORS.danger }}>
                {errors.content}
              </Text>
            ) : null}

            <Text className="text-sm font-bold mt-4 mb-2" style={{ color: COLORS.onSurface }}>
              Tag
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              {tagOptions.map((option) => {
                const active = tag === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setTag(option.value)}
                    disabled={isLoading}
                    activeOpacity={0.86}
                    className="rounded-lg px-3 py-2"
                    style={{
                      backgroundColor: active ? COLORS.primarySoft : COLORS.surfaceLow,
                      borderWidth: 1,
                      borderColor: active ? "#9FC1FF" : COLORS.outline,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: active ? COLORS.primary : COLORS.onSurfaceMuted }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View
            className="rounded-xl px-4 py-4 mb-3"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <View className="flex-row items-center mb-2.5">
              <Ionicons name="calendar-outline" size={15} color={COLORS.primary} />
              <Text className="text-sm font-bold ml-1.5" style={{ color: COLORS.onSurface }}>
                Schedule (Optional)
              </Text>
            </View>

            <View className="gap-2">
              <TouchableOpacity
                onPress={() => setIsDatePickerVisible(true)}
                disabled={isLoading}
                activeOpacity={0.86}
                className="rounded-lg px-3 py-3 flex-row items-center justify-between"
                style={{
                  backgroundColor: COLORS.surfaceLow,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                }}
              >
                <Text className="text-sm" style={{ color: COLORS.onSurface }}>
                  {eventDate ? formatBangladeshDate(eventDate) : "Select date"}
                </Text>
                <Ionicons name="calendar-number-outline" size={16} color={COLORS.onSurfaceMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsStartTimePickerVisible(true)}
                disabled={isLoading}
                activeOpacity={0.86}
                className="rounded-lg px-3 py-3 flex-row items-center justify-between"
                style={{
                  backgroundColor: COLORS.surfaceLow,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                }}
              >
                <Text className="text-sm" style={{ color: COLORS.onSurface }}>
                  {startTime || "Select start time"}
                </Text>
                <Ionicons name="time-outline" size={16} color={COLORS.onSurfaceMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsEndTimePickerVisible(true)}
                disabled={isLoading}
                activeOpacity={0.86}
                className="rounded-lg px-3 py-3 flex-row items-center justify-between"
                style={{
                  backgroundColor: COLORS.surfaceLow,
                  borderWidth: 1,
                  borderColor: COLORS.outline,
                }}
              >
                <Text className="text-sm" style={{ color: COLORS.onSurface }}>
                  {endTime || "Select end time"}
                </Text>
                <Ionicons name="time-outline" size={16} color={COLORS.onSurfaceMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View
            className="rounded-xl px-4 py-4"
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <View className="flex-row items-center justify-between mb-2.5">
              <Text className="text-sm font-bold" style={{ color: COLORS.onSurface }}>
                Attachments (Optional)
              </Text>
              <Text className="text-xs" style={{ color: COLORS.onSurfaceMuted }}>
                {attachments.length}/5
              </Text>
            </View>

            {attachments.length > 0 ? (
              <View className="gap-2 mb-3">
                {attachments.map((file, index) => (
                  <View
                    key={`${file.name}-${index}`}
                    className="rounded-lg px-3 py-2.5 flex-row items-center"
                    style={{
                      backgroundColor: COLORS.surfaceLow,
                      borderWidth: 1,
                      borderColor: "#D6D8DD",
                    }}
                  >
                    <View className="flex-1 pr-3">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: COLORS.onSurface }}
                        numberOfLines={1}
                      >
                        {file.name}
                      </Text>
                      <Text className="text-xs mt-0.5" style={{ color: COLORS.onSurfaceMuted }}>
                        {formatFileSize(file.size)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => removeAttachment(index)}
                      disabled={isLoading}
                      className="w-8 h-8 rounded-lg items-center justify-center"
                      style={{
                        backgroundColor: COLORS.dangerSoft,
                        borderWidth: 1,
                        borderColor: "#F6CACA",
                      }}
                    >
                      <Feather name="x" size={14} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            {attachments.length < 5 ? (
              <TouchableOpacity
                onPress={pickFile}
                disabled={isLoading}
                activeOpacity={0.86}
                className="rounded-lg py-3 flex-row items-center justify-center"
                style={{
                  backgroundColor: COLORS.surface,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: COLORS.outline,
                }}
              >
                <Feather name="plus" size={14} color={COLORS.primary} />
                <Text className="text-sm font-semibold ml-1.5" style={{ color: COLORS.primary }}>
                  Add Image
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>

        <View
          className="px-4 py-4 flex-row gap-3"
          style={{
            borderTopWidth: 1,
            borderTopColor: "#E4E5EC",
            backgroundColor: COLORS.surface,
          }}
        >
          <TouchableOpacity
            onPress={handleClose}
            disabled={isLoading}
            activeOpacity={0.86}
            className="flex-1 min-h-[42px] rounded-lg items-center justify-center"
            style={{
              backgroundColor: COLORS.surfaceLow,
              borderWidth: 1,
              borderColor: COLORS.outline,
            }}
          >
            <Text className="text-sm font-semibold" style={{ color: COLORS.onSurface }}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCreateNotice}
            disabled={isLoading}
            activeOpacity={0.86}
            className="flex-1 min-h-[42px] rounded-lg flex-row items-center justify-center"
            style={{
              backgroundColor: COLORS.primary,
              borderWidth: 1,
              borderColor: COLORS.primary,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={14} color="#FFFFFF" />
                <Text className="text-sm font-bold text-white ml-1.5">
                  {isStudent ? "Submit" : "Publish"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {isDatePickerVisible ? (
        <DateTimePicker
          value={eventDate ? parseApiDate(eventDate) : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateConfirm}
        />
      ) : null}

      {isStartTimePickerVisible ? (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleStartTimeConfirm}
          is24Hour={true}
        />
      ) : null}

      {isEndTimePickerVisible ? (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleEndTimeConfirm}
          is24Hour={true}
        />
      ) : null}
    </Modal>
  );
}
