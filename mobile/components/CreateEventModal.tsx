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
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

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
  const [isAllDay, setIsAllDay] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialDate || new Date(),
  );
  const [startTime, setStartTime] = useState<Date>(() => {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    return date;
  });
  const [endTime, setEndTime] = useState<Date>(() => {
    const date = new Date();
    date.setHours(10, 0, 0, 0);
    return date;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    setIsLoading(true);
    try {
      let startDateTime: string;
      let endDateTime: string;

      if (isAllDay) {
        const dateStr = selectedDate.toISOString().split("T")[0];
        startDateTime = `${dateStr}T00:00:00`;
        endDateTime = `${dateStr}T23:59:59`;
      } else {
        const dateStr = selectedDate.toISOString().split("T")[0];
        const startHour = startTime.getHours().toString().padStart(2, "0");
        const startMin = startTime.getMinutes().toString().padStart(2, "0");
        const endHour = endTime.getHours().toString().padStart(2, "0");
        const endMin = endTime.getMinutes().toString().padStart(2, "0");

        startDateTime = `${dateStr}T${startHour}:${startMin}:00`;
        endDateTime = `${dateStr}T${endHour}:${endMin}:00`;
      }

      await onCreate({
        title: title.trim(),
        description: description.trim(),
        isAllDay,
        startDateTime,
        endDateTime,
      });

      setTitle("");
      setDescription("");
      setIsAllDay(false);
      setSelectedDate(initialDate || new Date());
      const defaultStart = new Date();
      defaultStart.setHours(9, 0, 0, 0);
      setStartTime(defaultStart);
      const defaultEnd = new Date();
      defaultEnd.setHours(10, 0, 0, 0);
      setEndTime(defaultEnd);
      onClose();
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to create event");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-6 max-h-[85%]">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">
              Create Event
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-2xl text-gray-500">×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Title
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 text-gray-900"
                placeholder="Event title"
                value={title}
                onChangeText={setTitle}
                editable={!isLoading}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Description
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 h-24 text-gray-900"
                placeholder="Event description (optional)"
                value={description}
                onChangeText={setDescription}
                multiline
                editable={!isLoading}
              />
            </View>

            <View className="flex-row justify-between items-center mb-4 border-b border-gray-200 pb-4">
              <Text className="text-sm font-semibold text-gray-700">
                All Day
              </Text>
              <Switch
                value={isAllDay}
                onValueChange={setIsAllDay}
                disabled={isLoading}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                disabled={isLoading}
              >
                <Text className="text-gray-900">
                  {formatDate(selectedDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {!isAllDay && (
              <>
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Start Time
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowStartTimePicker(true)}
                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                    disabled={isLoading}
                  >
                    <Text className="text-gray-900">
                      {formatTime(startTime)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    End Time
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowEndTimePicker(true)}
                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                    disabled={isLoading}
                  >
                    <Text className="text-gray-900">{formatTime(endTime)}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                className="flex-1 bg-gray-200 rounded-lg p-3 items-center"
                onPress={onClose}
                disabled={isLoading}
              >
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-blue-600 rounded-lg p-3 items-center"
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

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "calendar"}
          onChange={(event, date) => {
            if (event.type === "set" && date) {
              setSelectedDate(date);
            }
            setShowDatePicker(false);
          }}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "spinner"}
          onChange={(event, date) => {
            if (event.type === "set" && date) {
              setStartTime(date);
            }
            setShowStartTimePicker(false);
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "spinner"}
          onChange={(event, date) => {
            if (event.type === "set" && date) {
              setEndTime(date);
            }
            setShowEndTimePicker(false);
          }}
        />
      )}
    </Modal>
  );
};

export default CreateEventModal;
