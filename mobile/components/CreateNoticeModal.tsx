import React, { useState, useEffect } from "react";
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
  FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { noticeAPI, batchAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "expo-router";

type AudienceType = "all" | "teachers" | "batch" | "myBatch";

interface AttachedFile {
  uri: string;
  name: string;
  size: number;
  type: string;
}

interface BatchOption {
  id: number;
  name: string;
}

interface CreateNoticeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateNoticeModal({
  visible,
  onClose,
  onSuccess,
}: CreateNoticeModalProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [audience, setAudience] = useState<AudienceType>("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedBatchName, setSelectedBatchName] = useState<string | null>(
    null,
  );
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<BatchOption[]>([]);
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isStartTimePickerVisible, setIsStartTimePickerVisible] =
    useState(false);
  const [isEndTimePickerVisible, setIsEndTimePickerVisible] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    content?: string;
    audience?: string;
    batch?: string;
    attachments?: string;
  }>({});

  const canPostForAll = user?.role === "admin" || user?.role === "teacher";
  const canPostForTeachers = user?.role === "admin" || user?.role === "teacher";
  const canPostForBatch =
    (user?.role === "admin" ||
      user?.role === "teacher" ||
      user?.role === "cr" ||
      user?.role === "student") &&
    user?.batch;
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  // Initialize available batches from API
  useEffect(() => {
    if (isAdmin || isTeacher) {
      const fetchBatches = async () => {
        try {
          const response = await batchAPI.getAllBatches();
          if (response.data.success) {
            setAvailableBatches(response.data.data || []);
          }
        } catch (error) {
          console.error("Error fetching batches:", error);
          // Fall back to mock data if API fails
          setAvailableBatches([
            { id: 1, name: "CSE 2021" },
            { id: 2, name: "CSE 2022" },
            { id: 3, name: "CSE 2023" },
            { id: 4, name: "CSE 2024" },
            { id: 5, name: "CSE 2025" },
          ]);
        }
      };
      fetchBatches();
    }
  }, [isAdmin, isTeacher]);

  // Disable audience options based on role
  const isAudienceDisabled = (type: AudienceType) => {
    if (type === "all" && !canPostForAll) return true;
    if (type === "teachers" && !canPostForTeachers) return true;
    if (type === "myBatch" && !canPostForBatch) return true;
    if (type === "batch" && !(isAdmin || isTeacher)) return true;
    return false;
  };

  const pickFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const newFile: AttachedFile = {
          uri: asset.uri,
          name: asset.fileName || `file_${Date.now()}.jpg`,
          size: asset.fileSize || 0,
          type: asset.type || "application/octet-stream",
        };

        // Check file size (max 10MB)
        if (newFile.size > 10 * 1024 * 1024) {
          Alert.alert("File too large", "Maximum file size is 10MB");
          return;
        }

        setAttachments((prev) => {
          if (prev.length >= 5) {
            Alert.alert("Too many files", "Maximum 5 attachments allowed");
            return prev;
          }
          return [...prev, newFile];
        });
      }
    } catch (error) {
      console.error("Error picking file:", error);
      Alert.alert("Error", "Failed to pick file");
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDateConfirm = (event: any, date?: Date) => {
    setIsDatePickerVisible(false);
    if (date) {
      const formattedDate = date.toISOString().split("T")[0];
      setEventDate(formattedDate);
    }
  };

  const handleStartTimeConfirm = (event: any, date?: Date) => {
    setIsStartTimePickerVisible(false);
    if (date) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setStartTime(`${hours}:${minutes}`);
    }
  };

  const handleEndTimeConfirm = (event: any, date?: Date) => {
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

    if (audience === "all" && (!canPostForAll || user?.role === "student")) {
      newErrors.audience = "You cannot post for all users with your role";
    } else if (
      audience === "teachers" &&
      (!canPostForTeachers || user?.role === "student")
    ) {
      newErrors.audience = "You cannot post for teachers with your role";
    } else if (audience === "myBatch" && (!canPostForBatch || !user?.batch)) {
      newErrors.audience = "You must belong to a batch to post for your batch";
    } else if (audience === "batch" && !selectedBatchName) {
      newErrors.batch = "Please select a batch";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateNotice = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Create the notice
      const payload: any = {
        title: title.trim(),
        content: content.trim(),
        forAll: audience === "all",
        forTeachers: audience === "teachers",
        targetBatchId:
          audience === "batch"
            ? selectedBatchName
            : audience === "myBatch"
              ? user?.batch?.name
              : undefined,
      };

      // Add optional date/time fields
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

        // Step 2: Upload attachments if any
        if (attachments.length > 0) {
          const formData = new FormData();
          formData.append("noticeId", noticeId.toString());

          // Append each file
          attachments.forEach((file, index) => {
            formData.append("files", {
              uri: file.uri,
              name: file.name,
              type: file.type,
            } as any);
          });

          try {
            await noticeAPI.uploadAttachments(formData);
          } catch (attachmentError) {
            console.error("Error uploading attachments:", attachmentError);
            // Notice was created successfully, just warn about attachments
            Alert.alert(
              "Partial Success",
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
        error.response?.data?.message || "Failed to create notice";
      Alert.alert("Error", errorMessage);
      console.error("Failed to create notice:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setEventDate("");
    setStartTime("");
    setEndTime("");
    setAudience("all");
    setSelectedBatchName(null);
    setAttachments([]);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getAudienceLabel = (type: AudienceType): string => {
    switch (type) {
      case "all":
        return "All Users";
      case "teachers":
        return "Teachers Only";
      case "myBatch":
        return `Batch ${user?.batch?.name || ""}`;
      case "batch":
        return `Specific Batch (${selectedBatchName || "Select"})`;
      default:
        return "";
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      transparent={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-white"
      >
        {/* Header */}
        <View className="px-4 py-4 border-b border-gray-200 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">
            Create Notice
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            disabled={isLoading}
            className="p-2"
          >
            <Text className="text-gray-500 text-xl">✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Audience Selection */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-900 mb-3">
              Who should see this?
            </Text>
            <View className="gap-2">
              {/* All Users Option */}
              <TouchableOpacity
                onPress={() => !isAudienceDisabled("all") && setAudience("all")}
                disabled={isAudienceDisabled("all")}
                className={`p-3 rounded-lg border-2 ${
                  audience === "all"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-gray-50"
                } ${isAudienceDisabled("all") ? "opacity-50" : ""}`}
              >
                <View className="flex-row items-center">
                  <View className="mr-3 h-6 w-6 rounded-full border-2 border-blue-500 items-center justify-center">
                    {audience === "all" && (
                      <View className="h-3 w-3 rounded-full bg-blue-500" />
                    )}
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-900">
                      All Users
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Everyone will see this
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Teachers Option */}
              <TouchableOpacity
                onPress={() =>
                  !isAudienceDisabled("teachers") && setAudience("teachers")
                }
                disabled={isAudienceDisabled("teachers")}
                className={`p-3 rounded-lg border-2 ${
                  audience === "teachers"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-gray-50"
                } ${isAudienceDisabled("teachers") ? "opacity-50" : ""}`}
              >
                <View className="flex-row items-center">
                  <View className="mr-3 h-6 w-6 rounded-full border-2 border-blue-500 items-center justify-center">
                    {audience === "teachers" && (
                      <View className="h-3 w-3 rounded-full bg-blue-500" />
                    )}
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-900">
                      Teachers Only
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Only teachers will see this
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* My Batch Option */}
              {canPostForBatch && (
                <TouchableOpacity
                  onPress={() =>
                    !isAudienceDisabled("myBatch") && setAudience("myBatch")
                  }
                  disabled={isAudienceDisabled("myBatch")}
                  className={`p-3 rounded-lg border-2 ${
                    audience === "myBatch"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <View className="flex-row items-center">
                    <View className="mr-3 h-6 w-6 rounded-full border-2 border-blue-500 items-center justify-center">
                      {audience === "myBatch" && (
                        <View className="h-3 w-3 rounded-full bg-blue-500" />
                      )}
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-gray-900">
                        My Batch ({user?.batch?.name})
                      </Text>
                      <Text className="text-xs text-gray-500">
                        Only your batch will see this
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {/* Specific Batch Option (Admin/Teachers only) */}
              {(isAdmin || isTeacher) && (
                <TouchableOpacity
                  onPress={() =>
                    !isAudienceDisabled("batch") && setAudience("batch")
                  }
                  disabled={isAudienceDisabled("batch")}
                  className={`p-3 rounded-lg border-2 ${
                    audience === "batch"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <View className="flex-row items-center">
                    <View className="mr-3 h-6 w-6 rounded-full border-2 border-blue-500 items-center justify-center">
                      {audience === "batch" && (
                        <View className="h-3 w-3 rounded-full bg-blue-500" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900">
                        Select Specific Batch
                      </Text>
                      <Text className="text-xs text-gray-500">
                        Only selected batch will see this
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </View>
            {errors.audience && (
              <Text className="text-red-500 text-xs mt-2">
                {errors.audience}
              </Text>
            )}
          </View>

          {/* Batch Picker - Show when batch audience selected */}
          {audience === "batch" && (isAdmin || isTeacher) && (
            <View className="mb-5 bg-blue-50 p-3 rounded-lg border border-blue-200">
              <Text className="text-xs font-medium text-gray-700 mb-2">
                Select Target Batch
              </Text>
              <View className="gap-2">
                {availableBatches.map((batch) => (
                  <TouchableOpacity
                    key={batch.id}
                    onPress={() => setSelectedBatchName(batch.name)}
                    className={`p-3 rounded-lg border ${
                      selectedBatchName === batch.name
                        ? "border-blue-500 bg-blue-100"
                        : "border-blue-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        selectedBatchName === batch.name
                          ? "text-blue-900"
                          : "text-gray-800"
                      }`}
                    >
                      {batch.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.batch && (
                <Text className="text-red-500 text-xs mt-2">
                  {errors.batch}
                </Text>
              )}
            </View>
          )}

          {/* Title Input */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Title *
            </Text>
            <TextInput
              className={`p-3 border rounded-lg text-gray-900 ${
                errors.title ? "border-red-500" : "border-gray-200"
              }`}
              placeholder="Enter notice title"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              editable={!isLoading}
              maxLength={100}
            />
            {errors.title && (
              <Text className="text-red-500 text-xs mt-1">{errors.title}</Text>
            )}
            <Text className="text-xs text-gray-500 mt-1">
              {title.length}/100
            </Text>
          </View>

          {/* Content Input */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Content *
            </Text>
            <TextInput
              className={`p-3 border rounded-lg text-gray-900 ${
                errors.content ? "border-red-500" : "border-gray-200"
              }`}
              placeholder="Enter notice content"
              placeholderTextColor="#9CA3AF"
              value={content}
              onChangeText={setContent}
              editable={!isLoading}
              multiline
              numberOfLines={5}
              maxLength={1000}
              textAlignVertical="top"
            />
            {errors.content && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.content}
              </Text>
            )}
            <Text className="text-xs text-gray-500 mt-1">
              {content.length}/1000
            </Text>
          </View>

          {/* Optional: Event Date & Time */}
          <View className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <Text className="mb-3 text-sm font-semibold text-gray-900">
              📅 Optional: Schedule Event
            </Text>

            {/* Event Date */}
            <View className="mb-3">
              <Text className="mb-1 text-xs font-medium text-gray-700">
                Event Date
              </Text>
              <TouchableOpacity
                onPress={() => setIsDatePickerVisible(true)}
                disabled={isLoading}
                className="rounded border border-blue-300 bg-blue-50 p-3"
              >
                <Text className="text-sm text-gray-900">
                  {eventDate
                    ? new Date(eventDate).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "📅 Select Date"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Start Time */}
            <View className="mb-3">
              <Text className="mb-1 text-xs font-medium text-gray-700">
                Start Time
              </Text>
              <TouchableOpacity
                onPress={() => setIsStartTimePickerVisible(true)}
                disabled={isLoading}
                className="rounded border border-green-300 bg-green-50 p-3"
              >
                <Text className="text-sm text-gray-900">
                  {startTime ? startTime : "🕐 Select Start Time"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* End Time */}
            <View>
              <Text className="mb-1 text-xs font-medium text-gray-700">
                End Time
              </Text>
              <TouchableOpacity
                onPress={() => setIsEndTimePickerVisible(true)}
                disabled={isLoading}
                className="rounded border border-red-300 bg-red-50 p-3"
              >
                <Text className="text-sm text-gray-900">
                  {endTime ? endTime : "🕐 Select End Time"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Attachments Section */}
          <View className="mb-5 rounded-lg border border-gray-200 bg-yellow-50 p-4">
            <Text className="mb-3 text-sm font-semibold text-gray-900">
              📎 Attachments (Optional)
            </Text>
            <Text className="mb-3 text-xs text-gray-600">
              Max 5 files, 10MB each. Supports: Images, Documents, PDFs, etc.
            </Text>

            {attachments.length > 0 && (
              <View className="mb-4 gap-2">
                {attachments.map((file, index) => (
                  <View
                    key={index}
                    className="flex-row items-center justify-between rounded-lg border border-yellow-200 bg-white p-2"
                  >
                    <View className="flex-1">
                      <Text className="text-xs font-medium text-gray-800">
                        {file.name}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeAttachment(index)}
                      disabled={isLoading}
                      className="ml-2 p-2"
                    >
                      <Text className="text-red-500 text-lg">✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {attachments.length < 5 && (
              <TouchableOpacity
                onPress={pickFile}
                disabled={isLoading}
                className="flex-row items-center justify-center rounded-lg border border-dashed border-yellow-400 bg-white py-3"
              >
                <Text className="mr-2 text-base">📎</Text>
                <Text className="text-sm font-semibold text-gray-700">
                  Add File
                </Text>
              </TouchableOpacity>
            )}

            {attachments.length >= 5 && (
              <View className="rounded-lg bg-yellow-100 p-2">
                <Text className="text-xs text-yellow-800">
                  Maximum attachments reached (5/5)
                </Text>
              </View>
            )}
          </View>

          {/* Info Box */}
          {user?.role === "student" && (
            <View className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <Text className="text-xs font-medium text-blue-900">
                ℹ️ Your notice will be submitted for approval
              </Text>
            </View>
          )}

          {user?.role === "admin" || user?.role === "teacher" ? (
            <View className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3">
              <Text className="text-xs font-medium text-green-900">
                ✓ Your notice will be published immediately
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Footer - Action Buttons */}
        <View className="flex-row gap-3 border-t border-gray-200 px-4 py-4">
          <TouchableOpacity
            onPress={handleClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 bg-white py-3"
          >
            <Text className="text-center font-semibold text-gray-900">
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCreateNotice}
            disabled={isLoading}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3 ${
              isLoading ? "bg-blue-400" : "bg-blue-600"
            }`}
          >
            {isLoading && <ActivityIndicator size="small" color="white" />}
            <Text className="text-center font-semibold text-white">
              {isLoading ? "Creating..." : "Create Notice"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Date Picker */}
      {isDatePickerVisible && (
        <DateTimePicker
          value={eventDate ? new Date(eventDate) : new Date()}
          mode="date"
          display="spinner"
          onChange={handleDateConfirm}
        />
      )}

      {/* Start Time Picker */}
      {isStartTimePickerVisible && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="spinner"
          onChange={handleStartTimeConfirm}
          is24Hour={true}
        />
      )}

      {/* End Time Picker */}
      {isEndTimePickerVisible && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="spinner"
          onChange={handleEndTimeConfirm}
          is24Hour={true}
        />
      )}
    </Modal>
  );
}
