import React, { useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { noticeAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

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

export default function CreateNoticeModal({
  visible,
  onClose,
  onSuccess,
}: CreateNoticeModalProps) {
  const { user } = useAuthStore();
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
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedBatchName, setSelectedBatchName] = useState<string>("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isStartTimePickerVisible, setIsStartTimePickerVisible] =
    useState(false);
  const [isEndTimePickerVisible, setIsEndTimePickerVisible] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    content?: string;
    audience?: string;
    batch?: string;
  }>({});

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
        newErrors.audience =
          "You must belong to a batch to post for your batch";
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

  const handleCreateNotice = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      if (isStudent && audience !== "myBatch") {
        Alert.alert("Error", "Students can only post for their own batch");
        setIsLoading(false);
        return;
      }
      if (isCR && audience !== "myBatch") {
        Alert.alert("Error", "CR can only post for their own batch");
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
            console.error("Error uploading attachments:", attachmentError);
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
        error.response?.data?.message ||
        error.message ||
        "Failed to create notice";
      Alert.alert("Error", errorMessage);
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
    setSelectedBatchName("");
    setAttachments([]);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
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
        <View className="px-4 py-4 border-b border-gray-200 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-gray-900">Create Notice</Text>
          <TouchableOpacity
            onPress={handleClose}
            disabled={isLoading}
            className="p-2"
          >
            <Text className="text-gray-500 text-xl">×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {isPending && (
            <View className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Text className="text-sm text-amber-800">
                Notice will be pending approval
              </Text>
            </View>
          )}
          {willAutoApprove && (
            <View className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
              <Text className="text-sm text-green-800">
                Will be published immediately
              </Text>
            </View>
          )}

          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-900 mb-3">
              Who should see this?
            </Text>
            <View className="gap-2">
              {canPostForAll && (
                <TouchableOpacity
                  onPress={() =>
                    !isAudienceDisabled("all") && setAudience("all")
                  }
                  disabled={isAudienceDisabled("all")}
                  className={`p-3 rounded-lg border ${
                    audience === "all"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <View className="flex-row items-center">
                    <View className="mr-3 h-5 w-5 rounded-full border-2 border-blue-500 items-center justify-center">
                      {audience === "all" && (
                        <View className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      )}
                    </View>
                    <Text className="text-sm font-medium text-gray-900">
                      All Users
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {canPostForTeachers && (
                <TouchableOpacity
                  onPress={() =>
                    !isAudienceDisabled("teachers") && setAudience("teachers")
                  }
                  disabled={isAudienceDisabled("teachers")}
                  className={`p-3 rounded-lg border ${
                    audience === "teachers"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <View className="flex-row items-center">
                    <View className="mr-3 h-5 w-5 rounded-full border-2 border-blue-500 items-center justify-center">
                      {audience === "teachers" && (
                        <View className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      )}
                    </View>
                    <Text className="text-sm font-medium text-gray-900">
                      Teachers Only
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {canPostForMyBatch && (
                <TouchableOpacity
                  onPress={() =>
                    !isAudienceDisabled("myBatch") && setAudience("myBatch")
                  }
                  disabled={isAudienceDisabled("myBatch")}
                  className={`p-3 rounded-lg border ${
                    audience === "myBatch"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <View className="flex-row items-center">
                    <View className="mr-3 h-5 w-5 rounded-full border-2 border-blue-500 items-center justify-center">
                      {audience === "myBatch" && (
                        <View className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      )}
                    </View>
                    <Text className="text-sm font-medium text-gray-900">
                      {userBatchName ? `Batch ${userBatchName}` : "My Batch"}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {canPostForSpecificBatch && (
                <TouchableOpacity
                  onPress={() =>
                    !isAudienceDisabled("batch") && setAudience("batch")
                  }
                  disabled={isAudienceDisabled("batch")}
                  className={`p-3 rounded-lg border ${
                    audience === "batch"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <View className="flex-row items-center">
                    <View className="mr-3 h-5 w-5 rounded-full border-2 border-blue-500 items-center justify-center">
                      {audience === "batch" && (
                        <View className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      )}
                    </View>
                    <Text className="text-sm font-medium text-gray-900">
                      Specific Batch
                    </Text>
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

          {((audience === "batch" && (isAdmin || isTeacher)) ||
            ((isCR || isStudent) && !userBatchName)) && (
            <View className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm font-semibold text-gray-900 mb-2">
                Batch Name
              </Text>
              <TextInput
                className={`p-3 border rounded-lg text-gray-900 bg-white ${
                  errors.batch ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="e.g., 2021 or 2022"
                placeholderTextColor="#9CA3AF"
                value={selectedBatchName}
                onChangeText={setSelectedBatchName}
                editable={!isLoading}
              />
              {errors.batch && (
                <Text className="text-red-500 text-xs mt-2">
                  {errors.batch}
                </Text>
              )}
            </View>
          )}

          <View className="mb-5">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Title
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
            />
            {errors.title && (
              <Text className="text-red-500 text-xs mt-1">{errors.title}</Text>
            )}
          </View>

          <View className="mb-5">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Content
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
              textAlignVertical="top"
            />
            {errors.content && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.content}
              </Text>
            )}
          </View>

          <View className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <Text className="mb-3 text-sm font-semibold text-gray-900">
              Schedule Event (Optional)
            </Text>

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
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Select Date"}
                </Text>
              </TouchableOpacity>
            </View>

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
                  {startTime || "Select Start Time"}
                </Text>
              </TouchableOpacity>
            </View>

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
                  {endTime || "Select End Time"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <Text className="mb-3 text-sm font-semibold text-gray-900">
              Attachments (Optional)
            </Text>

            {attachments.length > 0 && (
              <View className="mb-4 gap-2">
                {attachments.map((file, index) => (
                  <View
                    key={index}
                    className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-2"
                  >
                    <View className="flex-1">
                      <Text
                        className="text-xs font-medium text-gray-800"
                        numberOfLines={1}
                      >
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
                      <Text className="text-red-500 text-lg">×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {attachments.length < 5 && (
              <TouchableOpacity
                onPress={pickFile}
                disabled={isLoading}
                className="flex-row items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white py-3"
              >
                <Text className="text-sm font-medium text-gray-700">
                  Add File
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

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
              {isLoading
                ? "Creating..."
                : isStudent
                  ? "Submit for Approval"
                  : "Create"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {isDatePickerVisible && (
        <DateTimePicker
          value={eventDate ? new Date(eventDate) : new Date()}
          mode="date"
          display="spinner"
          onChange={handleDateConfirm}
        />
      )}

      {isStartTimePickerVisible && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="spinner"
          onChange={handleStartTimeConfirm}
          is24Hour={true}
        />
      )}

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
