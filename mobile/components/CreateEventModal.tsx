import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
} from "react-native";

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (data: any) => Promise<void>;
  initialDate?: Date;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  visible,
  onClose,
  onCreate,
  initialDate,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAllDay, setIsAllDay] = useState(true);
  const [startDate, setStartDate] = useState(
    initialDate
      ? `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, "0")}-${String(initialDate.getDate()).padStart(2, "0")}`
      : "",
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    if (!startDate.trim()) {
      alert("Please select a date");
      return;
    }

    setIsLoading(true);
    try {
      let startDateTime = "";
      let endDateTime = "";

      if (isAllDay) {
        startDateTime = `${startDate}T00:00:00`;
        endDateTime = `${startDate}T23:59:59`;
      } else {
        startDateTime = `${startDate}T${startTime}:00`;
        endDateTime = `${startDate}T${endTime}:00`;
      }

      await onCreate({
        title: title.trim(),
        description: description.trim(),
        isAllDay,
        startDateTime,
        endDateTime,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setIsAllDay(true);
      setStartDate(
        initialDate
          ? `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, "0")}-${String(initialDate.getDate()).padStart(2, "0")}`
          : "",
      );
      setStartTime("09:00");
      setEndTime("10:00");
      onClose();
    } catch (error) {
      console.error("Error creating event:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold">Create Event</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-2xl text-gray-500">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Title */}
            <View className="mb-4">
              <Text className="text-sm font-semibold mb-2">Title</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3"
                placeholder="Event title"
                value={title}
                onChangeText={setTitle}
                editable={!isLoading}
              />
            </View>

            {/* Description */}
            <View className="mb-4">
              <Text className="text-sm font-semibold mb-2">Description</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 h-24"
                placeholder="Event description (optional)"
                value={description}
                onChangeText={setDescription}
                multiline
                editable={!isLoading}
              />
            </View>

            {/* All Day Toggle */}
            <View className="flex-row justify-between items-center mb-4 border-b border-gray-200 pb-4">
              <Text className="text-sm font-semibold">All Day</Text>
              <Switch
                value={isAllDay}
                onValueChange={setIsAllDay}
                disabled={isLoading}
              />
            </View>

            {/* Date */}
            <View className="mb-4">
              <Text className="text-sm font-semibold mb-2">Date</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3"
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
                editable={!isLoading}
              />
            </View>

            {/* Time Inputs (if not all day) */}
            {!isAllDay && (
              <>
                <View className="mb-4">
                  <Text className="text-sm font-semibold mb-2">Start Time</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3"
                    placeholder="HH:mm"
                    value={startTime}
                    onChangeText={setStartTime}
                    editable={!isLoading}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-semibold mb-2">End Time</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3"
                    placeholder="HH:mm"
                    value={endTime}
                    onChangeText={setEndTime}
                    editable={!isLoading}
                  />
                </View>
              </>
            )}

            {/* Action Buttons */}
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                className="flex-1 bg-gray-200 rounded-lg p-3 justify-center items-center"
                onPress={onClose}
                disabled={isLoading}
              >
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-blue-500 rounded-lg p-3 justify-center items-center"
                onPress={handleCreate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-semibold text-white">Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default CreateEventModal;
