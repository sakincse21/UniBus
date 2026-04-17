import React, { useState, useEffect } from "react";
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
import { Feather, Ionicons } from "@expo/vector-icons";
import {
  formatBangladeshDate,
  formatBangladeshTime,
  formatLocalDateTime,
  formatLocalDateAllDay,
  formatLocalDateEndOfDay,
} from "@/lib/dateFormatter";
import { APP_THEME_COLORS } from "@/lib/theme";

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (data: any) => Promise<void>;
  initialDate?: Date;
}

const COLORS = APP_THEME_COLORS;

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  visible,
  onClose,
  onCreate,
  initialDate,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
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

  useEffect(() => {
    if (visible) {
      setSelectedDate(initialDate || new Date());
    }
  }, [visible, initialDate]);

  const resetForm = () => {
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
  };

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
        startDateTime = formatLocalDateAllDay(selectedDate);
        endDateTime = formatLocalDateEndOfDay(selectedDate);
      } else {
        startDateTime = formatLocalDateTime(selectedDate, startTime);
        endDateTime = formatLocalDateTime(selectedDate, endTime);
      }

      await onCreate({
        title: title.trim(),
        description: description.trim(),
        isAllDay,
        startDateTime,
        endDateTime,
      });

      resetForm();
      onClose();
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to create event");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date): string => {
    return formatBangladeshDate(date);
  };

  const formatTime = (date: Date): string => {
    return formatBangladeshTime(date);
  };

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: "rgba(12, 15, 25, 0.45)" }}>
          <View
            className="w-full max-w-md rounded-xl p-5"
            style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outline }}
          >
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-row items-center gap-2">
                <View
                  className="w-9 h-9 rounded-lg items-center justify-center"
                  style={{ backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: "#9FC1FF" }}
                >
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                </View>
                <View>
                  <Text className="text-xl font-extrabold" style={{ color: COLORS.onSurface }}>
                    Create Event
                  </Text>
                  <Text className="text-sm" style={{ color: COLORS.onSurfaceMuted }}>
                    Add a personal calendar entry
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                disabled={isLoading}
                className="w-8 h-8 rounded-lg items-center justify-center"
                style={{ backgroundColor: COLORS.surfaceLow, borderWidth: 1, borderColor: COLORS.outline }}
              >
                <Feather name="x" size={16} color={COLORS.onSurfaceMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <View>
                  <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurface }}>
                    Title
                  </Text>
                  <TextInput
                    className="rounded-lg px-3 py-3 text-base"
                    style={{ borderWidth: 1, borderColor: COLORS.outline, color: COLORS.onSurface }}
                    placeholder="Event title"
                    placeholderTextColor="#8B8E97"
                    value={title}
                    onChangeText={setTitle}
                    editable={!isLoading}
                  />
                </View>

                <View>
                  <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurface }}>
                    Description
                  </Text>
                  <TextInput
                    className="rounded-lg px-3 py-3 text-base h-24"
                    style={{ borderWidth: 1, borderColor: COLORS.outline, color: COLORS.onSurface }}
                    placeholder="Optional description"
                    placeholderTextColor="#8B8E97"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlignVertical="top"
                    editable={!isLoading}
                  />
                </View>

                <View
                  className="flex-row justify-between items-center rounded-lg px-3 py-3"
                  style={{ backgroundColor: COLORS.surfaceLow, borderWidth: 1, borderColor: COLORS.outline }}
                >
                  <View>
                    <Text className="text-sm font-semibold" style={{ color: COLORS.onSurface }}>
                      All Day
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: COLORS.onSurfaceMuted }}>
                      Skip time selection for this event
                    </Text>
                  </View>

                  <Switch
                    value={isAllDay}
                    onValueChange={setIsAllDay}
                    disabled={isLoading}
                    trackColor={{ false: "#CFCFDA", true: "#9FC1FF" }}
                    thumbColor={isAllDay ? COLORS.primary : "#F8F8FC"}
                  />
                </View>

                <View>
                  <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurface }}>
                    Date
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    className="rounded-lg px-3 py-3 flex-row items-center justify-between"
                    style={{ borderWidth: 1, borderColor: COLORS.outline, backgroundColor: COLORS.surfaceLow }}
                    disabled={isLoading}
                  >
                    <Text className="text-base" style={{ color: COLORS.onSurface }}>
                      {formatDate(selectedDate)}
                    </Text>
                    <Ionicons name="calendar-number-outline" size={18} color={COLORS.onSurfaceMuted} />
                  </TouchableOpacity>
                </View>

                {!isAllDay && (
                  <>
                    <View>
                      <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurface }}>
                        Start Time
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowStartTimePicker(true)}
                        className="rounded-lg px-3 py-3 flex-row items-center justify-between"
                        style={{ borderWidth: 1, borderColor: COLORS.outline, backgroundColor: COLORS.surfaceLow }}
                        disabled={isLoading}
                      >
                        <Text className="text-base" style={{ color: COLORS.onSurface }}>
                          {formatTime(startTime)}
                        </Text>
                        <Ionicons name="time-outline" size={18} color={COLORS.onSurfaceMuted} />
                      </TouchableOpacity>
                    </View>

                    <View>
                      <Text className="text-sm font-semibold mb-1.5" style={{ color: COLORS.onSurface }}>
                        End Time
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowEndTimePicker(true)}
                        className="rounded-lg px-3 py-3 flex-row items-center justify-between"
                        style={{ borderWidth: 1, borderColor: COLORS.outline, backgroundColor: COLORS.surfaceLow }}
                        disabled={isLoading}
                      >
                        <Text className="text-base" style={{ color: COLORS.onSurface }}>
                          {formatTime(endTime)}
                        </Text>
                        <Ionicons name="time-outline" size={18} color={COLORS.onSurfaceMuted} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>

            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity
                className="flex-1 rounded-lg min-h-[42px] items-center justify-center"
                style={{ backgroundColor: COLORS.surfaceLow, borderWidth: 1, borderColor: COLORS.outline }}
                onPress={onClose}
                disabled={isLoading}
              >
                <Text className="text-sm font-semibold" style={{ color: COLORS.onSurface }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 rounded-lg min-h-[42px] items-center justify-center flex-row gap-2"
                style={{ backgroundColor: COLORS.primary, borderWidth: 1, borderColor: COLORS.primary }}
                onPress={handleCreate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={15} color="#FFFFFF" />
                    <Text className="text-sm font-bold text-white">Create</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "calendar"}
          onChange={(pickerEvent, date) => {
            if (pickerEvent.type === "set" && date) {
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
          onChange={(pickerEvent, date) => {
            if (pickerEvent.type === "set" && date) {
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
          onChange={(pickerEvent, date) => {
            if (pickerEvent.type === "set" && date) {
              setEndTime(date);
            }
            setShowEndTimePicker(false);
          }}
        />
      )}
    </>
  );
};

export default CreateEventModal;
